import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HandMetal } from 'lucide-react';
import {
  BaseCodingAgent,
  EditorType,
  DeviceFlowStartResponse,
  DevicePollStatus,
} from 'shared/types';
import type { ExecutorProfileId } from 'shared/types';
import { useUserSystem } from '@/components/config-provider';
import { githubAuthApi } from '@/lib/api';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import {
  ProgressIndicator,
  AgentConfigStep,
  GitHubLoginStep,
  SafetyNoticeStep,
  FeedbackOptInStep,
} from './onboarding-steps';

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
  const { t } = useTranslation('common');
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

  // Step 4: Feedback opt-in
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

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
          setError(e?.message || 'Login failed.');
          setDeviceState(null);
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
            <DialogTitle>{t('onboarding.welcome.title')}</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            {t('onboarding.welcome.description')}
          </DialogDescription>
        </DialogHeader>

        <ProgressIndicator currentStep={step} totalSteps={4} />

        {step === STEP_AGENT_CONFIG && (
          <AgentConfigStep
            profile={profile}
            profiles={profiles}
            editorType={editorType}
            customCommand={customCommand}
            onProfileChange={setProfile}
            onEditorChange={setEditorType}
            onCustomCommandChange={setCustomCommand}
          />
        )}

        {step === STEP_GITHUB_LOGIN && (
          <GitHubLoginStep
            isAuthenticated={isGitHubAuthenticated}
            username={config?.github?.username || undefined}
            deviceState={deviceState}
            error={error}
            copied={copied}
            fetching={fetching}
            onLogin={handleGitHubLogin}
            onCopyCode={copyToClipboard}
          />
        )}

        {step === STEP_SAFETY_NOTICE && <SafetyNoticeStep />}

        {step === STEP_FEEDBACK_OPTIN && (
          <FeedbackOptInStep
            analyticsEnabled={analyticsEnabled}
            isGitHubAuthenticated={isGitHubAuthenticated}
            onAnalyticsChange={setAnalyticsEnabled}
          />
        )}

        <DialogFooter className="flex gap-2">
          {(step === STEP_GITHUB_LOGIN ||
            step === STEP_SAFETY_NOTICE ||
            step === STEP_FEEDBACK_OPTIN) && (
            <Button variant="outline" onClick={handleStepBack}>
              {t('buttons.back')}
            </Button>
          )}

          <div className="flex-1" />

          {step === STEP_AGENT_CONFIG && (
            <Button
              onClick={handleStepForward}
              disabled={!isStep1Valid}
              className="min-w-24"
            >
              {t('buttons.next')}
            </Button>
          )}

          {step === STEP_GITHUB_LOGIN && (
            <Button
              onClick={handleStepForward}
              variant="outline"
              className="min-w-24"
            >
              {t('buttons.skip')}
            </Button>
          )}

          {step === STEP_SAFETY_NOTICE && (
            <Button onClick={handleStepForward} className="min-w-24">
              {t('onboarding.buttons.understand')}
            </Button>
          )}

          {step === STEP_FEEDBACK_OPTIN && (
            <Button onClick={handleComplete} className="min-w-24">
              {t('onboarding.buttons.complete')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export { UnifiedOnboardingDialog };
