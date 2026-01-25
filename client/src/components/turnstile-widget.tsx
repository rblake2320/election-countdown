import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = "auto",
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const loadScript = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (window.turnstile) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const initWidget = async () => {
      await loadScript();
      
      if (!mounted || !containerRef.current || !window.turnstile) return;

      // Clear any existing widget
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        "error-callback": onError,
        "expired-callback": onExpire,
        theme,
      });
    };

    initWidget();

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, onVerify, onError, onExpire, theme, loadScript]);

  return <div ref={containerRef} className={className} />;
}

// Placeholder component when no site key is configured
export function TurnstilePlaceholder() {
  return (
    <div className="text-xs text-muted-foreground text-center py-2">
      Bot protection available when configured
    </div>
  );
}
