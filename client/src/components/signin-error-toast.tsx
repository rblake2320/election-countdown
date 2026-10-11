import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Codes the API puts in ?signin_error= when a Google/GitHub sign-in or verification fails.
export const SIGNIN_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  invalid_state: "That sign-in link expired. Please try again.",
  unverified_email: "Your account with that provider has no verified email address. Verify it there, or sign in with email.",
  token_exchange_failed: "The provider rejected the sign-in. Please try again.",
  profile_failed: "We couldn't read your profile from the provider. Please try again.",
  provider_error: "The provider couldn't be reached. Please try again.",
  not_configured: "That sign-in option isn't available right now.",
  email_mismatch: "That account uses a different email than the one you're signed in with. Use the account with the same email to verify.",
};

/** Shows why a social sign-in failed (signed in or out), then removes the code from the URL. */
export function SigninErrorToast() {
  const { toast } = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("signin_error");
    if (!code) return;
    toast({ title: "Sign-in didn't complete", description: SIGNIN_ERRORS[code] || "Please try again.", variant: "destructive" });
    params.delete("signin_error");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  }, [toast]);
  return null;
}
