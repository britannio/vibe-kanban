import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { DEFAULT_TASKS } from '@/utils/default-tasks';

interface ProjectSetupWizardProps {
  project: Project;
}

export function ProjectSetupWizard({ project }: ProjectSetupWizardProps) {
  const { t } = useTranslation('projects');
  const [setupScript, setSetupScript] = useState(project.setup_script ?? '');
  const [devScript, setDevScript] = useState(project.dev_script ?? '');
  const [cleanupScript, setCleanupScript] = useState(
    project.cleanup_script ?? ''
  );
  const [copyFiles, setCopyFiles] = useState(project.copy_files ?? '');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set()
  );
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

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
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

      // Create selected default tasks
      const tasksToCreate = DEFAULT_TASKS.filter((task) =>
        selectedTaskIds.has(task.id)
      );

      for (const defaultTask of tasksToCreate) {
        const taskData: CreateTask = {
          project_id: project.id,
          title: defaultTask.title,
          description: defaultTask.description,
          parent_task_attempt: null,
          image_ids: null,
        };
        await tasksApi.create(taskData);
      }
    } catch (err) {
      console.error('Failed to save setup:', err);
      setError('Failed to save setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">
          {t('setup.title')}
        </h2>
        <p className="text-base text-muted-foreground">
          {t('setup.description')}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-script">{t('setup.setupScript.label')}</Label>
          <textarea
            id="setup-script"
            value={setupScript}
            onChange={(e) => setSetupScript(e.target.value)}
            placeholder={placeholders.setup}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-sm text-muted-foreground">
            {t('setup.setupScript.help')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dev-script">{t('setup.devScript.label')}</Label>
          <textarea
            id="dev-script"
            value={devScript}
            onChange={(e) => setDevScript(e.target.value)}
            placeholder={placeholders.dev}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-sm text-muted-foreground">
            {t('setup.devScript.help')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cleanup-script">{t('setup.cleanupScript.label')}</Label>
          <textarea
            id="cleanup-script"
            value={cleanupScript}
            onChange={(e) => setCleanupScript(e.target.value)}
            placeholder={placeholders.cleanup}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-sm text-muted-foreground">
            {t('setup.cleanupScript.help')}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t('setup.copyFiles.label')}</Label>
          <CopyFilesField
            value={copyFiles}
            onChange={setCopyFiles}
            projectId={project.id}
          />
          <p className="text-sm text-muted-foreground">
            {t('setup.copyFiles.help')}
          </p>
        </div>
      </div>

      <div className="border-t pt-6 space-y-3">
        <h3 className="text-base font-medium">{t('setup.starterTasks')}</h3>
        <div className="space-y-2">
          {DEFAULT_TASKS.map((task) => (
            <div
              key={task.id}
              className={`p-3 border rounded-md cursor-pointer transition-all ${
                selectedTaskIds.has(task.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => toggleTask(task.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center ${
                    selectedTaskIds.has(task.id)
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {selectedTaskIds.has(task.id) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {t(task.titleKey, task.title)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t(task.descriptionKey, 'Automatically install vibe-kanban-web-companion and integrate it into your app.')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? t('setup.saving') : t('setup.saveButton')}
      </Button>
    </div>
  );
}
