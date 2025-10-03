import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sparkles, 
  Code, 
  ChevronDown, 
  HandMetal, 
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';
import { BaseCodingAgent, EditorType } from 'shared/types';
import type { ExecutorProfileId } from 'shared/types';
import { useUserSystem } from '@/components/config-provider';

import { toPrettyCase } from '@/utils/string';
import NiceModal, { useModal } from '@ebay/nice-modal-react';

export type UnifiedOnboardingResult = {
  profile: ExecutorProfileId;
  editor: { editor_type: EditorType; custom_command: string | null };
  disclaimerAccepted: boolean;
  analyticsEnabled: boolean;
};

const STEP_AGENT_CONFIG = 1;
const STEP_SAFETY_NOTICE = 2;
const STEP_FEEDBACK_OPTIN = 3;

const UnifiedOnboardingDialog = NiceModal.create(() => {
  const modal = useModal();
  const { profiles, config } = useUserSystem();

  const [step, setStep] = useState(STEP_AGENT_CONFIG);
  
  // Step 1: Agent & Editor configuration
  const [profile, setProfile] = useState<ExecutorProfileId>(
    config?.executor_profile || {
      executor: BaseCodingAgent.CLAUDE_CODE,
      variant: null,
    }
  );
  const [editorType, setEditorType] = useState<EditorType>(EditorType.VS_CODE);
  const [customCommand, setCustomCommand] = useState<string>('');

  // Step 2: Safety notice & feedback opt-in
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true); // Default enabled as requested

  const handleStepForward = () => {
    if (step === STEP_AGENT_CONFIG) {
      setStep(STEP_SAFETY_NOTICE);
    } else if (step === STEP_SAFETY_NOTICE) {
      setStep(STEP_FEEDBACK_OPTIN);
    }
  };

  const handleStepBack = () => {
    if (step === STEP_SAFETY_NOTICE) {
      setStep(STEP_AGENT_CONFIG);
    } else if (step === STEP_FEEDBACK_OPTIN) {
      setStep(STEP_SAFETY_NOTICE);
    }
  };

  const handleComplete = () => {
    modal.resolve({
      profile,
      editor: {
        editor_type: editorType,
        custom_command:
          editorType === EditorType.CUSTOM ? customCommand || null : null,
      },
      disclaimerAccepted: true,
      analyticsEnabled,
    } as UnifiedOnboardingResult);
  };

  const isStep1Valid =
    editorType !== EditorType.CUSTOM ||
    (editorType === EditorType.CUSTOM && customCommand.trim() !== '');

  // Check if user is authenticated with GitHub for step 2 display
  const isGitHubAuthenticated =
    config?.github?.username && config?.github?.oauth_token;

  return (
    <Dialog open={modal.visible} uncloseable={true}>
      <DialogContent className="sm:max-w-[600px] space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <HandMetal className="h-6 w-6 text-primary text-primary-foreground" />
            <DialogTitle>Welcome to Vibe Kanban</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            Let's get you set up in just three quick steps.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                step === STEP_AGENT_CONFIG
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > STEP_AGENT_CONFIG
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-transparent text-muted-foreground border-muted-foreground'
              }`}
            >
              {step > STEP_AGENT_CONFIG ? '✓' : '1'}
            </div>
            <div className={`w-8 h-0.5 ${step > STEP_AGENT_CONFIG ? 'bg-green-500' : 'bg-muted'}`} />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                step === STEP_SAFETY_NOTICE
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > STEP_SAFETY_NOTICE
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-transparent text-muted-foreground border-muted-foreground'
              }`}
            >
              {step > STEP_SAFETY_NOTICE ? '✓' : '2'}
            </div>
            <div className={`w-8 h-0.5 ${step > STEP_SAFETY_NOTICE ? 'bg-green-500' : 'bg-muted'}`} />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                step === STEP_FEEDBACK_OPTIN
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > STEP_FEEDBACK_OPTIN
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-transparent text-muted-foreground border-muted-foreground'
              }`}
            >
              3
            </div>
          </div>
        </div>

        {step === STEP_AGENT_CONFIG && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Choose Your Coding Agent
              </h2>
              <div className="space-y-2">
                <Label htmlFor="profile">Default Agent</Label>
                <div className="flex gap-2">
                  <Select
                    value={profile.executor}
                    onValueChange={(v) =>
                      setProfile({ executor: v as BaseCodingAgent, variant: null })
                    }
                  >
                    <SelectTrigger id="profile" className="flex-1">
                      <SelectValue placeholder="Select your preferred coding agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles &&
                        (Object.keys(profiles) as BaseCodingAgent[]).map(
                          (agent) => (
                            <SelectItem key={agent} value={agent}>
                              {agent}
                            </SelectItem>
                          )
                        )}
                    </SelectContent>
                  </Select>

                  {/* Show variant selector if selected profile has variants */}
                  {(() => {
                    const selectedProfile = profiles?.[profile.executor];
                    const hasVariants =
                      selectedProfile && Object.keys(selectedProfile).length > 0;

                    if (hasVariants) {
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-24 px-2 flex items-center justify-between"
                            >
                              <span className="text-xs truncate flex-1 text-left">
                                {profile.variant || 'DEFAULT'}
                              </span>
                              <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {Object.keys(selectedProfile).map((variant) => (
                              <DropdownMenuItem
                                key={variant}
                                onClick={() =>
                                  setProfile({
                                    ...profile,
                                    variant: variant,
                                  })
                                }
                                className={
                                  profile.variant === variant ? 'bg-accent' : ''
                                }
                              >
                                {variant}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    } else if (selectedProfile) {
                      return (
                        <Button
                          variant="outline"
                          className="w-24 px-2 flex items-center justify-between"
                          disabled
                        >
                          <span className="text-xs truncate flex-1 text-left">
                            Default
                          </span>
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl flex items-center gap-2">
                <Code className="h-4 w-4" />
                Choose Your Code Editor
              </h2>

              <div className="space-y-2">
                <Label htmlFor="editor">Preferred Editor</Label>
                <Select
                  value={editorType}
                  onValueChange={(value: EditorType) => setEditorType(value)}
                >
                  <SelectTrigger id="editor">
                    <SelectValue placeholder="Select your preferred editor" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(EditorType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {toPrettyCase(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This editor will be used to open task attempts and project files.
                </p>

                {editorType === EditorType.CUSTOM && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-command">Custom Command</Label>
                    <Input
                      id="custom-command"
                      placeholder="e.g., code, subl, vim"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter the command to run your custom editor. Use spaces for
                      arguments (e.g., "code --wait").
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === STEP_SAFETY_NOTICE && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive mt-1 flex-shrink-0" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Safety Notice</h2>
                <div className="space-y-3 text-sm">
                  <p>
                    Vibe Kanban runs AI coding agents with{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">--dangerously-skip-permissions</code> / <code className="bg-muted px-1 py-0.5 rounded">--yolo</code>{' '}
                    by default, giving them unrestricted access to execute code and
                    run commands on your system.
                  </p>
                  <p>
                    <strong>Important:</strong> Always review what agents are doing
                    and ensure you have backups of important work. This software is
                    experimental - use it responsibly.
                  </p>
                  <p>
                    Learn more at{' '}
                    <a
                      href="https://www.vibekanban.com/docs/getting-started#safety-notice"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
                    >
                      our safety documentation
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === STEP_FEEDBACK_OPTIN && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="h-6 w-6 text-primary text-primary-foreground mt-1 flex-shrink-0" />
              <div className="space-y-4 flex-1">
                <h2 className="text-xl font-semibold">Help Improve Vibe Kanban</h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="analytics"
                      checked={analyticsEnabled}
                      onCheckedChange={(checked) => setAnalyticsEnabled(!!checked)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="analytics"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Share usage data to help us improve the product
                      </label>
                      <p className="text-sm text-muted-foreground">
                        We collect high-level usage metrics and performance data, but never your code or personal information.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="font-medium">What we collect:</p>
                    <div className="space-y-2">
                      {isGitHubAuthenticated && (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>GitHub profile info for important updates only</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>High-level usage metrics and feature usage</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Performance and error data</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <span>We do NOT collect task contents, code, or project names</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <Settings className="h-4 w-4 flex-shrink-0" />
                    <span>
                      You can change this preference anytime in Settings.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {(step === STEP_SAFETY_NOTICE || step === STEP_FEEDBACK_OPTIN) && (
            <Button variant="outline" onClick={handleStepBack}>
              Back
            </Button>
          )}
          
          <div className="flex-1" />
          
          {step === STEP_AGENT_CONFIG && (
            <Button
              onClick={handleStepForward}
              disabled={!isStep1Valid}
              className="min-w-24"
            >
              Next
            </Button>
          )}

          {step === STEP_SAFETY_NOTICE && (
            <Button onClick={handleStepForward} className="min-w-24">
              I Understand, Continue
            </Button>
          )}

          {step === STEP_FEEDBACK_OPTIN && (
            <Button onClick={handleComplete} className="min-w-24">
              Complete Setup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export { UnifiedOnboardingDialog };
