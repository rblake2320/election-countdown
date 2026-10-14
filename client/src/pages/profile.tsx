import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, DollarSign, History, LogOut, Share2, ShieldCheck, ShieldAlert, Trash2, Vote } from "lucide-react";
import { ShareTimestamp } from "@/components/share-timestamp";
import { LiveProfileSettings } from "@/components/live-profile-settings";
import { VoteIntentForm } from "@/components/vote-intent-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { referralCode } from "@/hooks/use-tracking";
import { ELECTIONS, type VotableElectionId } from "@/lib/elections";

const INTENT_LABELS: Record<string, string> = { red: "Republican", blue: "Democrat", independent: "Independent", undecided: "Undecided" };
const INTENT_DOT: Record<string, string> = { red: "bg-red-600", blue: "bg-blue-600", independent: "bg-violet-600", undecided: "bg-slate-500" };
const VOTABLE = ELECTIONS.filter((e, i, all) => all.findIndex((x) => x.votesFor === e.votesFor) === i)
  .map((e) => ({ id: e.votesFor as VotableElectionId, title: e.title }));

interface Intent { electionId: VotableElectionId; intent: string; state: string; city?: string | null; ageRange?: string | null; sex?: string | null; customCandidate?: string | null; createdAt: string; updatedAt: string }
interface HistoryItem { id: string; electionId: string; previousIntent: string | null; newIntent: string; previousState: string | null; newState: string; changedAt: string }
interface AccountData { intents: Record<string, Intent>; intentHistory: HistoryItem[] }

const when = (value?: string | null) => (value ? format(new Date(value), "MMM d, yyyy 'at' h:mm a") : "Unknown");
const electionTitle = (id: string) => VOTABLE.find((e) => e.id === id)?.title ?? id;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: account } = useQuery<AccountData>({
    queryKey: ["/api/account"],
    queryFn: async () => {
      const res = await fetch("/api/account", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load account");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: donations } = useQuery({
    queryKey: ["/api/donations"],
    queryFn: async () => {
      const res = await fetch("/api/donations", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  const totalDonated = donations?.reduce((sum: number, d: any) => sum + (parseInt(d.amount) || 0), 0) || 0;
  const isDonor = totalDonated >= 100;

  const share = async () => {
    const url = `${window.location.origin}/?ref=${referralCode()}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Election Countdown", url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Your share link is on the clipboard." });
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Could not delete");
      queryClient.clear();
      toast({ title: "Account deleted", description: "Your account, vote plans and history have been removed." });
      window.location.assign("/");
    } catch (error) {
      toast({ title: "Not deleted", description: (error as Error).message, variant: "destructive" });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const midterm = account?.intents?.["midterm-2026"];

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full p-4 md:p-6 border-b border-border/40">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Back to countdown" data-testid="button-back-home">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold">My Profile</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user.firstName || "Voter"}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={share} data-testid="button-profile-share">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => { logout(); setLocation("/"); }} data-testid="button-profile-logout">
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <LiveProfileSettings />
        <Card data-testid="card-account-details">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Account
              {user.emailVerified ? (
                <span className="flex items-center gap-1 text-sm font-medium text-green-700"><ShieldCheck className="h-4 w-4" /> Verified</span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-medium text-amber-700"><ShieldAlert className="h-4 w-4" /> Unverified</span>
              )}
            </CardTitle>
            {!user.emailVerified && (
              <CardDescription>Sign in with Google or GitHub to verify your email and count in the verified totals.</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt><dd>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</dd>
              <dt className="text-muted-foreground">Email</dt><dd className="break-all">{user.email}</dd>
              <dt className="text-muted-foreground">EC-ID</dt><dd className="font-mono">{user.ecId}</dd>
              <dt className="text-muted-foreground">Joined</dt><dd>{when(user.createdAt)}</dd>
            </dl>
          </CardContent>
        </Card>

        {VOTABLE.map((election) => {
          const intent = account?.intents?.[election.id];
          return (
            <Card key={election.id} data-testid={`card-plan-${election.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Vote className="h-5 w-5 text-primary" /> {election.title}</CardTitle>
                <CardDescription>{intent ? `Last updated ${when(intent.updatedAt)}` : "No plan shared for this election yet."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {intent && (
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${INTENT_DOT[intent.intent] || "bg-muted"}`} aria-hidden="true" />
                    <div>
                      <p className="font-medium">{INTENT_LABELS[intent.intent] || intent.intent}</p>
                      <p className="text-sm text-muted-foreground">{[intent.state, intent.city].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                )}
                <VoteIntentForm existingIntent={intent} isDonor={isDonor} electionId={election.id} />
              </CardContent>
            </Card>
          );
        })}

        {midterm && <ShareTimestamp joinedAt={midterm.createdAt} />}

        <Card data-testid="card-history">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Change history</CardTitle>
          </CardHeader>
          <CardContent>
            {account?.intentHistory?.length ? (
              <ul className="space-y-2 text-sm">
                {account.intentHistory.map((item) => (
                  <li key={item.id} className="border-b pb-2 last:border-0">
                    <span className="text-muted-foreground">{when(item.changedAt)} · {electionTitle(item.electionId)}</span>
                    <br />
                    {item.previousIntent
                      ? <>Changed from {INTENT_LABELS[item.previousIntent]} ({item.previousState}) to <strong>{INTENT_LABELS[item.newIntent]}</strong> ({item.newState})</>
                      : <>Set to <strong>{INTENT_LABELS[item.newIntent]}</strong> in {item.newState}</>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{account ? "No changes yet." : "Loading…"}</p>
            )}
          </CardContent>
        </Card>

        {donations && donations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" /> Your Contributions</CardTitle>
              <CardDescription>Thank you for supporting democracy!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-bold text-green-600">${(totalDonated / 100).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{donations.length} donation{donations.length !== 1 ? "s" : ""} total</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-destructive/30" data-testid="card-delete-account">
          <CardHeader>
            <CardTitle className="text-base">Delete account</CardTitle>
            <CardDescription>Permanently removes your account, every vote plan, your history and your sign-in links. This cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="gap-2" onClick={() => setConfirmDelete(true)} data-testid="button-delete-account">
              <Trash2 className="h-4 w-4" /> Delete my account
            </Button>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account ({user.email}), all vote plans, change history and Google/GitHub links will be deleted immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); deleteAccount(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
