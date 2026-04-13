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
import { Moon, Sun, LogOut, User, LogIn, Share2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isDark, setIsDark] = useState(false);
  const [quoteHidden, setQuoteHidden] = useState(false);
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();

  // Fetch user's existing vote intent if authenticated
  const { data: existingIntent } = useQuery({
    queryKey: ["/api/intent"],
    queryFn: async () => {
      const res = await fetch("/api/intent", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch intent");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Handle Dark Mode — persist preference (safe for iframes that block localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") {
        setIsDark(true);
        document.documentElement.classList.add("dark");
      }
    } catch {
      // localStorage blocked (e.g. sandboxed iframe)
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
    } catch {
      // localStorage blocked
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  // Next upcoming election for milestone banner
  const nextElection = useMemo(() => ({
    date: "2026-11-03T00:00:00",
    title: "2026 Midterm Elections",
  }), []);

  const handleShare = async () => {
    const shareData = {
      title: "Election Countdown",
      text: "Track every second until the next election. Make your vote count!",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500">
      {/* Animated particle background */}
      <AnimatedBackground />

      {/* Abstract patriotic accent - Top Right */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      {/* Abstract patriotic accent - Bottom Left */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header / Nav */}
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="rounded-full hover:bg-secondary w-9 h-9 sm:w-10 sm:h-10"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full hover:bg-secondary w-9 h-9 sm:w-10 sm:h-10"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>

          {/* Auth Section */}
          {authLoading ? (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted animate-pulse" />
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full"
                >
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarImage
                      src={user.profileImageUrl || undefined}
                      alt={user.firstName || "User"}
                    />
                    <AvatarFallback>
                      {user.firstName?.[0] || user.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="#/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>My Profile</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <AuthDialog />
          )}
        </div>
      </header>

      {/* Milestone Banner */}
      <div className="px-4 z-10">
        <MilestoneBanner
          targetDate={nextElection.date}
          electionTitle={nextElection.title}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 md:p-8 z-10 pb-20 sm:pb-24">
        {/* Dual Countdown */}
        <div className="mb-20 sm:mb-24">
          <DualCountdown />
        </div>

        {/* Aggregate Bar */}
        <div className="mb-8 sm:mb-12 w-full">
          <AggregateBar />
        </div>

        {/* Voter Registration CTA */}
        <div className="mb-8 sm:mb-12 w-full px-2">
          <VoterRegistrationCTA />
        </div>

        {/* Vote Intent CTA */}
        {isAuthenticated ? (
          <div className="mb-8 sm:mb-12">
            <VoteIntentForm existingIntent={existingIntent} />
          </div>
        ) : (
          <div className="mb-8 sm:mb-12 text-center">
            <p className="text-muted-foreground text-sm mb-3">
              Sign in to share your voting intention
            </p>
            <AuthDialog
              trigger={
                <Button variant="outline" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in to participate
                </Button>
              }
            />
          </div>
        )}

        {/* Quote Display */}
        <QuoteDisplay
          isHidden={quoteHidden}
          onHide={() => setQuoteHidden(true)}
          onShow={() => setQuoteHidden(false)}
          isAuthenticated={isAuthenticated}
        />
      </main>

      {/* Footer */}
      <footer className="w-full p-4 sm:p-6 text-center text-xs text-muted-foreground z-10 border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <p>
          © {new Date().getFullYear()} Election Countdown. All calculations
          based on Eastern Time.
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          Non-partisan. Your vote, your voice.
        </p>
      </footer>
    </div>
  );
}
