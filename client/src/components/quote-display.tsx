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
import { QUOTES, type QuoteItem } from "@/data/quotes";

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

  const shuffleQuote = (silent = false) => {
    const otherQuotes = relevantQuotes.filter((q) => q.id !== currentQuote?.id);
    const randomIndex = Math.floor(Math.random() * otherQuotes.length);
    setCurrentQuote(otherQuotes[randomIndex]);
    if (!silent) {
      track("quote_shuffle", { toQuote: otherQuotes[randomIndex]?.id });
    }
  };

  // Rotate quote when user returns to the page (screen on, tab refocus)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && !isHidden && preferredQuote !== "none") {
        shuffleQuote(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  });

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
          &ldquo;{currentQuote.text}&rdquo;
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
            onClick={() => shuffleQuote()}
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
            <DropdownMenuContent align="center" className="max-h-[300px] overflow-y-auto">
              <DropdownMenuLabel className="text-xs">
                Choose a Quote ({relevantQuotes.length} available)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Show unique authors from relevant pool */}
              {Array.from(new Set(relevantQuotes.map((q) => q.author))).map((author) => {
                const authorQuotes = relevantQuotes.filter((q) => q.author === author);
                if (authorQuotes.length === 1) {
                  return (
                    <DropdownMenuItem
                      key={authorQuotes[0].id}
                      onClick={() => {
                        setCurrentQuote(authorQuotes[0]);
                        onPreferenceChange?.(authorQuotes[0].id);
                      }}
                      className="text-xs"
                    >
                      {author}
                    </DropdownMenuItem>
                  );
                }
                return authorQuotes.map((q, i) => (
                  <DropdownMenuItem
                    key={q.id}
                    onClick={() => {
                      setCurrentQuote(q);
                      onPreferenceChange?.(q.id);
                    }}
                    className="text-xs"
                  >
                    {author} ({i + 1})
                  </DropdownMenuItem>
                ));
              })}
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
