import { useState, useEffect, useRef, useCallback } from "react";
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
    year: "2026",
  },
  {
    id: "presidential-2028",
    title: "2028 Presidential Election",
    subtitle: "Next Presidential Race",
    date: "2028-11-07",
    time: "00:00",
    timezone: "America/New_York",
    year: "2028",
  },
  {
    id: "inauguration-2029",
    title: "2029 Inauguration Day",
    subtitle: "Presidential Inauguration",
    date: "2029-01-20",
    time: "12:00",
    timezone: "America/New_York",
    year: "2029",
  },
];

async function trackFlip(fromId: string, toId: string) {
  try {
    await fetch("/api/track/flip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromYear: fromId, toYear: toId }),
    });
  } catch {
    // Silently ignore tracking errors
  }
}

export function DualCountdown() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const activeElection = ELECTIONS[activeIndex];

  const flipTo = useCallback((newIndex: number) => {
    if (newIndex === activeIndex) return;
    const fromId = ELECTIONS[activeIndex].id;
    const toId = ELECTIONS[newIndex].id;
    setActiveIndex(newIndex);
    trackFlip(fromId, toId);
  }, [activeIndex]);

  const flipUp = useCallback(() => {
    const newIndex = activeIndex === 0 ? ELECTIONS.length - 1 : activeIndex - 1;
    flipTo(newIndex);
  }, [activeIndex, flipTo]);

  const flipDown = useCallback(() => {
    const newIndex = activeIndex === ELECTIONS.length - 1 ? 0 : activeIndex + 1;
    flipTo(newIndex);
  }, [activeIndex, flipTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        flipUp();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        flipDown();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flipUp, flipDown]);

  // Scroll navigation (mouse wheel) - only when hovering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isHovering = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleMouseEnter = () => {
      isHovering = true;
    };

    const handleMouseLeave = () => {
      isHovering = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isHovering) return;
      e.preventDefault();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (e.deltaY < 0) {
          flipUp();
        } else if (e.deltaY > 0) {
          flipDown();
        }
      }, 50);
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("wheel", handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [flipUp, flipDown]);

  // Touch swipe navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY.current - touchEndY;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          flipDown();
        } else {
          flipUp();
        }
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [flipUp, flipDown]);

  // Convert to target date
  const targetDateISO = `${activeElection.date}T${activeElection.time}:00`;

  return (
    <div 
      ref={containerRef}
      className="relative w-full cursor-pointer select-none"
      data-testid="dual-countdown"
    >
      {/* Navigation arrows */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-12 flex flex-col items-center gap-1 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={flipUp}
          className="h-8 w-8 rounded-full hover:bg-primary/10"
          aria-label="Previous election"
          data-testid="button-previous-election"
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
          data-testid="button-next-election"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>
      {/* Election dots indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-60px] flex gap-2 z-20">
        {ELECTIONS.map((election, index) => (
          <button
            key={election.id}
            onClick={() => flipTo(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === activeIndex
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Show ${election.title}`}
            data-testid={`dot-election-${index}`}
          />
        ))}
      </div>
      {/* Helper text */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-90px] text-xs text-muted-foreground text-center whitespace-nowrap">
        Use ↑↓ keys to flip between events
      </div>
    </div>
  );
}
