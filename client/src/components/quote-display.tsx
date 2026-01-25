import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Quote {
  id: string;
  text: string;
  author: string;
  affiliation?: "left" | "right" | "neutral";
}

const QUOTES: Quote[] = [
  {
    id: "lewis",
    text: "Democracy is not a state. It is an act, and each generation must do its part to help build what we called the Beloved Community, a nation and world society at peace with itself.",
    author: "John Lewis",
    affiliation: "left",
  },
  {
    id: "reagan",
    text: "Freedom is never more than one generation away from extinction. We didn't pass it to our children in the bloodstream. It must be fought for, protected, and handed on for them to do the same.",
    author: "Ronald Reagan",
    affiliation: "right",
  },
  {
    id: "kennedy",
    text: "Ask not what your country can do for you – ask what you can do for your country.",
    author: "John F. Kennedy",
    affiliation: "left",
  },
  {
    id: "lincoln",
    text: "Government of the people, by the people, for the people, shall not perish from the earth.",
    author: "Abraham Lincoln",
    affiliation: "neutral",
  },
  {
    id: "franklin",
    text: "Those who would give up essential Liberty, to purchase a little temporary Safety, deserve neither Liberty nor Safety.",
    author: "Benjamin Franklin",
    affiliation: "neutral",
  },
  {
    id: "mlk",
    text: "The time is always right to do what is right.",
    author: "Martin Luther King Jr.",
    affiliation: "neutral",
  },
  {
    id: "washington",
    text: "Liberty, when it begins to take root, is a plant of rapid growth.",
    author: "George Washington",
    affiliation: "neutral",
  },
  {
    id: "trump",
    text: "What separates the winners from the losers is how a person reacts to each new twist of fate.",
    author: "Donald Trump",
    affiliation: "right",
  },
];

interface QuoteDisplayProps {
  preferredQuote?: string | null;
  onPreferenceChange?: (quoteId: string | null) => void;
  isAuthenticated?: boolean;
}

export function QuoteDisplay({ preferredQuote, onPreferenceChange, isAuthenticated }: QuoteDisplayProps) {
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (preferredQuote === "none") {
      setIsHidden(true);
      return;
    }

    if (preferredQuote && preferredQuote !== "random") {
      const quote = QUOTES.find((q) => q.id === preferredQuote);
      if (quote) {
        setCurrentQuote(quote);
        return;
      }
    }

    // Random quote
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    setCurrentQuote(QUOTES[randomIndex]);
  }, [preferredQuote]);

  const shuffleQuote = () => {
    const otherQuotes = QUOTES.filter((q) => q.id !== currentQuote?.id);
    const randomIndex = Math.floor(Math.random() * otherQuotes.length);
    setCurrentQuote(otherQuotes[randomIndex]);
  };

  const hideQuotes = () => {
    setIsHidden(true);
    onPreferenceChange?.("none");
  };

  const selectQuote = (quoteId: string) => {
    const quote = QUOTES.find((q) => q.id === quoteId);
    if (quote) {
      setCurrentQuote(quote);
      onPreferenceChange?.(quoteId);
    }
  };

  if (isHidden || !currentQuote) {
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
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="h-[1px] w-8 bg-border"></div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
            {currentQuote.author}
          </p>
          <div className="h-[1px] w-8 bg-border"></div>
        </div>

        {/* Quote controls */}
        <div className="mt-4 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={shuffleQuote}
            aria-label="Show different quote"
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
              >
                <Settings2 className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel className="text-xs">Choose a Quote</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {QUOTES.map((quote) => (
                <DropdownMenuItem
                  key={quote.id}
                  onClick={() => selectQuote(quote.id)}
                  className="text-xs"
                >
                  {quote.author}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={hideQuotes} className="text-xs text-destructive">
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
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
