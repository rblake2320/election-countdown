import { useState, useCallback, useRef } from "react";
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
