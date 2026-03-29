import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Settings2, Quote } from "lucide-react";
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
  source: string;
  year: string;
  affiliation?: "left" | "right" | "neutral";
}

const QUOTES: Quote[] = [
  {
    id: "kennedy",
    text: "Ask not what your country can do for you – ask what you can do for your country.",
    author: "John F. Kennedy",
    source: "Inaugural Address",
    year: "1961",
    affiliation: "left",
  },
  {
    id: "lincoln",
    text: "Government of the people, by the people, for the people, shall not perish from the earth.",
    author: "Abraham Lincoln",
    source: "Gettysburg Address",
    year: "1863",
    affiliation: "neutral",
  },
  {
    id: "reagan",
    text: "Freedom is never more than one generation away from extinction. We didn't pass it to our children in the bloodstream. It must be fought for, protected, and handed on for them to do the same.",
    author: "Ronald Reagan",
    source: "Address to the Phoenix Chamber of Commerce",
    year: "1961",
    affiliation: "right",
  },
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
    id: "fdr",
    text: "The only thing we have to fear is fear itself.",
    author: "Franklin D. Roosevelt",
    source: "First Inaugural Address",
    year: "1933",
    affiliation: "left",
  },
  {
    id: "eisenhower",
    text: "The future of this republic is in the hands of the American voter.",
    author: "Dwight D. Eisenhower",
    source: "Campaign Speech",
    year: "1952",
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
        setIsHidden(false);
        return;
      }
    }

    // Random quote
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    setCurrentQuote(QUOTES[randomIndex]);
    setIsHidden(false);
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

  const showQuotes = () => {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    setCurrentQuote(QUOTES[randomIndex]);
    setIsHidden(false);
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
              <DropdownMenuItem onClick={hideQuotes} className="text-xs text-destructive" data-testid="menu-item-hide-quotes">
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
