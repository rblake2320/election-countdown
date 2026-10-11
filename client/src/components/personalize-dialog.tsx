import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Palette, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { THEMES, DEFAULT_PREFERENCES, applyAppearance, type Preferences } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface PersonalizeDialogProps {
  verified: boolean;
  preferences?: Preferences | null;
  intent?: string | null;
}

/** Appearance perks: open to everyone signed in, editable only for verified (Google/GitHub) accounts. */
export function PersonalizeDialog({ verified, preferences, intent }: PersonalizeDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Preferences>(preferences || DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) setDraft(preferences || DEFAULT_PREFERENCES);
  }, [open, preferences]);

  // Live preview while the dialog is open; the saved look comes back when it closes.
  useEffect(() => {
    applyAppearance(open && verified ? draft : preferences, verified, intent);
  }, [open, draft, preferences, verified, intent]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not save");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setOpen(false);
      toast({ title: "Look saved", description: "Your theme follows you on every device you sign in on." });
    } catch (error) {
      toast({ title: "Not saved", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Personalize" onClick={() => setOpen(true)} data-testid="button-personalize">
        <Palette className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Personalize</DialogTitle>
            <DialogDescription>
              {verified
                ? "Pick a color theme and number style. Saved to your account."
                : "Color themes and 3D numbers are a perk for verified accounts."}
            </DialogDescription>
          </DialogHeader>

          {!verified && (
            <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm" data-testid="personalize-locked">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              Sign out and sign back in with Google or GitHub to verify your email and unlock themes.
            </p>
          )}

          <fieldset disabled={!verified} className={cn("grid gap-4", !verified && "opacity-50")}>
            <div>
              <p className="mb-2 text-sm font-medium">Color theme</p>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, theme: theme.id })}
                    className={cn(
                      "flex items-center gap-2 rounded-md border p-2 text-left text-sm hover:border-primary/50",
                      draft.theme === theme.id && "border-primary ring-1 ring-primary"
                    )}
                    aria-pressed={draft.theme === theme.id}
                    data-testid={`theme-${theme.id}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-full border" aria-hidden="true">
                      <span className="h-full w-1/2" style={{ background: theme.swatch[0] }} />
                      <span className="h-full w-1/2" style={{ background: theme.swatch[1] }} />
                    </span>
                    <span className="flex-1">{theme.label}</span>
                    {draft.theme === theme.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
              {draft.theme === "party" && !intent && verified && (
                <p className="mt-2 text-xs text-muted-foreground">Share your vote plan to see your party colors.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Countdown numbers</p>
              <div className="grid grid-cols-2 gap-2">
                {(["flat", "3d"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setDraft({ ...draft, numbers: style })}
                    className={cn(
                      "rounded-md border p-2 text-sm hover:border-primary/50",
                      draft.numbers === style && "border-primary ring-1 ring-primary"
                    )}
                    aria-pressed={draft.numbers === style}
                    data-testid={`numbers-${style}`}
                  >
                    {style === "flat" ? "Flat" : "3D"}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!verified || saving} data-testid="button-save-preferences">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
