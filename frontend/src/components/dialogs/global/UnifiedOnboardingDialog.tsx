import { useState, useEffect } from 'react';
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
  Settings,
  Github,
  Check,
  Clipboard,
} from 'lucide-react';
import {
  BaseCodingAgent,
  EditorType,
  DeviceFlowStartResponse,
  DevicePollStatus,
} from 'shared/types';
import type { ExecutorProfileId } from 'shared/types';
import { useUserSystem } from '@/components/config-provider';

import { toPrettyCase } from '@/utils/string';
import { githubAuthApi } from '@/lib/api';
import NiceModal, { useModal } from '@ebay/nice-modal-react';

export type UnifiedOnboardingResult = {
  profile: ExecutorProfileId;
  editor: { editor_type: EditorType; custom_command: string | null };
  disclaimerAccepted: boolean;
  analyticsEnabled: boolean;
  githubLoginAcknowledged: boolean;
};

const STEP_AGENT_CONFIG = 1;
const STEP_GITHUB_LOGIN = 2;
const STEP_SAFETY_NOTICE = 3;
const STEP_FEEDBACK_OPTIN = 4;

const UnifiedOnboardingDialog = NiceModal.create(() => {
  const modal = useModal();
  const { profiles, config, githubTokenInvalid, reloadSystem } =
    useUserSystem();

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

  // Step 2: GitHub login
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceState, setDeviceState] =
    useState<null | DeviceFlowStartResponse>(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 3: Safety notice (acknowledgment happens in handleComplete)

  // Step 4: Feedback opt-in
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true); // Default enabled as requested

  const handleStepForward = () => {
    if (step === STEP_AGENT_CONFIG) {
      setStep(STEP_GITHUB_LOGIN);
    } else if (step === STEP_GITHUB_LOGIN) {
      setStep(STEP_SAFETY_NOTICE);
    } else if (step === STEP_SAFETY_NOTICE) {
      setStep(STEP_FEEDBACK_OPTIN);
    }
  };

  const handleStepBack = () => {
    if (step === STEP_GITHUB_LOGIN) {
      setStep(STEP_AGENT_CONFIG);
    } else if (step === STEP_SAFETY_NOTICE) {
      setStep(STEP_GITHUB_LOGIN);
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
      githubLoginAcknowledged: true,
    } as UnifiedOnboardingResult);
  };

  const isStep1Valid =
    editorType !== EditorType.CUSTOM ||
    (editorType === EditorType.CUSTOM && customCommand.trim() !== '');

  const isGitHubAuthenticated =
    !!(config?.github?.username && config?.github?.oauth_token) &&
    !githubTokenInvalid;

  const handleGitHubLogin = async () => {
    setFetching(true);
    setError(null);
    setDeviceState(null);
    try {
      const data = await githubAuthApi.start();
      setDeviceState(data);
      setPolling(true);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Network error');
    } finally {
      setFetching(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.warn('Copy to clipboard failed:', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.warn('Copy to clipboard failed:', err);
    }
  };

  // Poll for GitHub authentication completion
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (polling && deviceState) {
      const poll = async () => {
        try {
          const poll_status = await githubAuthApi.poll();
          switch (poll_status) {
            case DevicePollStatus.SUCCESS:
              setPolling(false);
              setDeviceState(null);
              setError(null);
              await reloadSystem();
              break;
            case DevicePollStatus.AUTHORIZATION_PENDING:
              timer = setTimeout(poll, deviceState.interval * 1000);
              break;
            case DevicePollStatus.SLOW_DOWN:
              timer = setTimeout(poll, (deviceState.interval + 5) * 1000);
              break;
            case DevicePollStatus.ACCESS_DENIED:
              setPolling(false);
              setError('GitHub authorization was denied. You can try again.');
              setDeviceState(null);
              break;
            case DevicePollStatus.EXPIRED_TOKEN:
              setPolling(false);
              setError('Device code expired. Please try again.');
              setDeviceState(null);
              break;
          }
        } catch (e: any) {
          setPolling(false);
          setDeviceState(null);

          const msg = e?.message?.toLowerCase?.() || '';

          if (msg.includes('expired_token') || msg === 'expired_token') {
            setError('Device code expired. Please try again.');
          } else if (msg.includes('access_denied') || msg === 'access_denied') {
            setError(
              'GitHub authorization was denied. No changes were made. You can try again.'
            );
          } else if (
            msg.includes('device_flow_not_started') ||
            msg === 'device_flow_not_started'
          ) {
            setError('Please start GitHub sign-in before polling.');
          } else if (
            msg.includes('tokenresponse') ||
            msg.includes('did not match any variant')
          ) {
            // This is the cryptic octocrab parsing error when user denies - treat as access_denied
            setError(
              'GitHub authorization was denied. No changes were made. You can try again.'
            );
          } else {
            setError(e?.message || 'Login failed. Please try again.');
          }
        }
      };
      timer = setTimeout(poll, deviceState.interval * 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [polling, deviceState, reloadSystem]);

  // Auto-copy code to clipboard when deviceState is set
  useEffect(() => {
    if (deviceState?.user_code) {
      copyToClipboard(deviceState.user_code);
    }
  }, [deviceState?.user_code]);

  return (
    <Dialog open={modal.visible} uncloseable={true}>
      <DialogContent className="sm:max-w-[600px] space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <HandMetal className="h-6 w-6 text-primary text-primary-foreground" />
            <DialogTitle>Welcome to Vibe Kanban</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            Let's get you set up in just four quick steps.
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
            <div
              className={`w-6 h-0.5 ${step > STEP_AGENT_CONFIG ? 'bg-green-500' : 'bg-muted'}`}
            />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                step === STEP_GITHUB_LOGIN
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > STEP_GITHUB_LOGIN
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-transparent text-muted-foreground border-muted-foreground'
              }`}
            >
              {step > STEP_GITHUB_LOGIN ? '✓' : '2'}
            </div>
            <div
              className={`w-6 h-0.5 ${step > STEP_GITHUB_LOGIN ? 'bg-green-500' : 'bg-muted'}`}
            />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                step === STEP_SAFETY_NOTICE
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > STEP_SAFETY_NOTICE
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-transparent text-muted-foreground border-muted-foreground'
              }`}
            >
              {step > STEP_SAFETY_NOTICE ? '✓' : '3'}
            </div>
            <div
              className={`w-6 h-0.5 ${step > STEP_SAFETY_NOTICE ? 'bg-green-500' : 'bg-muted'}`}
            />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                step === STEP_FEEDBACK_OPTIN
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > STEP_FEEDBACK_OPTIN
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-transparent text-muted-foreground border-muted-foreground'
              }`}
            >
              4
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
                      setProfile({
                        executor: v as BaseCodingAgent,
                        variant: null,
                      })
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
                      selectedProfile &&
                      Object.keys(selectedProfile).length > 0;

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
                  This editor will be used to open task attempts and project
                  files.
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
                      Enter the command to run your custom editor. Use spaces
                      for arguments (e.g., "code --wait").
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === STEP_GITHUB_LOGIN && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Github className="h-6 w-6 text-primary text-primary-foreground mt-1 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <h2 className="text-xl font-semibold">
                  Sign in with GitHub (Optional)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Connect your GitHub account to create pull requests directly
                  from Vibe Kanban.
                </p>
              </div>
            </div>

            {isGitHubAuthenticated ? (
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Successfully connected!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You are signed in as{' '}
                  <strong>{config?.github?.username}</strong>
                </p>
              </div>
            ) : deviceState ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-background border rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Go to GitHub Device Authorization
                    </p>
                    <a
                      href={deviceState.verification_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 underline hover:no-underline"
                    >
                      {deviceState.verification_uri}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-background border rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Enter this code:</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold tracking-[0.2em] bg-muted border flex h-9 px-3 items-center rounded">
                        {deviceState.user_code}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(deviceState.user_code)}
                        disabled={copied}
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <Github className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {copied
                      ? 'Code copied! Complete the authorization on GitHub.'
                      : 'Waiting for authorization on GitHub...'}
                  </span>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium">Why connect GitHub?</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Create pull requests from task attempts
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Push changes and create branches automatically
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Streamline your development workflow
                      </span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleGitHubLogin}
                  disabled={fetching}
                  className="w-full"
                >
                  <Github className="h-4 w-4 mr-2" />
                  {fetching ? 'Starting...' : 'Sign in with GitHub'}
                </Button>
              </div>
            )}
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
                    <code className="bg-muted px-1 py-0.5 rounded">
                      --dangerously-skip-permissions
                    </code>{' '}
                    /{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">--yolo</code>{' '}
                    by default, giving them unrestricted access to execute code
                    and run commands on your system.
                  </p>
                  <p>
                    <strong>Important:</strong> Always review what agents are
                    doing and ensure you have backups of important work. This
                    software is experimental - use it responsibly.
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
                <h2 className="text-xl font-semibold">
                  Help Improve Vibe Kanban
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="analytics"
                      checked={analyticsEnabled}
                      onCheckedChange={(checked) =>
                        setAnalyticsEnabled(!!checked)
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="analytics"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Share usage data to help us improve the product
                      </label>
                      <p className="text-sm text-muted-foreground">
                        We collect high-level usage metrics and performance
                        data, but never your code or personal information.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="font-medium">What we collect:</p>
                    <div className="space-y-2">
                      {isGitHubAuthenticated && (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>
                            GitHub profile info for important updates only
                          </span>
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
                        <span>
                          We do NOT collect task contents, code, or project
                          names
                        </span>
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
          {(step === STEP_GITHUB_LOGIN ||
            step === STEP_SAFETY_NOTICE ||
            step === STEP_FEEDBACK_OPTIN) && (
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

          {step === STEP_GITHUB_LOGIN && (
            <Button
              onClick={handleStepForward}
              variant="outline"
              className="min-w-24"
            >
              Skip
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
