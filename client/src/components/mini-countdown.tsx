import { useCountdown } from "@/hooks/use-countdown";
import { motion } from "framer-motion";
import { Landmark } from "lucide-react";

interface MiniCountdownProps {
  targetDate: string;
  label: string;
}

export function MiniCountdown({ targetDate, label }: MiniCountdownProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);

  if (isExpired) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Landmark className="h-3.5 w-3.5" />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground/80">
        <span>
          <strong className="text-foreground/70">{days}</strong>
          <span className="text-[10px] ml-0.5">d</span>
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span>
          <strong className="text-foreground/70">{hours.toString().padStart(2, "0")}</strong>
          <span className="text-[10px] ml-0.5">h</span>
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span>
          <strong className="text-foreground/70">{minutes.toString().padStart(2, "0")}</strong>
          <span className="text-[10px] ml-0.5">m</span>
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span>
          <strong className="text-foreground/70">{seconds.toString().padStart(2, "0")}</strong>
          <span className="text-[10px] ml-0.5">s</span>
        </span>
      </div>
    </motion.div>
  );
}
