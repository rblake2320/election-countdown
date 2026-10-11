import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTracking } from "@/hooks/use-tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, Loader2 } from "lucide-react";

const SIGNIN_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  invalid_state: "That sign-in link expired. Please try again.",
  unverified_email: "Your account with that provider has no verified email address. Verify it there, or sign in with email.",
  token_exchange_failed: "The provider rejected the sign-in. Please try again.",
  profile_failed: "We couldn't read your profile from the provider. Please try again.",
  provider_error: "The provider couldn't be reached. Please try again.",
  not_configured: "That sign-in option isn't available right now.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
    </svg>
  );
}

interface AuthDialogProps {
  trigger?: React.ReactNode;
  defaultMode?: "login" | "register";
}

export function AuthDialog({ trigger, defaultMode = "login" }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const { track } = useTracking();

  const isPending = isLoggingIn || isRegistering;

  // Which social providers the server has credentials for; buttons stay hidden otherwise.
  const { data: providers } = useQuery<{ google: boolean; github: boolean }>({
    queryKey: ["/api/auth/providers"],
    queryFn: async () => {
      const res = await fetch("/api/auth/providers");
      return res.ok ? res.json() : { google: false, github: false };
    },
    staleTime: 5 * 60 * 1000,
  });
  const returnTo = "/" + window.location.hash;

  // A failed social sign-in comes back as ?signin_error=<code>: reopen the dialog with the reason.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("signin_error");
    if (!code) return;
    setError(SIGNIN_ERRORS[code] || "Sign-in failed. Please try again.");
    setOpen(true);
    params.delete("signin_error");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  }, []);

  // Track pointer state to prevent double-fire
  const pointerFiredRef = useRef(false);

  // Manual open handler — fires on BOTH pointerdown and click for maximum
  // reliability. Radix DropdownMenu's close animation injects a global
  // pointerdown blocker that can eat clicks on freshly-mounted elements.
  const handleOpen = useCallback(() => {
    if (open) return; // already open
    setOpen(true);
  }, [open]);

  const handlePointerDown = useCallback(() => {
    pointerFiredRef.current = true;
    handleOpen();
  }, [handleOpen]);

  const handleClick = useCallback(() => {
    // If pointerdown already opened it, skip
    if (pointerFiredRef.current) {
      pointerFiredRef.current = false;
      return;
    }
    handleOpen();
  }, [handleOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === "login") {
        await login({ email, password });
        track("sign_in_click");
      } else {
        await register({ email, password, firstName, lastName });
        track("sign_up_complete");
      }
      setOpen(false);
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  // Explicit mode switch — fixes Bug #4 (Create one link not toggling)
  const switchMode = useCallback(() => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setError(null);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset form when closing
      setError(null);
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setMode(defaultMode);
    }
  }, [defaultMode]);

  return (
    <>
      {/* Trigger — uses direct onClick instead of DialogTrigger for iframe compatibility */}
      {trigger ? (
        <span onClick={handleOpen} style={{ cursor: "pointer" }}>
          {trigger}
        </span>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Sign In</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {mode === "login" ? "Sign In" : "Create Account"}
            </DialogTitle>
            <DialogDescription>
              {mode === "login"
                ? "Sign in to share your voting intention"
                : "Create an account to participate"}
            </DialogDescription>
          </DialogHeader>

          {(providers?.google || providers?.github) && (
            <div className="mt-4 grid gap-2" data-testid="social-signin">
              {providers?.google && (
                <Button asChild variant="outline" className="w-full gap-2">
                  <a href={`/api/auth/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`} data-testid="button-signin-google" onClick={() => track("sign_in_click", { method: "google" })}>
                    <GoogleMark /> Continue with Google
                  </a>
                </Button>
              )}
              {providers?.github && (
                <Button asChild variant="outline" className="w-full gap-2">
                  <a href={`/api/auth/oauth/github/start?returnTo=${encodeURIComponent(returnTo)}`} data-testid="button-signin-github" onClick={() => track("sign_in_click", { method: "github" })}>
                    <GitHubMark /> Continue with GitHub
                  </a>
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">Signing in with Google or GitHub verifies your email, so your vote counts in the verified totals.</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="auth-firstName">First Name</Label>
                  <Input
                    id="auth-firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-lastName">Last Name</Label>
                  <Input
                    id="auth-lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="text-primary font-medium underline-offset-4 hover:underline focus:outline-none focus:underline"
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
