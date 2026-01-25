import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Lock, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface DonorAnalyticsData {
  votesByIntent: {
    redRange: string;
    blueRange: string;
    undecidedRange: string;
    total: number;
  };
  votesByState: Record<string, {
    redRange: string;
    blueRange: string;
    undecidedRange: string;
    total: string;
  }>;
  votesByAge: Record<string, {
    redRange: string;
    blueRange: string;
    undecidedRange: string;
    total: string;
  }>;
  thresholdMet: boolean;
  donorTier: 'basic' | 'supporter' | 'premium';
}

function TierBadge({ tier }: { tier: string }) {
  const tierConfig = {
    basic: { label: 'Donor', className: 'bg-gray-100 text-gray-800' },
    supporter: { label: 'Supporter', className: 'bg-blue-100 text-blue-800' },
    premium: { label: 'Premium', className: 'bg-purple-100 text-purple-800' },
  };
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.basic;
  return <Badge className={config.className}>{config.label}</Badge>;
}

function RangeBar({ redRange, blueRange }: { redRange: string; blueRange: string }) {
  const redMid = parseInt(redRange.split('-')[0]) + 2.5;
  const blueMid = parseInt(blueRange.split('-')[0]) + 2.5;
  
  return (
    <div className="h-4 rounded-full overflow-hidden flex">
      <div 
        className="bg-gradient-to-r from-red-700 to-red-500 flex items-center justify-center"
        style={{ width: `${redMid}%` }}
      >
        <span className="text-[10px] text-white font-medium">{redRange}</span>
      </div>
      <div 
        className="bg-gradient-to-r from-blue-500 to-blue-700 flex items-center justify-center"
        style={{ width: `${blueMid}%` }}
      >
        <span className="text-[10px] text-white font-medium">{blueRange}</span>
      </div>
    </div>
  );
}

export default function DonorAnalytics() {
  const [, navigate] = useLocation();
  
  const { data, isLoading, error } = useQuery<DonorAnalyticsData>({
    queryKey: ["/api/donor/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/donor/analytics");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch analytics");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Donor Access Required</CardTitle>
            <CardDescription>
              {error.message || "Donate at least $1 to access detailed analytics with breakdowns by state and age group."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate("/")} data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const stateEntries = Object.entries(data.votesByState);
  const ageEntries = Object.entries(data.votesByAge);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Donor Analytics</h1>
            </div>
          </div>
          <TierBadge tier={data.donorTier} />
        </div>

        {!data.thresholdMet && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-sm text-yellow-800">
                We need more participants before showing detailed breakdowns. Check back when we reach 50,000 participants.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6">
          <Card data-testid="card-overall-breakdown">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Overall Breakdown
              </CardTitle>
              <CardDescription>
                {data.votesByIntent.total.toLocaleString()} total participants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RangeBar redRange={data.votesByIntent.redRange} blueRange={data.votesByIntent.blueRange} />
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-red-600">Republican: {data.votesByIntent.redRange}</span>
                <span className="text-purple-600">Undecided: {data.votesByIntent.undecidedRange}</span>
                <span className="text-blue-600">Democrat: {data.votesByIntent.blueRange}</span>
              </div>
            </CardContent>
          </Card>

          {stateEntries.length > 0 && (
            <Card data-testid="card-state-breakdown">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  By State
                </CardTitle>
                <CardDescription>
                  States with 50+ participants (privacy protected)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stateEntries.map(([state, data]) => (
                    <div key={state}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{state}</span>
                        <span className="text-muted-foreground">{data.total} participants</span>
                      </div>
                      <RangeBar redRange={data.redRange} blueRange={data.blueRange} />
                    </div>
                  ))}
                </div>
                {stateEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No states have reached the 50 participant minimum yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {ageEntries.length > 0 && (
            <Card data-testid="card-age-breakdown">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  By Age Group
                </CardTitle>
                <CardDescription>
                  Age groups with 50+ participants (privacy protected)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ageEntries.map(([age, data]) => (
                    <div key={age}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{age === 'not_provided' ? 'Not Specified' : age}</span>
                        <span className="text-muted-foreground">{data.total} participants</span>
                      </div>
                      <RangeBar redRange={data.redRange} blueRange={data.blueRange} />
                    </div>
                  ))}
                </div>
                {ageEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No age groups have reached the 50 participant minimum yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
