use std::{
    collections::HashSet,
    io,
    path::{Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};

use executors::logs::utils::{ConversationPatch, patch::escape_json_pointer_segment};
use futures::StreamExt;
use notify_debouncer_full::DebouncedEvent;
use thiserror::Error;
use tokio::{sync::mpsc, task::JoinHandle};
use tokio_stream::wrappers::ReceiverStream;
use utils::{
    diff::{self, Diff},
    log_msg::LogMsg,
};

use crate::services::{
    filesystem_watcher::{self, FilesystemWatcherError},
    git::{Commit, DiffTarget, GitService, GitServiceError},
};

/// Maximum cumulative diff bytes to stream before omitting content (200MB)
pub const MAX_CUMULATIVE_DIFF_BYTES: usize = 200 * 1024 * 1024;

const DIFF_STREAM_CHANNEL_CAPACITY: usize = 1000;

/// Errors that can occur during diff stream creation and operation
#[derive(Error, Debug)]
pub enum DiffStreamError {
    #[error("Git service error: {0}")]
    GitService(#[from] GitServiceError),
    #[error("Filesystem watcher error: {0}")]
    FilesystemWatcher(#[from] FilesystemWatcherError),
    #[error("Task join error: {0}")]
    TaskJoin(#[from] tokio::task::JoinError),
}

/// Diff stream that owns the filesystem watcher task
/// When this stream is dropped, the watcher is automatically cleaned up
pub struct DiffStreamHandle {
    stream: futures::stream::BoxStream<'static, Result<LogMsg, io::Error>>,
    _watcher_task: Option<JoinHandle<()>>,
}

impl futures::Stream for DiffStreamHandle {
    type Item = Result<LogMsg, io::Error>;

    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        // Delegate to inner stream
        std::pin::Pin::new(&mut self.stream).poll_next(cx)
    }
}

impl Drop for DiffStreamHandle {
    fn drop(&mut self) {
        if let Some(handle) = self._watcher_task.take() {
            handle.abort();
        }
    }
}

impl DiffStreamHandle {
    /// Create a new DiffStreamHandle from a boxed stream and optional watcher task
    pub fn new(
        stream: futures::stream::BoxStream<'static, Result<LogMsg, io::Error>>,
        watcher_task: Option<JoinHandle<()>>,
    ) -> Self {
        Self {
            stream,
            _watcher_task: watcher_task,
        }
    }
}

struct DiffWatcherContext {
    git_service: GitService,
    worktree_path: PathBuf,
    base_commit: Commit,
    // Optional: if provided, dynamically read base_commit from DB on each file change
    task_attempt_id: Option<uuid::Uuid>,
    db_pool: Option<sqlx::SqlitePool>,
    last_base_commit_oid: Arc<std::sync::RwLock<String>>,
    cumulative: Arc<AtomicUsize>,
    full_sent: Arc<std::sync::RwLock<HashSet<String>>>,
    stats_only: bool,
    tx: mpsc::Sender<Result<LogMsg, io::Error>>,
}

impl DiffWatcherContext {
    async fn handle_events(
        &self,
        events: Vec<DebouncedEvent>,
        canonical_worktree_path: &Path,
    ) -> bool {
        let changed_paths =
            extract_changed_paths(&events, canonical_worktree_path, &self.worktree_path);

        if changed_paths.is_empty() {
            return true;
        }

        // Check if base_commit changed in database (dynamic mode)
        let base_commit = if let (Some(task_attempt_id), Some(ref db_pool)) =
            (self.task_attempt_id, self.db_pool.as_ref())
        {
            match self.check_and_update_base_commit(task_attempt_id, db_pool).await {
                Ok(Some(new_base_commit)) => {
                    // Base commit changed! Send full diff recalculation
                    tracing::info!(
                        "Base commit changed for task attempt {}, recalculating full diff",
                        task_attempt_id
                    );
                    return self.send_full_diff_update(&new_base_commit).await;
                }
                Ok(None) => {
                    // Base commit unchanged, use current
                    self.base_commit.clone()
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to check base commit for task attempt {}: {}",
                        task_attempt_id,
                        e
                    );
                    // Fallback to current base_commit
                    self.base_commit.clone()
                }
            }
        } else {
            // Static mode: use captured base_commit
            self.base_commit.clone()
        };

        let git_service = self.git_service.clone();
        let worktree_path = self.worktree_path.clone();
        let cumulative = self.cumulative.clone();
        let full_sent = self.full_sent.clone();
        let stats_only = self.stats_only;

        match tokio::task::spawn_blocking(move || {
            process_file_changes(
                &git_service,
                &worktree_path,
                &base_commit,
                &changed_paths,
                &cumulative,
                &full_sent,
                stats_only,
            )
        })
        .await
        {
            Ok(Ok(messages)) => send_messages(&self.tx, messages).await,
            Ok(Err(err)) => {
                tracing::error!("Error processing file changes: {err}");
                send_error(&self.tx, err.to_string()).await;
                false
            }
            Err(join_err) => {
                tracing::error!("Diff processing task join error: {join_err}");
                send_error(
                    &self.tx,
                    format!("Diff processing task join error: {join_err}"),
                )
                .await;
                false
            }
        }
    }

    /// Check if base_commit changed in database. Returns Some(new_commit) if changed, None if unchanged
    async fn check_and_update_base_commit(
        &self,
        task_attempt_id: uuid::Uuid,
        db_pool: &sqlx::SqlitePool,
    ) -> Result<Option<Commit>, sqlx::Error> {
        // Query current base_commit from database
        let row = sqlx::query!("SELECT base_commit FROM task_attempts WHERE id = ?", task_attempt_id)
            .fetch_optional(db_pool)
            .await?;

        if let Some(row) = row {
            if let Some(current_base_commit_oid) = row.base_commit {
                // Check if it changed
                let last_known = self.last_base_commit_oid.read().unwrap().clone();
                if current_base_commit_oid != last_known {
                    // Update the last known commit
                    *self.last_base_commit_oid.write().unwrap() = current_base_commit_oid.clone();

                    // Parse and return new commit
                    if let Ok(oid) = git2::Oid::from_str(&current_base_commit_oid) {
                        return Ok(Some(Commit::new(oid)));
                    }
                }
            }
        }
        Ok(None)
    }

    /// Send a full diff recalculation when base_commit changes
    async fn send_full_diff_update(&self, new_base_commit: &Commit) -> bool {
        let git_service = self.git_service.clone();
        let worktree_path = self.worktree_path.clone();
        let new_base = new_base_commit.clone();
        let stats_only = self.stats_only;

        // Reset cumulative counters and full_sent tracking
        self.cumulative.store(0, Ordering::Relaxed);
        self.full_sent.write().unwrap().clear();

        // Get full diff with new base
        match tokio::task::spawn_blocking(move || {
            git_service.get_diffs(
                DiffTarget::Worktree {
                    worktree_path: &worktree_path,
                    base_commit: &new_base,
                },
                None,
            )
        })
        .await
        {
            Ok(Ok(diffs)) => {
                let mut messages = Vec::with_capacity(diffs.len());
                for mut diff in diffs {
                    apply_stream_omit_policy(&mut diff, &self.cumulative, stats_only);
                    if !diff.content_omitted {
                        self.full_sent.write().unwrap().insert(GitService::diff_path(&diff));
                    }
                    messages.push(Ok(LogMsg::JsonPatch(diff.to_json_patch())));
                }
                send_messages(&self.tx, messages).await
            }
            Ok(Err(e)) => {
                tracing::error!("Error getting full diff after base_commit change: {}", e);
                send_error(&self.tx, e.to_string()).await;
                false
            }
            Err(e) => {
                tracing::error!("Task join error getting full diff: {}", e);
                send_error(&self.tx, e.to_string()).await;
                false
            }
        }
    }
}

pub async fn create(
    git_service: GitService,
    worktree_path: PathBuf,
    base_commit: Commit,
    stats_only: bool,
) -> Result<DiffStreamHandle, DiffStreamError> {
    let initial_diffs_raw = git_service.get_diffs(
        DiffTarget::Worktree {
            worktree_path: &worktree_path,
            base_commit: &base_commit,
        },
        None,
    )?;

    let cumulative = Arc::new(AtomicUsize::new(0));
    let full_sent = Arc::new(std::sync::RwLock::new(HashSet::<String>::new()));
    let mut initial_diffs = Vec::with_capacity(initial_diffs_raw.len());
    for mut diff in initial_diffs_raw {
        apply_stream_omit_policy(&mut diff, &cumulative, stats_only);
        initial_diffs.push(diff);
    }

    {
        let mut guard = full_sent.write().unwrap();
        for diff in &initial_diffs {
            if !diff.content_omitted {
                guard.insert(GitService::diff_path(diff));
            }
        }
    }

    let (tx, rx) = mpsc::channel::<Result<LogMsg, io::Error>>(DIFF_STREAM_CHANNEL_CAPACITY);
    if !send_initial_diffs(&tx, initial_diffs).await {
        return Ok(DiffStreamHandle::new(ReceiverStream::new(rx).boxed(), None));
    }

    let tx_clone = tx.clone();
    let ctx = DiffWatcherContext {
        git_service,
        worktree_path: worktree_path.clone(),
        base_commit: base_commit.clone(),
        task_attempt_id: None, // Static mode
        db_pool: None,
        last_base_commit_oid: Arc::new(std::sync::RwLock::new(base_commit.oid.clone())),
        cumulative,
        full_sent,
        stats_only,
        tx: tx_clone,
    };

    let watcher_task = tokio::spawn(async move {
        let worktree_path_for_spawn = worktree_path;
        let watcher_result = tokio::task::spawn_blocking(move || {
            filesystem_watcher::async_watcher(worktree_path_for_spawn)
        })
        .await;

        let (debouncer, mut watcher_rx, canonical_worktree_path) = match watcher_result {
            Ok(Ok(parts)) => parts,
            Ok(Err(e)) => {
                tracing::error!("Failed to set up filesystem watcher: {e}");
                send_error(&ctx.tx, e.to_string()).await;
                return;
            }
            Err(join_err) => {
                tracing::error!("Failed to spawn watcher setup: {join_err}");
                send_error(
                    &ctx.tx,
                    format!("Failed to spawn watcher setup: {join_err}"),
                )
                .await;
                return;
            }
        };

        let _debouncer_guard = debouncer;

        while let Some(result) = watcher_rx.next().await {
            match result {
                Ok(events) => {
                    if !ctx.handle_events(events, &canonical_worktree_path).await {
                        return;
                    }
                }
                Err(errors) => {
                    let message = errors
                        .iter()
                        .map(|e| e.to_string())
                        .collect::<Vec<_>>()
                        .join("; ");
                    tracing::error!("Filesystem watcher error: {message}");
                    send_error(&ctx.tx, message).await;
                    return;
                }
            }
        }
    });

    drop(tx);

    Ok(DiffStreamHandle::new(
        ReceiverStream::new(rx).boxed(),
        Some(watcher_task),
    ))
}

/// Create a diff stream with dynamic base commit checking
/// This variant reads base_commit from the database on each file change event
/// and recalculates the full diff if it changed (e.g., after rebase)
pub async fn create_with_dynamic_base(
    git_service: GitService,
    worktree_path: PathBuf,
    initial_base_commit: Commit,
    task_attempt_id: uuid::Uuid,
    db_pool: sqlx::SqlitePool,
    stats_only: bool,
) -> Result<DiffStreamHandle, DiffStreamError> {
    let initial_diffs_raw = git_service.get_diffs(
        DiffTarget::Worktree {
            worktree_path: &worktree_path,
            base_commit: &initial_base_commit,
        },
        None,
    )?;

    let cumulative = Arc::new(AtomicUsize::new(0));
    let full_sent = Arc::new(std::sync::RwLock::new(HashSet::<String>::new()));
    let mut initial_diffs = Vec::with_capacity(initial_diffs_raw.len());
    for mut diff in initial_diffs_raw {
        apply_stream_omit_policy(&mut diff, &cumulative, stats_only);
        initial_diffs.push(diff);
    }

    {
        let mut guard = full_sent.write().unwrap();
        for diff in &initial_diffs {
            if !diff.content_omitted {
                guard.insert(GitService::diff_path(diff));
            }
        }
    }

    let (tx, rx) = mpsc::channel::<Result<LogMsg, io::Error>>(DIFF_STREAM_CHANNEL_CAPACITY);
    if !send_initial_diffs(&tx, initial_diffs).await {
        return Ok(DiffStreamHandle::new(ReceiverStream::new(rx).boxed(), None));
    }

    let tx_clone = tx.clone();
    let ctx = DiffWatcherContext {
        git_service,
        worktree_path: worktree_path.clone(),
        base_commit: initial_base_commit.clone(),
        task_attempt_id: Some(task_attempt_id), // Dynamic mode
        db_pool: Some(db_pool),
        last_base_commit_oid: Arc::new(std::sync::RwLock::new(initial_base_commit.oid.clone())),
        cumulative,
        full_sent,
        stats_only,
        tx: tx_clone,
    };

    let watcher_task = tokio::spawn(async move {
        let worktree_path_for_spawn = worktree_path;
        let watcher_result = tokio::task::spawn_blocking(move || {
            filesystem_watcher::watch(&worktree_path_for_spawn)
        })
        .await;

        let mut watcher = match watcher_result {
            Ok(Ok(w)) => w,
            Ok(Err(e)) => {
                tracing::error!("Failed to create filesystem watcher: {e}");
                send_error(&ctx.tx, e.to_string()).await;
                return;
            }
            Err(e) => {
                tracing::error!("Failed to spawn filesystem watcher task: {e}");
                send_error(&ctx.tx, e.to_string()).await;
                return;
            }
        };

        let canonical_worktree_path = match std::fs::canonicalize(&ctx.worktree_path) {
            Ok(p) => p,
            Err(e) => {
                tracing::error!("Failed to canonicalize worktree path: {e}");
                send_error(&ctx.tx, e.to_string()).await;
                return;
            }
        };

        loop {
            match watcher.recv().await {
                Ok(events) => {
                    if !ctx.handle_events(events, &canonical_worktree_path).await {
                        return;
                    }
                }
                Err(errors) => {
                    let message = errors
                        .iter()
                        .map(|e| e.to_string())
                        .collect::<Vec<_>>()
                        .join("; ");
                    tracing::error!("Filesystem watcher error: {message}");
                    send_error(&ctx.tx, message).await;
                    return;
                }
            }
        }
    });

    drop(tx);

    Ok(DiffStreamHandle::new(
        ReceiverStream::new(rx).boxed(),
        Some(watcher_task),
    ))
}

async fn send_initial_diffs(
    tx: &mpsc::Sender<Result<LogMsg, io::Error>>,
    diffs: Vec<Diff>,
) -> bool {
    for diff in diffs {
        let entry_index = GitService::diff_path(&diff);
        let patch = ConversationPatch::add_diff(escape_json_pointer_segment(&entry_index), diff);
        if tx.send(Ok(LogMsg::JsonPatch(patch))).await.is_err() {
            return false;
        }
    }
    true
}

async fn send_messages(
    tx: &mpsc::Sender<Result<LogMsg, io::Error>>,
    messages: Vec<LogMsg>,
) -> bool {
    for msg in messages {
        if tx.send(Ok(msg)).await.is_err() {
            return false;
        }
    }
    true
}

async fn send_error(tx: &mpsc::Sender<Result<LogMsg, io::Error>>, message: String) {
    let _ = tx.send(Err(io::Error::other(message))).await;
}

pub fn apply_stream_omit_policy(diff: &mut Diff, sent_bytes: &Arc<AtomicUsize>, stats_only: bool) {
    if stats_only {
        omit_diff_contents(diff);
        return;
    }

    let mut size = 0usize;
    if let Some(ref s) = diff.old_content {
        size += s.len();
    }
    if let Some(ref s) = diff.new_content {
        size += s.len();
    }

    if size == 0 {
        return;
    }

    let current = sent_bytes.load(Ordering::Relaxed);
    if current.saturating_add(size) > MAX_CUMULATIVE_DIFF_BYTES {
        omit_diff_contents(diff);
    } else {
        let _ = sent_bytes.fetch_add(size, Ordering::Relaxed);
    }
}

fn omit_diff_contents(diff: &mut Diff) {
    if diff.additions.is_none()
        && diff.deletions.is_none()
        && (diff.old_content.is_some() || diff.new_content.is_some())
    {
        let old = diff.old_content.as_deref().unwrap_or("");
        let new = diff.new_content.as_deref().unwrap_or("");
        let (add, del) = diff::compute_line_change_counts(old, new);
        diff.additions = Some(add);
        diff.deletions = Some(del);
    }

    diff.old_content = None;
    diff.new_content = None;
    diff.content_omitted = true;
}

fn extract_changed_paths(
    events: &[DebouncedEvent],
    canonical_worktree_path: &Path,
    worktree_path: &Path,
) -> Vec<String> {
    events
        .iter()
        .flat_map(|event| &event.paths)
        .filter_map(|path| {
            path.strip_prefix(canonical_worktree_path)
                .or_else(|_| path.strip_prefix(worktree_path))
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .filter(|s| !s.is_empty())
        .collect()
}

fn process_file_changes(
    git_service: &GitService,
    worktree_path: &Path,
    base_commit: &Commit,
    changed_paths: &[String],
    cumulative_bytes: &Arc<AtomicUsize>,
    full_sent_paths: &Arc<std::sync::RwLock<HashSet<String>>>,
    stats_only: bool,
) -> Result<Vec<LogMsg>, DiffStreamError> {
    let path_filter: Vec<&str> = changed_paths.iter().map(|s| s.as_str()).collect();

    let current_diffs = git_service.get_diffs(
        DiffTarget::Worktree {
            worktree_path,
            base_commit,
        },
        Some(&path_filter),
    )?;

    let mut msgs = Vec::new();
    let mut files_with_diffs = HashSet::new();

    for mut diff in current_diffs {
        let file_path = GitService::diff_path(&diff);
        files_with_diffs.insert(file_path.clone());
        apply_stream_omit_policy(&mut diff, cumulative_bytes, stats_only);

        if diff.content_omitted {
            if full_sent_paths.read().unwrap().contains(&file_path) {
                continue;
            }
        } else {
            let mut guard = full_sent_paths.write().unwrap();
            guard.insert(file_path.clone());
        }

        let patch = ConversationPatch::add_diff(escape_json_pointer_segment(&file_path), diff);
        msgs.push(LogMsg::JsonPatch(patch));
    }

    for changed_path in changed_paths {
        if !files_with_diffs.contains(changed_path) {
            let patch = ConversationPatch::remove_diff(escape_json_pointer_segment(changed_path));
            msgs.push(LogMsg::JsonPatch(patch));
        }
    }

    Ok(msgs)
}
