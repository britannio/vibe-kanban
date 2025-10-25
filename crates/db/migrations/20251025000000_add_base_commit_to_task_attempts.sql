-- Add base_commit field to task_attempts to store the commit SHA that represents the base for diffing
-- This prevents stale diffs when the target branch changes (e.g., after rebase)

ALTER TABLE task_attempts ADD COLUMN base_commit TEXT;

-- Backfill existing task attempts with their current merge-base
-- This is a best-effort backfill that calculates what the base_commit should be right now
-- Note: This requires the git repository to still have the branches
-- If a branch is gone, base_commit will remain NULL and will be calculated on next diff request
