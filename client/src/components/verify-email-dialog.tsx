import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface VerifyEmailDialogProps {
  email: string;
  verifyWith: { google: boolean; github: boolean };
  trigger: React.ReactNode;
}

/**
 * Email verification = signing in with Google or GitHub on the same address. The API links the
 * provider only when its verified email matches this account (otherwise ?signin_error=email_mismatch).
 */
export function VerifyEmailDialog({ email, verifyWith, trigger }: VerifyEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const returnTo = encodeURIComponent("/" + window.location.hash);
  return (
    <>
      <span onClick={() => setOpen(true)} className="w-full">{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
              <ShieldCheck className="h-5 w-5 text-primary" /> Verify your email
            </DialogTitle>
            <DialogDescription>
              Continue with a Google or GitHub account that uses <strong className="text-foreground">{email}</strong>.
              Verified accounts count in the verified totals and unlock themes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2" data-testid="verify-email-options">
            {verifyWith.google && (
              <Button asChild variant="outline"><a href={`/api/auth/oauth/google/start?returnTo=${returnTo}`} data-testid="button-verify-google">Verify with Google</a></Button>
            )}
            {verifyWith.github && (
              <Button asChild variant="outline"><a href={`/api/auth/oauth/github/start?returnTo=${returnTo}`} data-testid="button-verify-github">Verify with GitHub</a></Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
