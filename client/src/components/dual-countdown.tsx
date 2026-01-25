import { useState } from "react";
import { CountdownTimer } from "./countdown-timer";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const ELECTIONS = [
  {
    id: "midterm-2026",
    title: "2026 Midterm Elections",
    subtitle: "Upcoming Election",
    date: "2026-11-03",
    time: "00:00",
    timezone: "America/New_York",
  },
  {
    id: "presidential-2028",
    title: "2028 Presidential Election",
    subtitle: "Next Presidential Race",
    date: "2028-11-07",
    time: "00:00",
    timezone: "America/New_York",
  },
];

export function DualCountdown() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeElection = ELECTIONS[activeIndex];

  const flipUp = () => {
    setActiveIndex((prev) => (prev === 0 ? ELECTIONS.length - 1 : prev - 1));
  };

  const flipDown = () => {
    setActiveIndex((prev) => (prev === ELECTIONS.length - 1 ? 0 : prev + 1));
  };

  // Convert to target date
  const targetDateISO = `${activeElection.date}T${activeElection.time}:00`;

  return (
    <div className="relative w-full">
      {/* Navigation arrows */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-12 flex flex-col items-center gap-1 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={flipUp}
          className="h-8 w-8 rounded-full hover:bg-primary/10"
          aria-label="Previous election"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      </div>

      {/* Main countdown with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeElection.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <CountdownTimer
            targetDate={targetDateISO}
            title={activeElection.title}
            subtitle={activeElection.subtitle}
          />
        </motion.div>
      </AnimatePresence>

      {/* Down arrow */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 flex flex-col items-center gap-1 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={flipDown}
          className="h-8 w-8 rounded-full hover:bg-primary/10"
          aria-label="Next election"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>

      {/* Election dots indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-60px] flex gap-2 z-20">
        {ELECTIONS.map((election, index) => (
          <button
            key={election.id}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === activeIndex
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Show ${election.title}`}
          />
        ))}
      </div>
    </div>
  );
}
