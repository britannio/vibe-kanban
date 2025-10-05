import { Button } from '@/components/ui/button';
import { Github, Check, Clipboard } from 'lucide-react';
import type { DeviceFlowStartResponse } from 'shared/types';

type GitHubLoginStepProps = {
  isAuthenticated: boolean;
  username?: string;
  deviceState: DeviceFlowStartResponse | null;
  error: string | null;
  copied: boolean;
  fetching: boolean;
  onLogin: () => void;
  onCopyCode: (code: string) => void;
};

/**
 * GitHubLoginStep - Step 2 of the unified onboarding flow
 *
 * Optional GitHub OAuth authentication using device flow. Users can skip this step
 * and continue with the onboarding process.
 *
 * Features:
 * - GitHub device flow authentication (OAuth without redirect)
 * - Auto-copy device code to clipboard
 * - Three states: unauthenticated, authenticating (with device code), authenticated
 * - Clear benefits explanation for connecting GitHub
 * - User-friendly error handling for denied/expired auth
 *
 * @param isAuthenticated - Whether user is already authenticated with GitHub
 * @param username - GitHub username if authenticated
 * @param deviceState - Device flow state (contains verification URL and code)
 * @param error - Error message to display
 * @param copied - Whether device code was copied to clipboard
 * @param fetching - Whether authentication flow is starting
 * @param onLogin - Callback to initiate GitHub login
 * @param onCopyCode - Callback to copy device code to clipboard
 */
export function GitHubLoginStep({
  isAuthenticated,
  username,
  deviceState,
  error,
  copied,
  fetching,
  onLogin,
  onCopyCode,
}: GitHubLoginStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Github className="h-6 w-6 text-primary text-primary-foreground mt-1 flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <h2 className="text-xl font-semibold">
            Sign in with GitHub (Optional)
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect your GitHub account to create pull requests directly from
            Vibe Kanban.
          </p>
        </div>
      </div>

      {isAuthenticated ? (
        <div className="bg-muted/50 border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Check className="h-5 w-5 text-green-500" />
            <span className="font-medium">Successfully connected!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            You are signed in as <strong>{username}</strong>
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
                  onClick={() => onCopyCode(deviceState.user_code)}
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

          <Button onClick={onLogin} disabled={fetching} className="w-full">
            <Github className="h-4 w-4 mr-2" />
            {fetching ? 'Starting...' : 'Sign in with GitHub'}
          </Button>
        </div>
      )}
    </div>
  );
}
