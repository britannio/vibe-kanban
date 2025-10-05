import { AlertTriangle } from 'lucide-react';

export function SafetyNoticeStep() {
  return (
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
              <code className="bg-muted px-1 py-0.5 rounded">--yolo</code> by
              default, giving them unrestricted access to execute code and run
              commands on your system.
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
  );
}
