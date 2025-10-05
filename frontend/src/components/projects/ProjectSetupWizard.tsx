import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Sparkles,
  Command,
} from 'lucide-react';
import { useProjectMutations } from '@/hooks/useProjectMutations';
import { templatesApi, tasksApi } from '@/lib/api';
import type { Project, TaskTemplate, CreateTask } from 'shared/types';
import {
  createScriptPlaceholderStrategy,
  ScriptPlaceholderContext,
} from '@/utils/script-placeholders';
import { useUserSystem } from '@/components/config-provider';
import { CopyFilesField } from './copy-files-field';

interface ProjectSetupWizardProps {
  project: Project;
  onComplete: () => void;
  onSkip: () => void;
}

export function ProjectSetupWizard({
  project,
  onComplete,
  onSkip,
}: ProjectSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [setupScript, setSetupScript] = useState(project.setup_script ?? '');
  const [devScript, setDevScript] = useState(project.dev_script ?? '');
  const [cleanupScript, setCleanupScript] = useState(
    project.cleanup_script ?? ''
  );
  const [copyFiles, setCopyFiles] = useState(project.copy_files ?? '');
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    new Set()
  );
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
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
    onUpdateSuccess: () => {
      if (currentStep === 1) {
        setCurrentStep(2);
      }
    },
    onUpdateError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    },
  });

  useEffect(() => {
    if (currentStep === 2) {
      loadTemplates();
    }
  }, [currentStep]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    setError('');
    try {
      const [globalTemplates, projectTemplates] = await Promise.all([
        templatesApi.listGlobal(),
        templatesApi.listByProject(project.id),
      ]);

      const allTemplates = [
        ...globalTemplates.filter((t) => t.project_id === null),
        ...projectTemplates.filter((t) => t.project_id === project.id),
      ];

      setTemplates(allTemplates);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load task templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSaveScripts = useCallback(() => {
    setError('');
    updateProject.mutate({
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
  }, [
    project.id,
    setupScript,
    devScript,
    cleanupScript,
    copyFiles,
    updateProject,
  ]);

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleFinish = async () => {
    setCreatingTasks(true);
    setError('');

    try {
      const tasksToCreate = templates.filter((t) =>
        selectedTemplates.has(t.id)
      );

      for (const template of tasksToCreate) {
        const taskData: CreateTask = {
          project_id: project.id,
          title: template.title,
          description: template.description,
          parent_task_attempt: null,
          image_ids: null,
        };
        await tasksApi.create(taskData);
      }

      onComplete();
    } catch (err) {
      console.error('Failed to create tasks:', err);
      setError('Failed to create tasks from templates');
    } finally {
      setCreatingTasks(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Configure Your Project</h2>
        <p className="text-muted-foreground">
          Set up scripts that will run during your development workflow.
        </p>
      </div>

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
            Runs after creating the worktree and before the coding agent starts
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

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onSkip}>
          Skip Setup
        </Button>
        <Button onClick={handleSaveScripts} disabled={updateProject.isPending}>
          {updateProject.isPending ? 'Saving...' : 'Continue'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Choose Starter Tasks</h2>
        <p className="text-muted-foreground">
          Select templates to create your first tasks (optional)
        </p>
      </div>

      {loadingTemplates ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-muted-foreground border-t-transparent rounded-full"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No task templates available. You can create tasks manually using the
            "C" keyboard shortcut.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedTemplates.has(template.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleToggleTemplate(template.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 mt-1 h-5 w-5 rounded border-2 flex items-center justify-center ${
                    selectedTemplates.has(template.id)
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {selectedTemplates.has(template.id) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{template.title}</div>
                  {template.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {template.project_id === null ? 'Global' : 'Project'}{' '}
                    template
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(1)}
          disabled={creatingTasks}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => setCurrentStep(3)} disabled={creatingTasks}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          You're All Set!
        </h2>
        <p className="text-muted-foreground">
          Your project is configured and ready to use
        </p>
      </div>

      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Quick Tip</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background border text-sm font-mono">
                  <Command className="h-3 w-3" />
                  <span>C</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  Press <strong>C</strong> anytime to quickly create a new task
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedTemplates.size > 0 && (
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="text-sm font-medium mb-2">
              {selectedTemplates.size} task
              {selectedTemplates.size === 1 ? '' : 's'} will be created:
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {templates
                .filter((t) => selectedTemplates.has(t.id))
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" />
                    {t.title}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(2)}
          disabled={creatingTasks}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleFinish} disabled={creatingTasks}>
          {creatingTasks ? 'Creating Tasks...' : 'Finish Setup'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      currentStep === step
                        ? 'bg-primary'
                        : currentStep > step
                          ? 'bg-primary/50'
                          : 'bg-muted-foreground/30'
                    }`}
                  />
                  {step < 3 && (
                    <div
                      className={`h-0.5 w-12 ${
                        currentStep > step
                          ? 'bg-primary/50'
                          : 'bg-muted-foreground/30'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Step {currentStep} of 3
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </CardContent>
      </Card>
    </div>
  );
}
