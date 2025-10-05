import { Checkbox } from '@/components/ui/checkbox';
import { Shield, CheckCircle, XCircle, Settings } from 'lucide-react';

type FeedbackOptInStepProps = {
  analyticsEnabled: boolean;
  isGitHubAuthenticated: boolean;
  onAnalyticsChange: (enabled: boolean) => void;
};

/**
 * FeedbackOptInStep - Step 4 of the unified onboarding flow
 * 
 * Allows users to opt in or out of anonymous usage data collection and telemetry.
 * The checkbox is enabled by default to encourage users to help improve the product.
 * 
 * Features:
 * - Clear explanation of what data is collected
 * - Transparency about GitHub profile usage (context-aware based on auth status)
 * - Explicit statement of what is NOT collected
 * - Reminder that settings can be changed later
 * 
 * @param analyticsEnabled - Current analytics opt-in status
 * @param isGitHubAuthenticated - Whether user is signed in with GitHub
 * @param onAnalyticsChange - Callback when analytics preference changes
 */
export function FeedbackOptInStep({
  analyticsEnabled,
  isGitHubAuthenticated,
  onAnalyticsChange,
}: FeedbackOptInStepProps) {
  return (
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
                onCheckedChange={(checked) => onAnalyticsChange(!!checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="analytics"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Share usage data to help us improve the product
                </label>
                <p className="text-sm text-muted-foreground">
                  We collect high-level usage metrics and performance data, but
                  never your code or personal information.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <p className="font-medium">What we collect:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    GitHub profile info for important updates only
                    {!isGitHubAuthenticated && (
                      <span className="text-muted-foreground"> (when signed in)</span>
                    )}
                  </span>
                </div>
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
                    We do NOT collect task contents, code, or project names
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span>You can change this preference anytime in Settings.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
