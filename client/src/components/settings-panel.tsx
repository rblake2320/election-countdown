import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Settings, Calendar as CalendarIcon, RotateCcw, Share2, Copy, Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  date: z.string().min(1, { message: "Date is required." }),
  time: z.string().min(1, { message: "Time is required." }),
  timezone: z.string().min(1, { message: "Timezone is required." }),
});

export interface CountdownSettings {
  title: string;
  date: string;
  time: string;
  timezone: string;
}

interface SettingsPanelProps {
  settings: CountdownSettings;
  onUpdate: (settings: CountdownSettings) => void;
}

const COMMON_TIMEZONES = [
  "Local",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "UTC",
];

const PRESETS = [
  {
    label: "US Midterm Elections 2026",
    title: "2026 Midterm Elections",
    date: "2026-11-03",
    time: "00:00",
    timezone: "America/New_York",
  },
  {
    label: "US Presidential Election 2028",
    title: "2028 Presidential Election",
    date: "2028-11-07",
    time: "00:00",
    timezone: "America/New_York",
  },
  {
    label: "US Presidential Inauguration 2029",
    title: "2029 Inauguration Day",
    date: "2029-01-20",
    time: "12:00",
    timezone: "America/New_York",
  },
];

export function SettingsPanel({ settings, onUpdate }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    form.reset(settings);
  }, [settings, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onUpdate(values);
    setOpen(false);
    toast({
      title: "Settings Updated",
      description: "Countdown has been updated successfully.",
    });
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    form.setValue("title", preset.title);
    form.setValue("date", preset.date);
    form.setValue("time", preset.time);
    form.setValue("timezone", preset.timezone);
  };

  const copyLink = () => {
    const params = new URLSearchParams();
    params.set("title", form.getValues("title"));
    params.set("date", form.getValues("date"));
    params.set("time", form.getValues("time"));
    params.set("timezone", form.getValues("timezone"));
    
    const url = `${window.location.origin}/?${params.toString()}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Link Copied",
      description: "Share this link to show the same countdown.",
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-sm hover:shadow-md transition-all border-border/50 bg-background/50 backdrop-blur-sm">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Countdown Settings</SheetTitle>
          <SheetDescription>
            Customize the election event you want to track.
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium leading-none mb-3">Quick Presets</h4>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="secondary"
                  className="justify-start font-normal h-auto py-3 px-4 hover:bg-primary/10 transition-colors"
                  onClick={() => applyPreset(preset)}
                >
                  <CalendarIcon className="mr-3 h-4 w-4 opacity-70" />
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm font-medium">{preset.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {preset.date} • {preset.timezone}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2028 Election" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 flex gap-2">
                <Button type="submit" className="flex-1 w-full">
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>

          <Separator />
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium leading-none">Share Event</h4>
            <Button variant="outline" className="w-full border-dashed" onClick={copyLink}>
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Link Copied!" : "Copy Share Link"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}