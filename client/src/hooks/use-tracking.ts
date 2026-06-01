import { useCallback, useEffect, useRef } from "react";

// Generate a session ID that persists for this browser tab
let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return sessionId;
}

type EventType =
  | "page_view" | "flip" | "view_duration" | "theme_toggle"
  | "register_click" | "share_click" | "share_twitter" | "share_facebook"
  | "share_copy_link" | "share_native" | "share_timestamp"
  | "sign_in_click" | "sign_up_complete" | "vote_intent_submit"
  | "quote_shuffle" | "quote_hide" | "state_select" | "external_link";

/** Fire-and-forget event tracking */
async function trackEvent(eventType: EventType, eventData?: Record<string, unknown>, page?: string) {
  try {
    await fetch("/api/track/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        eventType,
        eventData,
        page: page || window.location.hash || "/",
        sessionId: getSessionId(),
      }),
    });
  } catch {
    // Never block the UI for tracking
  }
}

/** Track a share action and get back a referral code */
async function trackShare(
  platform: string,
  contentType: string,
  sharedUrl?: string
): Promise<string | null> {
  try {
    const res = await fetch("/api/track/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ platform, contentType, sharedUrl }),
    });
    const data = await res.json();
    return data.referralCode || null;
  } catch {
    return null;
  }
}

/** Track a referral visit (when someone arrives via ?ref=CODE) */
async function trackReferral(referralCode: string) {
  try {
    await fetch("/api/track/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ referralCode, sessionId: getSessionId() }),
    });
  } catch {
    // Silent
  }
}

export function useTracking() {
  const viewStartRef = useRef<number>(Date.now());
  const currentViewRef = useRef<string>("home");

  // Track page view on mount
  useEffect(() => {
    trackEvent("page_view");

    // Check for referral code in URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      trackReferral(ref);
    }
  }, []);

  // Track view duration on unmount / visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const duration = Math.round((Date.now() - viewStartRef.current) / 1000);
        trackEvent("view_duration", {
          view: currentViewRef.current,
          durationSeconds: duration,
        });
      } else {
        viewStartRef.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      const duration = Math.round((Date.now() - viewStartRef.current) / 1000);
      // Use sendBeacon for reliability on page close
      const data = JSON.stringify({
        eventType: "view_duration",
        eventData: { view: currentViewRef.current, durationSeconds: duration },
        sessionId: getSessionId(),
      });
      navigator.sendBeacon?.("/api/track/event", new Blob([data], { type: "application/json" }));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const track = useCallback((eventType: EventType, eventData?: Record<string, unknown>) => {
    trackEvent(eventType, eventData);
  }, []);

  const trackShareAction = useCallback(async (
    platform: string,
    contentType: string = "general",
    sharedUrl?: string
  ) => {
    // Track as both a share event and a generic event
    trackEvent(`share_${platform}` as EventType, { contentType });
    const referralCode = await trackShare(platform, contentType, sharedUrl);
    return referralCode;
  }, []);

  const setCurrentView = useCallback((view: string) => {
    // Log duration of previous view
    const duration = Math.round((Date.now() - viewStartRef.current) / 1000);
    if (duration > 1) {
      trackEvent("view_duration", {
        view: currentViewRef.current,
        durationSeconds: duration,
      });
    }
    currentViewRef.current = view;
    viewStartRef.current = Date.now();
  }, []);

  return { track, trackShareAction, setCurrentView };
}
