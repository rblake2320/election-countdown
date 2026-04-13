import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Flame, AlertTriangle, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

interface MilestoneBannerProps {
  targetDate: string;
  electionTitle: string;
}

interface Milestone {
  days: number;
  label: string;
  icon: typeof Bell;
  color: string;
  bgColor: string;
  urgency: "low" | "medium" | "high" | "critical";
}

const MILESTONES: Milestone[] = [
  { days: 365, label: "One year until", icon: Bell, color: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/20", urgency: "low" },
  { days: 200, label: "200 days until", icon: Bell, color: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/20", urgency: "low" },
  { days: 100, label: "100 days until", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/20", urgency: "medium" },
  { days: 60, label: "60 days until", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/20", urgency: "medium" },
  { days: 30, label: "30 days until", icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/20", urgency: "high" },
  { days: 14, label: "2 weeks until", icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/20", urgency: "high" },
  { days: 7, label: "One week until", icon: Flame, color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/20", urgency: "critical" },
  { days: 3, label: "3 days until", icon: Flame, color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/20", urgency: "critical" },
  { days: 1, label: "Tomorrow is", icon: Flame, color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/20", urgency: "critical" },
  { days: 0, label: "Today is", icon: Flame, color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/20", urgency: "critical" },
];

export function MilestoneBanner({ targetDate, electionTitle }: MilestoneBannerProps) {
  const milestone = useMemo(() => {
    const target = new Date(targetDate);
    const now = new Date();
    const daysLeft = differenceInDays(target, now);

    // Find the closest milestone that we're at or past
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      const m = MILESTONES[i];
      if (daysLeft <= m.days && daysLeft >= (MILESTONES[i + 1]?.days ?? 0)) {
        // Only show if we're within 2 days of the milestone threshold
        if (Math.abs(daysLeft - m.days) <= 2) {
          return { ...m, daysLeft };
        }
      }
    }

    return null;
  }, [targetDate]);

  if (!milestone) return null;

  const Icon = milestone.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`w-full max-w-lg mx-auto rounded-xl border px-4 py-3 ${milestone.bgColor}`}
      >
        <div className="flex items-center justify-center gap-2">
          <Icon className={`h-4 w-4 ${milestone.color} ${milestone.urgency === "critical" ? "animate-pulse" : ""}`} />
          <p className={`text-sm font-medium ${milestone.color}`}>
            {milestone.label} {electionTitle}
          </p>
          <Icon className={`h-4 w-4 ${milestone.color} ${milestone.urgency === "critical" ? "animate-pulse" : ""}`} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
