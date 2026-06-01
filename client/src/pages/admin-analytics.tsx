import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BarChart3, Lock, Users, Download, LogIn, Clock, MousePointerClick, TrendingUp, type LucideIcon } from "lucide-react";

interface AdminAnalyticsData {
  votesByIntent: {
    red: number;
    blue: number;
    independent: number;
    undecided: number;
    total: number;
  };
  votesOverTime: Record<string, number>;
  sessionStats: {
    totalLogins: number;
    uniqueActiveUsersToday: number;
    avgSessionDurationSeconds: number;
  };
  flipStats: { date: string; count: number }[];
  donationStats: {
    totalDonations: number;
    totalAmount: number;
    analyticsOptInCount: number;
  };
  voteSwitching: {
    usersWhoSwitched: number;
    totalSwitches: number;
  };
  thresholdMet: boolean;
  currentThreshold: number;
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  testId: string;
}

function StatCard({ icon: Icon, label, value, testId }: StatCardProps) {
  return (
    <Card data-testid={`card-${testId}`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold" data-testid={`text-${testId}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function AdminAnalytics() {
  const [, navigate] = useLocation();
  const [adminSecret, setAdminSecret] = useState("");
  const [enteredSecret, setEnteredSecret] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, error } = useQuery<AdminAnalyticsData>({
    queryKey: ["/api/admin/analytics", enteredSecret],
    queryFn: async () => {
      if (!enteredSecret) throw new Error("No secret");
      const res = await fetch("/api/admin/analytics", {
        headers: { "x-admin-secret": enteredSecret },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Invalid admin credentials");
      return res.json();
    },
    enabled: !!enteredSecret,
    retry: false,
  });

  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/admin/export/votes.csv", {
        headers: { "x-admin-secret": enteredSecret },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "votes_export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Admin Analytics</h1>
          </div>
        </div>

        {!enteredSecret ? (
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-4 w-4" />
                Admin Access
              </CardTitle>
              <CardDescription>Enter your admin secret to view analytics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="password"
                placeholder="Admin secret"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setEnteredSecret(adminSecret)}
                data-testid="input-admin-secret"
              />
              <Button
                className="w-full"
                onClick={() => setEnteredSecret(adminSecret)}
                disabled={!adminSecret}
                data-testid="button-admin-unlock"
              >
                Unlock Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <Card className="max-w-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive mb-3">Invalid admin secret.</p>
              <Button
                variant="outline"
                onClick={() => { setEnteredSecret(""); setAdminSecret(""); }}
                data-testid="button-retry"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : data ? (
          <div className="space-y-6">
            {/* Session Stats */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Session Activity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon={LogIn} label="Total Logins" value={data.sessionStats?.totalLogins ?? 0} testId="total-logins" />
                <StatCard icon={Users} label="Active Users Today" value={data.sessionStats?.uniqueActiveUsersToday ?? 0} testId="active-users-today" />
                <StatCard icon={Clock} label="Avg Session" value={data.sessionStats ? formatDuration(data.sessionStats.avgSessionDurationSeconds) : "0s"} testId="avg-session" />
              </div>
            </section>

            {/* Vote Stats */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Vote Intent Summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard icon={TrendingUp} label="Republican" value={data.votesByIntent.red} testId="votes-red" />
                <StatCard icon={TrendingUp} label="Democrat" value={data.votesByIntent.blue} testId="votes-blue" />
                <StatCard icon={TrendingUp} label="Independent" value={data.votesByIntent.independent} testId="votes-independent" />
                <StatCard icon={TrendingUp} label="Undecided" value={data.votesByIntent.undecided} testId="votes-undecided" />
              </div>
            </section>

            {/* Flip Stats */}
            {data.flipStats && data.flipStats.length > 0 && (
              <Card data-testid="card-flip-stats">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MousePointerClick className="h-4 w-4" />
                    Countdown Flips by Date
                  </CardTitle>
                  <CardDescription>
                    How many times users toggled between 2026 and 2028 views
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {data.flipStats.map((entry) => (
                      <div key={entry.date} className="flex justify-between text-sm" data-testid={`flip-stat-${entry.date}`}>
                        <span className="text-muted-foreground">{entry.date}</span>
                        <span className="font-medium">{entry.count.toLocaleString()} flips</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CSV Export */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Data Export
              </h2>
              <Button
                variant="outline"
                onClick={handleDownloadCSV}
                disabled={isDownloading}
                className="gap-2"
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? "Downloading..." : "Export Votes as CSV"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Downloads all vote intent records with demographics.
              </p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
