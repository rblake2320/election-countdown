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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Vote, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
const VOTE_INTENTS = ["red", "blue", "undecided"] as const;
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
] as const;

const formSchema = z.object({
  intent: z.enum(VOTE_INTENTS),
  state: z.string().length(2, "Please select your state"),
  ageRange: z.enum(AGE_RANGES).optional(),
  city: z.string().optional(),
  sex: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface VoteIntentFormProps {
  existingIntent?: {
    intent: string;
    state: string;
    ageRange?: string | null;
    city?: string | null;
    sex?: string | null;
  } | null;
}

export function VoteIntentForm({ existingIntent }: VoteIntentFormProps) {
  const [open, setOpen] = useState(false);
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
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to save voting intent");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Intent Saved",
        description: "Your voting intention has been recorded.",
      });
      setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-primary/20 hover:border-primary/40"
        >
          <Vote className="h-4 w-4" />
          {existingIntent ? "Update Intent" : "Share Your Vote Plan"}
        </Button>
      </DialogTrigger>
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
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={field.value === "red" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "red" && "bg-red-600 hover:bg-red-700 text-white"
                      )}
                      onClick={() => field.onChange("red")}
                    >
                      <span className="text-lg">🔴</span>
                      <span className="text-xs">Republican</span>
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "undecided" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "undecided" && "bg-purple-600 hover:bg-purple-700 text-white"
                      )}
                      onClick={() => field.onChange("undecided")}
                    >
                      <span className="text-lg">🟣</span>
                      <span className="text-xs">Undecided</span>
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "blue" ? "default" : "outline"}
                      className={cn(
                        "h-16 flex-col gap-1",
                        field.value === "blue" && "bg-blue-600 hover:bg-blue-700 text-white"
                      )}
                      onClick={() => field.onChange("blue")}
                    >
                      <span className="text-lg">🔵</span>
                      <span className="text-xs">Democrat</span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
