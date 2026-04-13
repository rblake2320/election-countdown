import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ShieldCheck, Mail, Phone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type Step = "choose" | "email-send" | "email-verify" | "phone-send" | "phone-verify" | "done";

export function VerificationDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: verifyStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/verify/status"],
    queryFn: async () => {
      const res = await fetch("/api/verify/status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const sendEmailCode = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/verify/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setStep("email-verify");
      setCode("");
      setError(null);
      if (data.devCode) setDevCode(data.devCode);
    },
    onError: (err: Error) => setError(err.message),
  });

  const confirmEmailCode = useMutation({
    mutationFn: async (verifyCode: string) => {
      const res = await fetch("/api/verify/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setError(null);
      if (data.isFullyVerified) {
        setStep("done");
        toast({ title: "Fully Verified", description: "Your account is now fully verified." });
      } else {
        setStep("choose");
        toast({ title: "Email Verified", description: "Now verify your phone for full verification." });
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const sendPhoneCode = useMutation({
    mutationFn: async (phoneNum: string) => {
      const res = await fetch("/api/verify/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phoneNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setStep("phone-verify");
      setCode("");
      setError(null);
      if (data.devCode) setDevCode(data.devCode);
    },
    onError: (err: Error) => setError(err.message),
  });

  const confirmPhoneCode = useMutation({
    mutationFn: async (verifyCode: string) => {
      const res = await fetch("/api/verify/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setError(null);
      if (data.isFullyVerified) {
        setStep("done");
        toast({ title: "Fully Verified", description: "Your account is now fully verified." });
      } else {
        setStep("choose");
        toast({ title: "Phone Verified", description: "Now verify your email for full verification." });
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const emailDone = verifyStatus?.emailVerified;
  const phoneDone = verifyStatus?.phoneVerified;
  const fullyVerified = verifyStatus?.isFullyVerified;

  const renderStep = () => {
    switch (step) {
      case "choose":
        return (
          <div className="space-y-4">
            {fullyVerified ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-600">Fully Verified</p>
                <p className="text-xs text-muted-foreground text-center">
                  Your identity has been verified via email and phone.
                  <br />EC-ID: <span className="font-mono font-bold">{verifyStatus?.ecId}</span>
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Verify your identity to get a trust badge on your profile.
                  Both email and phone verification are required for full verification.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => sendEmailCode.mutate()}
                    disabled={emailDone || sendEmailCode.isPending}
                    className="w-full justify-start gap-3"
                    variant={emailDone ? "outline" : "default"}
                  >
                    {sendEmailCode.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : emailDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {emailDone ? "Email Verified" : "Verify Email"}
                    {emailDone && <span className="ml-auto text-xs text-green-600">Done</span>}
                  </Button>

                  <Button
                    onClick={() => setStep("phone-send")}
                    disabled={phoneDone}
                    className="w-full justify-start gap-3"
                    variant={phoneDone ? "outline" : "default"}
                  >
                    {phoneDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                    {phoneDone ? "Phone Verified" : "Verify Phone"}
                    {phoneDone && <span className="ml-auto text-xs text-green-600">Done</span>}
                  </Button>
                </div>
              </>
            )}
          </div>
        );

      case "email-verify":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium">{user?.email}</span>
            </p>
            {devCode && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs">
                <span className="font-medium text-yellow-700">Dev mode:</span>{" "}
                <span className="font-mono">{devCode}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email-code">Verification Code</Label>
              <Input
                id="email-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl font-mono tracking-[0.5em]"
                autoComplete="one-time-code"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("choose"); setError(null); setDevCode(null); }} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => confirmEmailCode.mutate(code)}
                disabled={code.length !== 6 || confirmEmailCode.isPending}
                className="flex-1"
              >
                {confirmEmailCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify
              </Button>
            </div>
          </div>
        );

      case "phone-send":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your phone number to receive a verification code via SMS.
            </p>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("choose"); setError(null); }} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => sendPhoneCode.mutate(phone)}
                disabled={phone.length < 10 || sendPhoneCode.isPending}
                className="flex-1"
              >
                {sendPhoneCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Code
              </Button>
            </div>
          </div>
        );

      case "phone-verify":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium">{phone}</span>
            </p>
            {devCode && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs">
                <span className="font-medium text-yellow-700">Dev mode:</span>{" "}
                <span className="font-mono">{devCode}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone-code">Verification Code</Label>
              <Input
                id="phone-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl font-mono tracking-[0.5em]"
                autoComplete="one-time-code"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("choose"); setError(null); setDevCode(null); }} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => confirmPhoneCode.mutate(code)}
                disabled={code.length !== 6 || confirmPhoneCode.isPending}
                className="flex-1"
              >
                {confirmPhoneCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify
              </Button>
            </div>
          </div>
        );

      case "done":
        return (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-green-600">Fully Verified</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Your account is fully verified. You now have a trust badge visible to other users.
            </p>
            <Button onClick={() => setOpen(false)} className="mt-2">
              Done
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setStep("choose"); setError(null); setDevCode(null); setCode(""); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Verify Identity
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {step === "done" ? "Verification Complete" : "Verify Your Identity"}
          </DialogTitle>
          <DialogDescription>
            Build trust with other users by verifying your email and phone
          </DialogDescription>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
