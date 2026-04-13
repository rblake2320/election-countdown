import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Settings2, Quote } from "lucide-react";
import { useTracking } from "@/hooks/use-tracking";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuoteItem {
  id: string;
  text: string;
  author: string;
  source: string;
  year: string;
  affiliation: "left" | "right" | "neutral";
}

const QUOTES: QuoteItem[] = [
  // Democrat / left-leaning
  {
    id: "kennedy",
    text: "Ask not what your country can do for you \u2013 ask what you can do for your country.",
    author: "John F. Kennedy",
    source: "Inaugural Address",
    year: "1961",
    affiliation: "left",
  },
  {
    id: "fdr",
    text: "The only thing we have to fear is fear itself.",
    author: "Franklin D. Roosevelt",
    source: "First Inaugural Address",
    year: "1933",
    affiliation: "left",
  },
  {
    id: "obama",
    text: "Change will not come if we wait for some other person or some other time. We are the ones we\u2019ve been waiting for.",
    author: "Barack Obama",
    source: "Campaign Speech",
    year: "2008",
    affiliation: "left",
  },
  {
    id: "lbj",
    text: "We shall overcome because the arc of the moral universe is long, but it bends toward justice.",
    author: "Lyndon B. Johnson",
    source: "Address to Congress",
    year: "1965",
    affiliation: "left",
  },
  // Republican / right-leaning
  {
    id: "reagan",
    text: "Freedom is never more than one generation away from extinction. We didn\u2019t pass it to our children in the bloodstream.",
    author: "Ronald Reagan",
    source: "Address to the Phoenix Chamber of Commerce",
    year: "1961",
    affiliation: "right",
  },
  {
    id: "eisenhower",
    text: "The future of this republic is in the hands of the American voter.",
    author: "Dwight D. Eisenhower",
    source: "Campaign Speech",
    year: "1952",
    affiliation: "right",
  },
  {
    id: "lincoln",
    text: "Government of the people, by the people, for the people, shall not perish from the earth.",
    author: "Abraham Lincoln",
    source: "Gettysburg Address",
    year: "1863",
    affiliation: "right",
  },
  {
    id: "coolidge",
    text: "The business of America is business. The chief ideal of the American people is idealism.",
    author: "Calvin Coolidge",
    source: "Address to the American Society of Newspaper Editors",
    year: "1925",
    affiliation: "right",
  },
  // Neutral / independent
  {
    id: "franklin",
    text: "Those who would give up essential Liberty, to purchase a little temporary Safety, deserve neither Liberty nor Safety.",
    author: "Benjamin Franklin",
    source: "Reply to the Governor, Pennsylvania Assembly",
    year: "1755",
    affiliation: "neutral",
  },
  {
    id: "mlk",
    text: "The time is always right to do what is right.",
    author: "Martin Luther King Jr.",
    source: "Commencement Address, Oberlin College",
    year: "1965",
    affiliation: "neutral",
  },
  {
    id: "washington",
    text: "Liberty, when it begins to take root, is a plant of rapid growth.",
    author: "George Washington",
    source: "Letter to James Madison",
    year: "1788",
    affiliation: "neutral",
  },
  {
    id: "twain",
    text: "Loyalty to the country always. Loyalty to the government when it deserves it.",
    author: "Mark Twain",
    source: "The Czar\u2019s Soliloquy",
    year: "1905",
    affiliation: "neutral",
  },
];

interface QuoteDisplayProps {
  isHidden: boolean;
  onHide: () => void;
  onShow: () => void;
  preferredQuote?: string | null;
  onPreferenceChange?: (quoteId: string | null) => void;
  isAuthenticated?: boolean;
  /** The user's vote intent: "red", "blue", "independent", "undecided", or null */
  userParty?: string | null;
}

/** Map vote intent to quote affiliation for filtering */
function getPartyAffiliation(intent: string | null | undefined): "left" | "right" | "neutral" | null {
  if (!intent) return null;
  if (intent === "blue") return "left";
  if (intent === "red") return "right";
  return "neutral"; // independent / undecided get neutral
}

export function QuoteDisplay({
  isHidden,
  onHide,
  onShow,
  preferredQuote,
  onPreferenceChange,
  isAuthenticated,
  userParty,
}: QuoteDisplayProps) {
  const [currentQuote, setCurrentQuote] = useState<QuoteItem | null>(null);
  const { track } = useTracking();

  /** Filter quotes by party — party-aligned + neutral mix */
  const relevantQuotes = useMemo(() => {
    const affiliation = getPartyAffiliation(userParty);
    if (!affiliation) return QUOTES; // no party = show all
    // Show quotes from their party + neutral ones
    return QUOTES.filter((q) => q.affiliation === affiliation || q.affiliation === "neutral");
  }, [userParty]);

  useEffect(() => {
    if (preferredQuote === "none") {
      return;
    }

    if (preferredQuote && preferredQuote !== "random") {
      const quote = relevantQuotes.find((q) => q.id === preferredQuote);
      if (quote) {
        setCurrentQuote(quote);
        return;
      }
    }

    // Random from relevant pool
    const randomIndex = Math.floor(Math.random() * relevantQuotes.length);
    setCurrentQuote(relevantQuotes[randomIndex]);
  }, [preferredQuote, relevantQuotes]);

  const shuffleQuote = () => {
    const otherQuotes = relevantQuotes.filter((q) => q.id !== currentQuote?.id);
    const randomIndex = Math.floor(Math.random() * otherQuotes.length);
    setCurrentQuote(otherQuotes[randomIndex]);
    track("quote_shuffle", { toQuote: otherQuotes[randomIndex]?.id });
  };

  const hideQuotes = () => {
    onHide();
    onPreferenceChange?.("none");
  };

  const showQuotes = () => {
    if (!currentQuote) {
      const randomIndex = Math.floor(Math.random() * relevantQuotes.length);
      setCurrentQuote(relevantQuotes[randomIndex]);
    }
    onShow();
    onPreferenceChange?.(null);
  };

  const selectQuote = (quoteId: string) => {
    const quote = QUOTES.find((q) => q.id === quoteId);
    if (quote) {
      setCurrentQuote(quote);
      onPreferenceChange?.(quoteId);
    }
  };

  if (isHidden) {
    return (
      <button
        onClick={showQuotes}
        className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-200 flex items-center gap-1.5 py-1"
        data-testid="button-show-quote"
        aria-label="Show quote"
      >
        <Quote className="h-3 w-3" />
        Show quote
      </button>
    );
  }

  if (!currentQuote) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center max-w-lg mx-auto px-4 relative group"
      >
        <p className="text-muted-foreground text-sm leading-relaxed italic font-serif">
          "{currentQuote.text}"
        </p>
        <div className="mt-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <div className="h-[1px] w-8 bg-border"></div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
              {currentQuote.author}
            </p>
            <div className="h-[1px] w-8 bg-border"></div>
          </div>
          <p className="text-[9px] text-muted-foreground">
            {currentQuote.source}, {currentQuote.year}
          </p>
        </div>

        {/* Quote controls */}
        <div className="mt-4 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={shuffleQuote}
            aria-label="Show different quote"
            data-testid="button-shuffle-quote"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                aria-label="Quote settings"
                data-testid="button-quote-settings"
              >
                <Settings2 className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel className="text-xs">
                Choose a Quote
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {relevantQuotes.map((quote) => (
                <DropdownMenuItem
                  key={quote.id}
                  onClick={() => selectQuote(quote.id)}
                  className="text-xs"
                >
                  {quote.author}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={hideQuotes}
                className="text-xs text-destructive"
                data-testid="menu-item-hide-quotes"
              >
                Hide Quotes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={hideQuotes}
            aria-label="Hide quote"
            data-testid="button-hide-quote"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
