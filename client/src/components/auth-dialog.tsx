import { useState } from "react";
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
  DialogTrigger,
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
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm" className="gap-2">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Sign In</span>
          </Button>
        )}
      </DialogTrigger>
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
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              required
              minLength={mode === "register" ? 8 : undefined}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
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
              className="text-primary underline-offset-4 hover:underline"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
