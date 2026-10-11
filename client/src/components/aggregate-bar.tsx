import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsData {
  total: number;
  showBar: boolean;
  threshold?: number;
  message?: string;
  red?: number;
  blue?: number;
  undecided?: number;
  redPercent?: number;
  bluePercent?: number;
  redRange?: string;
  blueRange?: string;
  /** Signed-out votes, reported apart from the counted (account) totals. */
  anonymous?: { total: number; note?: string };
}

// Convert exact percentage to a range for privacy (e.g., 47.3 -> "45-50%")
function toPercentRange(percent: number): string {
  const lower = Math.floor(percent / 5) * 5;
  const upper = lower + 5;
  return `${lower}-${upper}%`;
}

function AnonymousTally({ stats }: { stats: StatsData }) {
  const count = stats.anonymous?.total ?? 0;
  if (!count) return null;
  return (
    <p className="mt-2 text-center text-[11px] text-muted-foreground" data-testid="anonymous-tally" title={stats.anonymous?.note}>
      + {count.toLocaleString()} unverified (signed-out) {count === 1 ? "vote" : "votes"}, counted separately and may include bots
    </p>
  );
}

export function AggregateBar({ electionId = "midterm-2026" }: { electionId?: string }) {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats", electionId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/stats?election=${electionId}`);
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto px-4">
        <div className="h-6 bg-muted rounded-full animate-pulse" />
      </div>
    );
  }

  if (!stats) return null;

  // Not enough participants yet
  if (!stats.showBar) {
    return (
      <div className="w-full max-w-md mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-2">
          <Users className="h-4 w-4" />
          <span data-testid="verified-total">{stats.total.toLocaleString()} verified {stats.total === 1 ? "participant" : "participants"}</span>
        </div>
        <div className="relative h-6 bg-muted/50 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">
              {stats.message || `${stats.threshold?.toLocaleString()} needed to show results`}
            </span>
          </div>
          {/* Progress toward threshold */}
          <motion.div
            className="h-full bg-gradient-to-r from-muted to-muted-foreground/20"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((stats.total / (stats.threshold || 50000)) * 100, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <AnonymousTally stats={stats} />
      </div>
    );
  }

  // Show the actual red/blue bar
  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-2">
        <Users className="h-4 w-4" />
        <span data-testid="verified-total">{stats.total.toLocaleString()} verified participants</span>
      </div>

      <div className="relative h-8 rounded-full overflow-hidden shadow-inner flex">
        {/* Red side */}
        <motion.div
          className="h-full bg-gradient-to-r from-red-700 to-red-500 flex items-center justify-end pr-3"
          initial={{ width: 0 }}
          animate={{ width: `${stats.redPercent || 50}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <span className="text-white text-xs font-bold drop-shadow">
            {stats.redRange || toPercentRange(stats.redPercent || 0)}
          </span>
        </motion.div>

        {/* Blue side */}
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-700 flex items-center justify-start pl-3"
          initial={{ width: 0 }}
          animate={{ width: `${stats.bluePercent || 50}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <span className="text-white text-xs font-bold drop-shadow">
            {stats.blueRange || toPercentRange(stats.bluePercent || 0)}
          </span>
        </motion.div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-red-600 font-medium">Republican</span>
        {stats.undecided && stats.undecided > 0 && (
          <span className="text-purple-600">
            {stats.undecided.toLocaleString()} undecided
          </span>
        )}
        <span className="text-blue-600 font-medium">Democrat</span>
      </div>
      <AnonymousTally stats={stats} />
    </div>
  );
}
