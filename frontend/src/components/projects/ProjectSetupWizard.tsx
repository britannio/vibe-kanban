import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, AlertCircle } from 'lucide-react';
import { useProjectMutations } from '@/hooks/useProjectMutations';
import { tasksApi } from '@/lib/api';
import type { Project, CreateTask } from 'shared/types';
import {
  createScriptPlaceholderStrategy,
  ScriptPlaceholderContext,
} from '@/utils/script-placeholders';
import { useUserSystem } from '@/components/config-provider';
import { CopyFilesField } from './copy-files-field';
import {
  COMPANION_INSTALL_TASK_TITLE,
  COMPANION_INSTALL_TASK_DESCRIPTION,
} from '@/utils/companion-install-task';

interface ProjectSetupWizardProps {
  project: Project;
  onComplete: () => void;
}

export function ProjectSetupWizard({
  project,
  onComplete,
}: ProjectSetupWizardProps) {
  const [setupScript, setSetupScript] = useState(project.setup_script ?? '');
  const [devScript, setDevScript] = useState(project.dev_script ?? '');
  const [cleanupScript, setCleanupScript] = useState(
    project.cleanup_script ?? ''
  );
  const [copyFiles, setCopyFiles] = useState(project.copy_files ?? '');
  const [includeCompanionTask, setIncludeCompanionTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { system } = useUserSystem();

  const placeholders = system.environment
    ? new ScriptPlaceholderContext(
        createScriptPlaceholderStrategy(system.environment.os_type)
      ).getPlaceholders()
    : {
        setup: '#!/bin/bash\nnpm install\n# Add any setup commands here...',
        dev: '#!/bin/bash\nnpm run dev\n# Add dev server start command here...',
        cleanup:
          '#!/bin/bash\n# Add cleanup commands here...\n# This runs after coding agent execution',
      };

  const { updateProject } = useProjectMutations({
    onUpdateError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setSaving(false);
    },
  });

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      await updateProject.mutateAsync({
        projectId: project.id,
        data: {
          name: null,
          git_repo_path: null,
          setup_script: setupScript.trim() || null,
          dev_script: devScript.trim() || null,
          cleanup_script: cleanupScript.trim() || null,
          copy_files: copyFiles.trim() || null,
        },
      });

      if (includeCompanionTask) {
        const taskData: CreateTask = {
          project_id: project.id,
          title: COMPANION_INSTALL_TASK_TITLE,
          description: COMPANION_INSTALL_TASK_DESCRIPTION,
          parent_task_attempt: null,
          image_ids: null,
        };
        await tasksApi.create(taskData);
      }

      onComplete();
    } catch (err) {
      console.error('Failed to save setup:', err);
      setError('Failed to save setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Configure Your Project</h2>
        <p className="text-muted-foreground">
          Set up scripts and optionally create your first task
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left column: Scripts */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-script">Setup Script</Label>
              <textarea
                id="setup-script"
                value={setupScript}
                onChange={(e) => setSetupScript(e.target.value)}
                placeholder={placeholders.setup}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-sm text-muted-foreground">
                Runs after creating the worktree and before the coding agent
                starts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev-script">Dev Server Script</Label>
              <textarea
                id="dev-script"
                value={devScript}
                onChange={(e) => setDevScript(e.target.value)}
                placeholder={placeholders.dev}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-sm text-muted-foreground">
                Start your development server for testing changes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cleanup-script">Cleanup Script</Label>
              <textarea
                id="cleanup-script"
                value={cleanupScript}
                onChange={(e) => setCleanupScript(e.target.value)}
                placeholder={placeholders.cleanup}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-sm text-muted-foreground">
                Runs after coding agent execution (linters, formatters, tests)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Copy Files</Label>
              <CopyFilesField
                value={copyFiles}
                onChange={setCopyFiles}
                projectId={project.id}
              />
              <p className="text-sm text-muted-foreground">
                Files to copy from the original project to the worktree
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Template */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Starter Task</h3>
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                includeCompanionTask
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setIncludeCompanionTask(!includeCompanionTask)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 mt-1 h-5 w-5 rounded border-2 flex items-center justify-center ${
                    includeCompanionTask
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {includeCompanionTask && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {COMPANION_INSTALL_TASK_TITLE}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                    {COMPANION_INSTALL_TASK_DESCRIPTION}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
