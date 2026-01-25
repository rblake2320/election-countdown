import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DualCountdown } from "@/components/dual-countdown";
import { QuoteDisplay } from "@/components/quote-display";
import { VoteIntentForm } from "@/components/vote-intent-form";
import { AggregateBar } from "@/components/aggregate-bar";
import { ShareTimestamp } from "@/components/share-timestamp";
import { Moon, Sun, LogIn, LogOut, User } from "lucide-react";
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
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

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

  // Handle Dark Mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500">
      {/* Abstract patriotic accent - Top Right */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      {/* Abstract patriotic accent - Bottom Left */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header / Nav */}
      <header className="w-full p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold font-serif shadow-lg shadow-primary/20">
            E
          </div>
          <span className="font-serif font-bold text-lg tracking-tight hidden sm:block">
            Election Countdown
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="rounded-full hover:bg-secondary w-10 h-10"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Auth Section */}
          {authLoading ? (
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
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
                  <a href="/api/logout" className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default" size="sm" className="gap-2">
              <a href="/api/login">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </a>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-10 pb-24">
        {/* Dual Countdown */}
        <div className="mb-24">
          <DualCountdown />
        </div>

        {/* Aggregate Bar */}
        <div className="mb-12 w-full">
          <AggregateBar />
        </div>

        {/* Vote Intent CTA */}
        {isAuthenticated ? (
          <div className="mb-12 flex flex-col items-center gap-6">
            <VoteIntentForm existingIntent={existingIntent} />
            
            {/* Share section - only show if user has voted */}
            {existingIntent?.createdAt && (
              <div className="w-full max-w-md">
                <ShareTimestamp joinedAt={existingIntent.createdAt} />
              </div>
            )}
          </div>
        ) : (
          <div className="mb-12 text-center">
            <p className="text-muted-foreground text-sm mb-3">
              Sign in to share your voting intention
            </p>
            <Button asChild variant="outline" className="gap-2">
              <a href="/api/login">
                <LogIn className="h-4 w-4" />
                Sign in to participate
              </a>
            </Button>
          </div>
        )}
        
        {/* Quote Display */}
        <QuoteDisplay />
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center text-xs text-muted-foreground z-10 border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} Election Countdown. All calculations based on Eastern Time.</p>
      </footer>
    </div>
  );
}
