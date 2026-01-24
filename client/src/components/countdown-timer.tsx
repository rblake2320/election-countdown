import { useCountdown } from "@/hooks/use-countdown";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  targetDate: string;
  title: string;
}

const NumberBox = ({ value, label }: { value: number; label: string }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="relative bg-card text-card-foreground border shadow-sm rounded-xl p-4 sm:p-6 md:p-8 min-w-[80px] sm:min-w-[120px] md:min-w-[160px] text-center backdrop-blur-sm bg-opacity-80">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="block text-4xl sm:text-6xl md:text-8xl font-mono font-bold tracking-tighter leading-none"
          >
            {value.toString().padStart(2, "0")}
          </motion.span>
        </AnimatePresence>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-xl" />
      </div>
      <span className="mt-4 text-xs sm:text-sm md:text-base font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
};

export function CountdownTimer({ targetDate, title }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);

  if (isExpired) {
    return (
      <div className="text-center space-y-8">
        <motion.h1 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl md:text-6xl font-serif font-bold text-primary"
        >
          {title} is Here!
        </motion.h1>
        <p className="text-muted-foreground text-lg">The countdown has finished.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 w-full max-w-5xl mx-auto px-4">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-sm md:text-base font-semibold tracking-widest text-primary uppercase mb-2">
            Upcoming Election
          </h2>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight">
            {title}
          </h1>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 justify-center items-center">
        <NumberBox value={days} label="Days" />
        <NumberBox value={hours} label="Hours" />
        <NumberBox value={minutes} label="Minutes" />
        <NumberBox value={seconds} label="Seconds" />
      </div>
    </div>
  );
}