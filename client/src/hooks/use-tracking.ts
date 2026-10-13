import { useCallback } from "react";
import { track as trackEvent } from "@/lib/tracker";
import { getVisitorId } from "@/lib/visitor";

type EventType =
  | "register_click" | "share_click" | "sign_in_click" | "sign_up_complete"
  | "vote_intent_submit" | "quote_shuffle" | "quote_hide" | "state_selected" | "external_link";

/** Short, stable referral code for this browser: arrivals with ?ref=<code> are attributed to it. */
export function referralCode(): string {
  return getVisitorId().replace(/^v_/, "").slice(0, 12);
}

/**
 * Event helpers for components. Side-effect free: page-level tracking (page views, visibility,
 * heartbeat, exits, clicks) starts once in App via startTracking().
 */
export function useTracking() {
  const track = useCallback((eventType: EventType, eventData?: Record<string, unknown>) => {
    trackEvent(eventType, eventData);
  }, []);

  // Synchronous on purpose: share windows must open inside the click, or browsers block them.
  const trackShareAction = useCallback((platform: string, contentType: string = "general", sharedUrl?: string) => {
    const code = referralCode();
    trackEvent("share", { platform, contentType, sharedUrl, referralCode: code });
    return code;
  }, []);

  return { track, trackShareAction };
}
