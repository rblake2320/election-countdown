import { useCountdown } from "@/hooks/use-countdown";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  targetDate: string;
  title: string;
  subtitle?: string;
}

const NumberBox = ({ value, label }: { value: number; label: string }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="relative bg-card text-card-foreground border shadow-lg rounded-xl p-3 sm:p-5 md:p-6 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] text-center backdrop-blur-sm">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="block text-3xl sm:text-5xl md:text-7xl font-mono font-bold tracking-tighter leading-none"
          >
            {value.toString().padStart(2, "0")}
          </motion.span>
        </AnimatePresence>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-xl" />
      </div>
      <span className="mt-3 text-[10px] sm:text-xs md:text-sm font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
};

export function CountdownTimer({ targetDate, title, subtitle }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);

  if (isExpired) {
    return (
      <div className="text-center space-y-6">
        <motion.h1 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-5xl font-serif font-bold text-primary"
        >
          {title} is Here!
        </motion.h1>
        <p className="text-muted-foreground text-lg">The countdown has finished.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto px-4">
      <div className="text-center space-y-2">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {subtitle && (
            <p className="text-xs md:text-sm font-semibold tracking-widest text-primary/80 uppercase mb-1">
              {subtitle}
            </p>
          )}
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground leading-tight">
            {title}
          </h1>
        </motion.div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-6 justify-center items-center">
        <NumberBox value={days} label="Days" />
        <NumberBox value={hours} label="Hours" />
        <NumberBox value={minutes} label="Minutes" />
        <NumberBox value={seconds} label="Seconds" />
      </div>
    </div>
  );
}
