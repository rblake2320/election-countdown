import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ShareTimestamp } from "@/components/share-timestamp";
import { VoteIntentForm } from "@/components/vote-intent-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Vote, History, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

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

  const { data: donations } = useQuery({
    queryKey: ["/api/donations"],
    queryFn: async () => {
      const res = await fetch("/api/donations", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const totalDonated = donations?.reduce((sum: number, d: any) => sum + (parseInt(d.amount) || 0), 0) || 0;
  const isDonor = totalDonated >= 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full p-4 md:p-6 border-b border-border/40">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold">My Profile</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.firstName || "Voter"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {existingIntent ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Vote className="h-5 w-5 text-primary" />
                  Your Voting Intent
                </CardTitle>
                <CardDescription>
                  Last updated: {existingIntent.updatedAt 
                    ? format(new Date(existingIntent.updatedAt), "MMMM d, yyyy 'at' h:mm a")
                    : "Unknown"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {existingIntent.intent === 'red' && '🔴'}
                    {existingIntent.intent === 'blue' && '🔵'}
                    {existingIntent.intent === 'independent' && '🟢'}
                    {existingIntent.intent === 'undecided' && '🟣'}
                  </span>
                  <div>
                    <p className="font-medium capitalize">
                      {existingIntent.intent === 'red' && 'Republican'}
                      {existingIntent.intent === 'blue' && 'Democrat'}
                      {existingIntent.intent === 'independent' && 'Independent'}
                      {existingIntent.intent === 'undecided' && 'Undecided'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {existingIntent.state}
                      {existingIntent.city && `, ${existingIntent.city}`}
                    </p>
                  </div>
                </div>
                
                <VoteIntentForm existingIntent={existingIntent} isDonor={isDonor} />
              </CardContent>
            </Card>

            <ShareTimestamp joinedAt={existingIntent.createdAt} />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Share Your Intent</CardTitle>
              <CardDescription>
                You haven't submitted your voting intention yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoteIntentForm isDonor={isDonor} />
            </CardContent>
          </Card>
        )}

        {donations && donations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Your Contributions
              </CardTitle>
              <CardDescription>
                Thank you for supporting democracy!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-green-600">
                  ${(totalDonated / 100).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {donations.length} donation{donations.length !== 1 ? 's' : ''} total
                </p>
                {isDonor && (
                  <p className="text-sm text-primary">
                    You have access to donor analytics and custom candidate field!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
