import { useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

/**
 * Parse a date string and interpret it as US Eastern Time.
 * Accepts "2026-11-03T00:00:00" — treats that as midnight ET, not the user's local timezone.
 * Correctly handles EST (UTC-5) vs EDT (UTC-4) based on the target date.
 */
function parseAsEastern(dateStr: Date | string): Date {
  if (dateStr instanceof Date) return dateStr;

  try {
    // Step 1: Treat the string as UTC temporarily to probe the ET offset on that date
    const asUtc = new Date(dateStr + "Z");

    // Step 2: Use Intl to find the Eastern offset on that particular date
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(asUtc);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    // tzPart.value is like "GMT-5" (EST) or "GMT-4" (EDT)
    const offsetMatch = tzPart?.value?.match(/GMT([+-]\d+)/);

    if (offsetMatch) {
      const offsetHours = parseInt(offsetMatch[1], 10);
      // The input "2026-11-03T00:00:00" means midnight Eastern.
      // Eastern is UTC + offsetHours (e.g., -5), so UTC = local - offset
      // midnight ET = 00:00 - (-5) = 05:00 UTC
      const utcMs = asUtc.getTime() - offsetHours * 3600 * 1000;
      return new Date(utcMs);
    }
  } catch {
    // Fallback: parse as-is (local timezone)
  }

  return new Date(dateStr);
}

export function useCountdown(targetDate: Date | string) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = parseAsEastern(targetDate);

      const diffInSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);

      if (diffInSeconds <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(diffInSeconds / (3600 * 24));
      const hours = Math.floor((diffInSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((diffInSeconds % 3600) / 60);
      const seconds = Math.floor(diffInSeconds % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}
