import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DualCountdown } from "@/components/dual-countdown";
import { QuoteDisplay } from "@/components/quote-display";
import { VoteIntentForm } from "@/components/vote-intent-form";
import { AggregateBar } from "@/components/aggregate-bar";
import { AuthDialog } from "@/components/auth-dialog";
import { VoterRegistrationCTA } from "@/components/voter-registration-cta";
import { MilestoneBanner } from "@/components/milestone-banner";
import { AnimatedBackground } from "@/components/animated-background";
import { ShareDrawer } from "@/components/share-drawer";
import { VerificationBadge } from "@/components/verification-badge";
import { VerificationDialog } from "@/components/verification-dialog";
import { useTracking } from "@/hooks/use-tracking";
import { Moon, Sun, LogOut, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const [isDark, setIsDark] = useState(false);
  const [quoteHidden, setQuoteHidden] = useState(false);
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { track } = useTracking();

  // Fetch verification status (only when signed in)
  const { data: verifyStatus } = useQuery({
    queryKey: ["/api/verify/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/verify/status", {
          credentials: "include",
          signal: AbortSignal.timeout(2000),
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        // No backend — return local user's verification status
        return {
          emailVerified: false,
          phoneVerified: false,
          isFullyVerified: false,
          ecId: user?.ecId || null,
        };
      }
    },
    enabled: isAuthenticated,
  });

  // Fetch user's existing vote intent
  const { data: existingIntent } = useQuery({
    queryKey: ["/api/intent"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/intent", {
          credentials: "include",
          signal: AbortSignal.timeout(2000),
        });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Failed to fetch intent");
        return res.json();
      } catch {
        // No backend — check localStorage
        try {
          const local = localStorage.getItem("ec_vote_intent");
          return local ? JSON.parse(local) : null;
        } catch {
          return null;
        }
      }
    },
    enabled: isAuthenticated,
  });

  // Dark mode persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") {
        setIsDark(true);
        document.documentElement.classList.add("dark");
      }
    } catch {
      // localStorage blocked
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    track("theme_toggle", { to: !isDark ? "dark" : "light" });
  };

  // Next upcoming election for milestone banner
  const nextElection = useMemo(() => ({
    date: "2026-11-03T00:00:00",
    title: "2026 Midterm Elections",
  }), []);

  // Determine what the user has already completed
  const hasVoteIntent = !!existingIntent?.intent;
  const userParty = existingIntent?.intent || null;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500">
      <AnimatedBackground />

      {/* Decorative blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* ─── Header ─── */}
      <header className="w-full p-3 sm:p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex-shrink-0 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold font-serif shadow-md">
            E
          </div>
          <span className="font-serif font-bold text-lg tracking-tight hidden sm:block">
            Election Countdown
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ShareDrawer />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full hover:bg-secondary w-9 h-9 sm:w-10 sm:h-10"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>

          {/* Auth: key forces clean remount when auth state changes */}
          {authLoading ? (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted animate-pulse" />
          ) : isAuthenticated && user ? (
            <DropdownMenu key="user-menu">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full">
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                    <AvatarFallback>{user.firstName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  {verifyStatus && (
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <VerificationBadge
                        emailVerified={verifyStatus.emailVerified}
                        phoneVerified={verifyStatus.phoneVerified}
                        isFullyVerified={verifyStatus.isFullyVerified}
                        size="sm"
                      />
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-none">
                        {user.firstName} {user.lastName}
                      </p>
                      {verifyStatus && (
                        <VerificationBadge
                          emailVerified={verifyStatus.emailVerified}
                          phoneVerified={verifyStatus.phoneVerified}
                          isFullyVerified={verifyStatus.isFullyVerified}
                          showLabel
                          size="sm"
                        />
                      )}
                    </div>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    {verifyStatus?.ecId && (
                      <p className="text-[10px] font-mono text-muted-foreground/70">{verifyStatus.ecId}</p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="#/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>My Profile</span>
                  </a>
                </DropdownMenuItem>
                {!verifyStatus?.isFullyVerified && (
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <VerificationDialog
                      trigger={
                        <button className="flex items-center w-full text-left">
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Verify Identity</span>
                        </button>
                      }
                    />
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <AuthDialog key="sign-in" />
          )}
        </div>
      </header>

      {/* ─── Milestone Banner ─── */}
      <div className="px-4 z-10">
        <MilestoneBanner targetDate={nextElection.date} electionTitle={nextElection.title} />
      </div>

      {/* ─── Main Content (kept simple) ─── */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 md:p-8 z-10 pb-20 sm:pb-24">
        {/* Countdown — always visible, the core of the page */}
        <div className="mb-20 sm:mb-24">
          <DualCountdown />
        </div>

        {/* Aggregate bar — always visible */}
        <div className="mb-8 sm:mb-12 w-full">
          <AggregateBar />
        </div>

        {/*
          Voter Registration CTA — hide once the user has submitted a vote intent
          (if they chose a party/candidate, they're registered or know their plan)
        */}
        {!hasVoteIntent && (
          <div className="mb-8 sm:mb-12 w-full px-2">
            <VoterRegistrationCTA />
          </div>
        )}

        {/*
          Vote Intent — only show if signed in AND hasn't submitted intent yet.
          Once submitted, it's done — they can change it from their profile.
        */}
        {isAuthenticated && !hasVoteIntent && (
          <div className="mb-8 sm:mb-12">
            <VoteIntentForm existingIntent={existingIntent} />
          </div>
        )}

        {/* Quote — random but filtered by user's party when they have one */}
        <QuoteDisplay
          isHidden={quoteHidden}
          onHide={() => { setQuoteHidden(true); track("quote_hide"); }}
          onShow={() => setQuoteHidden(false)}
          isAuthenticated={isAuthenticated}
          userParty={userParty}
        />
      </main>

      {/* ─── Footer ─── */}
      <footer className="w-full p-4 sm:p-6 text-center text-xs text-muted-foreground z-10 border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} Election Countdown. All calculations based on Eastern Time.</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">Non-partisan. Your vote, your voice.</p>
      </footer>
    </div>
  );
}
