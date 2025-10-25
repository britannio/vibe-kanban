import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

interface ReadyContentProps {
  url?: string;
  iframeKey: string;
  onIframeError: () => void;
  onUrlChange?: (url: string) => void;
}

export function ReadyContent({
  url,
  iframeKey,
  onIframeError,
  onUrlChange,
}: ReadyContentProps) {
  const { t } = useTranslation('tasks');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !onUrlChange) return;

    const updateUrl = () => {
      try {
        // Access iframe's current location (works for same-origin iframes)
        const currentUrl = iframe.contentWindow?.location.href;
        if (currentUrl && currentUrl !== 'about:blank') {
          onUrlChange(currentUrl);
        }
      } catch (e) {
        // Cross-origin iframe - can't access location
        // This is expected for external URLs
      }
    };

    // Update URL when iframe loads
    const handleLoad = () => {
      updateUrl();
    };

    iframe.addEventListener('load', handleLoad);

    // Poll for URL changes (for client-side routing)
    const intervalId = setInterval(() => {
      updateUrl();
    }, 500);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      clearInterval(intervalId);
    };
  }, [onUrlChange]);

  return (
    <div className="flex-1">
      <iframe
        ref={iframeRef}
        key={iframeKey}
        src={url}
        title={t('preview.iframe.title')}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        referrerPolicy="no-referrer"
        onError={onIframeError}
      />
    </div>
  );
}
