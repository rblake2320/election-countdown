import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, CheckCircle2, MapPin, PartyPopper, CalendarDays } from "lucide-react";
import { useTracking } from "@/hooks/use-tracking";
import { formatVotingDate, latestDate, loadStateVoting, type StateVoting, type StateVotingFile } from "@/lib/state-voting";
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
const STATE_KEY = "ec_state";

function readSavedState(): string {
  try {
    const saved = localStorage.getItem(STATE_KEY) || "";
    return US_STATES.some((s) => s.code === saved) ? saved : "";
  } catch {
    return "";
  }
}

export function VoterRegistrationCTA() {
  const [selectedState, setSelectedState] = useState<string>(readSavedState);
  const [votingData, setVotingData] = useState<StateVotingFile | null>(null);
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

  // One static JSON fetch (cached in module scope), only once a state is chosen.
  useEffect(() => {
    if (!selectedState || votingData) return;
    let cancelled = false;
    loadStateVoting()
      .then((data) => { if (!cancelled) setVotingData(data); })
      .catch(() => { /* block simply stays hidden; the vote.gov link still works */ });
    return () => { cancelled = true; };
  }, [selectedState, votingData]);

  const selectState = (code: string) => {
    setSelectedState(code);
    try {
      localStorage.setItem(STATE_KEY, code);
    } catch {}
    track("state_selected", { state: code });
  };

  const getStateRegistrationUrl = (stateCode: string) => {
    return `https://vote.gov/register/${stateCode.toLowerCase()}/`;
  };

  const handleAlreadyRegistered = () => {
    track("register_click", { action: "already_registered" });
    setShowConfirmation(true);
    try {
      localStorage.setItem(REGISTERED_KEY, "true");
    } catch {}
    // Show confirmation briefly, then settle into the compact "registered · Change" line.
    setTimeout(() => {
      setDismissed(true);
      setShowConfirmation(false);
    }, 2000);
  };

  const undoRegistered = () => {
    try {
      localStorage.removeItem(REGISTERED_KEY);
    } catch {}
    track("register_click", { action: "undo_registered" });
    setDismissed(false);
    setShowConfirmation(false);
  };

  // Previously marked as registered: a quiet reminder with a way to undo a mis-click.
  if (dismissed && !showConfirmation) {
    return (
      <p className="text-center text-sm text-muted-foreground" data-testid="registered-status">
        <CheckCircle2 className="mr-1 inline h-4 w-4 text-green-600" />
        You're marked as registered on this device.{" "}
        <button type="button" onClick={undoRegistered} className="font-medium text-primary underline-offset-4 hover:underline" data-testid="button-undo-registered">
          Change
        </button>
      </p>
    );
  }

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
                  <Select value={selectedState} onValueChange={selectState}>
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

              {selectedState && votingData?.states[selectedState] && (
                <StateKeyDates code={selectedState} info={votingData.states[selectedState]} onLinkClick={(url) => track("external_link", { url, state: selectedState })} />
              )}

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

function DateRow({ label, children, testId }: { label: string; children: ReactNode; testId: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" data-testid={testId}>{children}</dd>
    </div>
  );
}

/** Compact "Key dates" block for the chosen state; every unverified date says to check the state's site. */
function StateKeyDates({ code, info, onLinkClick }: { code: string; info: StateVoting; onLinkClick: (url: string) => void }) {
  const { registration, earlyVoting, mail, source, officialUrl } = info;
  const methods = [
    ["online", registration.online],
    ["by mail", registration.mail],
    ["in person", registration.inPerson],
  ] as const;
  const registerBy = latestDate(methods.map(([, d]) => d));
  const methodsDiffer = new Set(methods.map(([, d]) => d)).size > 1;
  const earlyText = earlyVoting.start || earlyVoting.end
    ? `${formatVotingDate(earlyVoting.start)} – ${formatVotingDate(earlyVoting.end)}`
    : formatVotingDate(null);

  return (
    <div className="rounded-xl border border-primary/15 bg-background/60 p-4 text-left text-sm" data-testid="state-key-dates" data-state={code}>
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h4 className="font-serif font-bold">Key dates for {info.name}</h4>
      </div>
      <dl className="space-y-1.5">
        <DateRow label="Register by" testId="state-register-by">
          {formatVotingDate(registerBy)}
          {registerBy && methodsDiffer && (
            <span className="block text-xs font-normal text-muted-foreground">
              {methods.map(([m, d]) => `${m}: ${formatVotingDate(d)}`).join(" · ")}
            </span>
          )}
          {registration.sameDay && (
            <span className="block text-xs font-normal text-green-700 dark:text-green-400">Same-day registration available</span>
          )}
          {registration.note && <span className="block text-xs font-normal text-muted-foreground">{registration.note}</span>}
        </DateRow>
        <DateRow label="Early voting" testId="state-early-voting">
          {earlyText}
          {earlyVoting.note && <span className="block text-xs font-normal text-muted-foreground">{earlyVoting.note}</span>}
        </DateRow>
        <DateRow label="Mail ballot" testId="state-mail-ballot">
          request by {formatVotingDate(mail.requestBy)}, return by {formatVotingDate(mail.returnBy)}
          {mail.postmarkOk && <span className="block text-xs font-normal text-muted-foreground">postmark counts</span>}
          {mail.note && <span className="block text-xs font-normal text-muted-foreground">{mail.note}</span>}
        </DateRow>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Source:{" "}
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground" onClick={() => onLinkClick(source.url)}>
          {source.title}
        </a>{" "}
        · checked {source.checkedOn}
        <br />
        <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => onLinkClick(officialUrl)} data-testid="state-official-link">
          Official {info.name} election site
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
