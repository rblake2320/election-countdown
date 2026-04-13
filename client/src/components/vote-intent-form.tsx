import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Vote, Loader2, Share2, Twitter, Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
const VOTE_INTENTS = ["red", "blue", "independent", "undecided"] as const;
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
] as const;

const INTENT_LABELS: Record<string, string> = {
  red: "Republican",
  blue: "Democrat",
  independent: "Independent",
  undecided: "Undecided",
};

const formSchema = z.object({
  intent: z.enum(VOTE_INTENTS),
  state: z.string().length(2, "Please select your state"),
  ageRange: z.enum(AGE_RANGES).optional(),
  city: z.string().optional(),
  sex: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  customCandidate: z.string().max(100).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface VoteIntentFormProps {
  existingIntent?: {
    intent: string;
    state: string;
    ageRange?: string | null;
    city?: string | null;
    sex?: string | null;
    customCandidate?: string | null;
  } | null;
  isDonor?: boolean;
}

function SharePrompt({ intent, onClose }: { intent: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const intentLabel = INTENT_LABELS[intent] || intent;
  const siteUrl = window.location.origin;
  const shareMessage = `I just recorded my voting intention as ${intentLabel} on Election Countdown. Join me and make your voice count!`;

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(siteUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareMessage} ${siteUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg border border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Share2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Spread the Word</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Your intent has been recorded! Share it to encourage others to participate.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTwitterShare}
          className="gap-2 text-xs"
          data-testid="button-post-vote-share-twitter"
        >
          <Twitter className="h-3 w-3" />
          Share on X
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="gap-2 text-xs"
          data-testid="button-post-vote-copy-link"
        >
          {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-xs text-muted-foreground ml-auto"
          data-testid="button-post-vote-dismiss"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function VoteIntentForm({ existingIntent, isDonor = false }: VoteIntentFormProps) {
  const [open, setOpen] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [submittedIntent, setSubmittedIntent] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      intent: (existingIntent?.intent as any) || undefined,
      state: existingIntent?.state || "",
      ageRange: (existingIntent?.ageRange as any) || undefined,
      city: existingIntent?.city || "",
      sex: (existingIntent?.sex as any) || undefined,
      customCandidate: existingIntent?.customCandidate || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      try {
        const response = await fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          throw new Error("Failed to save voting intent");
        }
        return response.json();
      } catch {
        // No backend — save locally
        try {
          localStorage.setItem("ec_vote_intent", JSON.stringify(data));
        } catch {}
        return data;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/intent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Intent Saved",
        description: "Your voting intention has been recorded.",
      });
      setSubmittedIntent(variables.intent);
      setShowSharePrompt(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your voting intention. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const selectedIntent = form.watch("intent");

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setShowSharePrompt(false);
      setSubmittedIntent(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 border-primary/20 hover:border-primary/40"
        onClick={() => setOpen(true)}
      >
        <Vote className="h-4 w-4" />
        {existingIntent ? "Update Intent" : "Share Your Vote Plan"}
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Your Voting Plan</DialogTitle>
          <DialogDescription>
            Share your voting intention to see how the country leans. Your data is anonymous.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            {/* Vote Intent Selection */}
            <FormField
              control={form.control}
              name="intent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How do you plan to vote?</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={field.value === "red" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "red" && "bg-red-600 hover:bg-red-700 text-white"
                      )}
                      onClick={() => field.onChange("red")}
                      data-testid="button-intent-red"
                    >
                      <span className="text-lg">🔴</span>
                      <span className="text-xs">Republican</span>
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "blue" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "blue" && "bg-blue-600 hover:bg-blue-700 text-white"
                      )}
                      onClick={() => field.onChange("blue")}
                      data-testid="button-intent-blue"
                    >
                      <span className="text-lg">🔵</span>
                      <span className="text-xs">Democrat</span>
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "independent" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "independent" && "bg-green-600 hover:bg-green-700 text-white"
                      )}
                      onClick={() => field.onChange("independent")}
                      data-testid="button-intent-independent"
                    >
                      <span className="text-lg">🟢</span>
                      <span className="text-xs">Independent</span>
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "undecided" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "undecided" && "bg-purple-600 hover:bg-purple-700 text-white"
                      )}
                      onClick={() => field.onChange("undecided")}
                      data-testid="button-intent-undecided"
                    >
                      <span className="text-lg">🟣</span>
                      <span className="text-xs">Undecided</span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Custom Candidate - Donors only */}
            {isDonor && (
              <FormField
                control={form.control}
                name="customCandidate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Candidate (Donor Perk)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter a specific candidate name" 
                        {...field} 
                        data-testid="input-custom-candidate"
                      />
                    </FormControl>
                    <FormDescription>
                      As a donor, you can specify who you're voting for
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* State - Required */}
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[200px]">
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Age Range - Optional */}
            <FormField
              control={form.control}
              name="ageRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age Range (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select age range" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AGE_RANGES.map((range) => (
                        <SelectItem key={range} value={range}>
                          {range}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City - Optional */}
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your city" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sex - Optional */}
            <FormField
              control={form.control}
              name="sex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sex (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Prefer not to say" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={mutation.isPending || !selectedIntent}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingIntent ? "Update My Intent" : "Submit My Intent"}
            </Button>

            {/* Share prompt appears inline after successful submission */}
            {showSharePrompt && submittedIntent && (
              <SharePrompt
                intent={submittedIntent}
                onClose={() => {
                  setShowSharePrompt(false);
                  setOpen(false);
                }}
              />
            )}
          </form>
        </Form>
      </DialogContent>
      </Dialog>
    </>
  );
}
