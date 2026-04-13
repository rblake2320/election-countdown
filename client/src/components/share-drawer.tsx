import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Twitter, Facebook, Mail, MessageCircle } from "lucide-react";
import { useTracking } from "@/hooks/use-tracking";
import { useToast } from "@/hooks/use-toast";

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ShareDrawer({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { track, trackShareAction } = useTracking();
  const { toast } = useToast();

  const shareUrl = window.location.href.split("?")[0];
  const shareText = "Track every second until the next election. Make your vote count!";

  const handleOpen = () => {
    setOpen(true);
    track("share_click");
  };

  const handleShare = async (platform: string) => {
    const referralCode = await trackShareAction(platform, "general", shareUrl);
    const urlWithRef = referralCode ? `${shareUrl}?ref=${referralCode}` : shareUrl;

    switch (platform) {
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(urlWithRef)}`,
          "_blank",
          "width=550,height=420"
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlWithRef)}`,
          "_blank",
          "width=550,height=420"
        );
        break;
      case "email":
        window.location.href = `mailto:?subject=${encodeURIComponent("Election Countdown")}&body=${encodeURIComponent(`${shareText}\n\n${urlWithRef}`)}`;
        break;
      case "sms":
        window.location.href = `sms:?body=${encodeURIComponent(`${shareText} ${urlWithRef}`)}`;
        break;
      case "copy_link":
        await navigator.clipboard.writeText(urlWithRef);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Link copied", description: "Share link copied to clipboard" });
        break;
      case "native":
        if (navigator.share) {
          try {
            await navigator.share({ title: "Election Countdown", text: shareText, url: urlWithRef });
          } catch {
            // User cancelled
          }
        }
        break;
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen} style={{ cursor: "pointer" }}>
          {trigger}
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-secondary w-9 h-9 sm:w-10 sm:h-10"
          aria-label="Share"
          onClick={handleOpen}
        >
          <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Share Election Countdown</DialogTitle>
          <DialogDescription>Spread the word and help others stay informed</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => handleShare("twitter")}
            className="gap-2 h-12 justify-start"
          >
            <XIcon className="h-4 w-4" />
            X / Twitter
          </Button>

          <Button
            variant="outline"
            onClick={() => handleShare("facebook")}
            className="gap-2 h-12 justify-start"
          >
            <Facebook className="h-4 w-4" />
            Facebook
          </Button>

          <Button
            variant="outline"
            onClick={() => handleShare("email")}
            className="gap-2 h-12 justify-start"
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>

          <Button
            variant="outline"
            onClick={() => handleShare("sms")}
            className="gap-2 h-12 justify-start"
          >
            <MessageCircle className="h-4 w-4" />
            Text Message
          </Button>
        </div>

        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() => handleShare("copy_link")}
            className="w-full gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>

        {typeof navigator.share === "function" && (
          <Button
            variant="ghost"
            onClick={() => handleShare("native")}
            className="w-full gap-2 text-muted-foreground"
          >
            <Share2 className="h-4 w-4" />
            More sharing options...
          </Button>
        )}
      </DialogContent>
      </Dialog>
    </>
  );
}
