import { useState, useEffect } from "react";
import { CountdownTimer } from "@/components/countdown-timer";
import { SettingsPanel, CountdownSettings } from "@/components/settings-panel";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { fromZonedTime } from "date-fns-tz";

const DEFAULT_SETTINGS: CountdownSettings = {
  title: "2026 Midterm Elections",
  date: "2026-11-03",
  time: "00:00",
  timezone: "America/New_York",
};

export default function Home() {
  const [location] = useLocation();
  const [settings, setSettings] = useState<CountdownSettings>(DEFAULT_SETTINGS);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [targetDateObj, setTargetDateObj] = useState<Date>(new Date());

  // Load from URL or LocalStorage on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTitle = searchParams.get("title");
    const urlDate = searchParams.get("date");
    const urlTime = searchParams.get("time");
    const urlTimezone = searchParams.get("timezone");

    if (urlTitle && urlDate && urlTime) {
      setSettings({ 
        title: urlTitle, 
        date: urlDate, 
        time: urlTime,
        timezone: urlTimezone || "Local"
      });
    } else {
      const saved = localStorage.getItem("election-countdown-settings");
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse saved settings", e);
        }
      }
    }
    setMounted(true);
  }, []);

  // Save to LocalStorage whenever settings change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("election-countdown-settings", JSON.stringify(settings));
    }
  }, [settings, mounted]);

  // Calculate target date based on settings
  useEffect(() => {
    if (!mounted) return;

    try {
      const dateTimeString = `${settings.date} ${settings.time}`;
      
      if (settings.timezone === "Local") {
        setTargetDateObj(new Date(`${settings.date}T${settings.time}:00`));
      } else {
        // Convert the date/time in specific timezone to a JS Date object (which is UTC)
        const zonedDate = fromZonedTime(dateTimeString, settings.timezone);
        setTargetDateObj(zonedDate);
      }
    } catch (e) {
      console.error("Error parsing date:", e);
    }
  }, [settings, mounted]);

  // Handle Dark Mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500">
      {/* Abstract patriotic accent - Top Right */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      {/* Abstract patriotic accent - Bottom Left */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header / Nav */}
      <header className="w-full p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold font-serif shadow-lg shadow-primary/20">
            E
          </div>
          <span className="font-serif font-bold text-lg tracking-tight hidden sm:block">
            Election Countdown
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="rounded-full hover:bg-secondary w-10 h-10"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <SettingsPanel settings={settings} onUpdate={setSettings} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-10 pb-20">
        <CountdownTimer 
          targetDate={targetDateObj.toISOString()} 
          title={settings.title} 
        />
        
        <div className="mt-20 text-center max-w-lg mx-auto px-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          <p className="text-muted-foreground text-sm leading-relaxed italic font-serif">
            "Democracy is not a state. It is an act, and each generation must do its part to help build what we called the Beloved Community, a nation and world society at peace with itself."
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
             <div className="h-[1px] w-8 bg-border"></div>
             <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
              John Lewis
            </p>
             <div className="h-[1px] w-8 bg-border"></div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center text-xs text-muted-foreground z-10 border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <p>
          Target: {settings.date} {settings.time} ({settings.timezone})
        </p>
      </footer>
    </div>
  );
}