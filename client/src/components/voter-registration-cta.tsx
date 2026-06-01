import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, CheckCircle2, MapPin, PartyPopper } from "lucide-react";
import { useTracking } from "@/hooks/use-tracking";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "DC", name: "Washington D.C." },
] as const;

const REGISTERED_KEY = "ec_voter_registered";

export function VoterRegistrationCTA() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [dismissed, setDismissed] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { track } = useTracking();

  // Check if user previously said they're registered
  useEffect(() => {
    try {
      if (localStorage.getItem(REGISTERED_KEY) === "true") {
        setDismissed(true);
      }
    } catch {}
  }, []);

  const getStateRegistrationUrl = (stateCode: string) => {
    return `https://vote.gov/register/${stateCode.toLowerCase()}/`;
  };

  const handleAlreadyRegistered = () => {
    track("register_click", { action: "already_registered" });
    setShowConfirmation(true);
    try {
      localStorage.setItem(REGISTERED_KEY, "true");
    } catch {}
    // Show confirmation briefly, then dismiss
    setTimeout(() => {
      setDismissed(true);
    }, 2000);
  };

  // Don't render if previously dismissed
  if (dismissed && !showConfirmation) return null;

  return (
    <AnimatePresence mode="wait">
      {showConfirmation ? (
        <motion.div
          key="confirmation"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 text-center space-y-2">
            <PartyPopper className="h-8 w-8 text-green-600 mx-auto" />
            <p className="font-serif font-bold text-lg text-green-700 dark:text-green-400">
              You're all set!
            </p>
            <p className="text-sm text-muted-foreground">
              Your vote matters. See you on Election Day.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-blue-500/5 via-background to-red-500/5 p-6 shadow-sm">
            {/* Decorative stars */}
            <div className="absolute top-2 right-3 text-primary/10 text-2xl pointer-events-none">★</div>
            <div className="absolute bottom-2 left-3 text-primary/10 text-lg pointer-events-none">★</div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-serif font-bold text-lg">Are You Registered to Vote?</h3>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Make sure your voice is heard. Check your registration status or register for the first time.
              </p>

              {/* State selector + register link */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select value={selectedState} onValueChange={(val) => { setSelectedState(val); track("state_select", { state: val }); }}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Select your state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedState ? (
                  <Button
                    asChild
                    size="sm"
                    className="gap-2 w-full sm:w-auto"
                  >
                    <a
                      href={getStateRegistrationUrl(selectedState)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track("register_click", { state: selectedState })}
                    >
                      Register Now
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full sm:w-auto"
                  >
                    <a
                      href="https://vote.gov"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track("external_link", { url: "https://vote.gov" })}
                    >
                      Visit Vote.gov
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>

              {/* Already registered option */}
              <div className="pt-1">
                <button
                  onClick={handleAlreadyRegistered}
                  className="text-sm text-primary font-medium hover:underline underline-offset-4 focus:outline-none focus:underline transition-colors"
                >
                  I'm already registered
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground/60">
                Non-partisan resource provided by the U.S. government
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
