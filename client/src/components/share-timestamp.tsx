import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Share2, Twitter, Facebook, Link2, Check } from "lucide-react";
import { format } from "date-fns";

interface ShareTimestampProps {
  joinedAt: string | Date;
  siteUrl?: string;
}

export function ShareTimestamp({ joinedAt, siteUrl = window.location.origin }: ShareTimestampProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const joinDate = new Date(joinedAt);
  const formattedDate = format(joinDate, "MMMM d, yyyy");
  const formattedTime = format(joinDate, "h:mm a");

  const shareMessage = `I joined Election Countdown on ${formattedDate} at ${formattedTime}. Every vote matters - join me and make your voice count!`;
  const shareUrl = siteUrl;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareMessage} ${shareUrl}`);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Share message copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer,width=600,height=400");
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareMessage)}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer,width=600,height=400");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Election Countdown",
          text: shareMessage,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          Spread the Word
        </CardTitle>
        <CardDescription>
          You joined on {formattedDate} at {formattedTime}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share your timestamp to encourage others to participate before it's too late!
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTwitterShare}
            className="gap-2"
            data-testid="button-share-twitter"
          >
            <Twitter className="h-4 w-4" />
            Twitter/X
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleFacebookShare}
            className="gap-2"
            data-testid="button-share-facebook"
          >
            <Facebook className="h-4 w-4" />
            Facebook
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-2"
            data-testid="button-share-copy"
          >
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </Button>

          {"share" in navigator && (
            <Button
              variant="default"
              size="sm"
              onClick={handleNativeShare}
              className="gap-2"
              data-testid="button-share-native"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground italic">
          Voting is a civic duty. How you vote is your personal choice to share or keep private.
        </p>
      </CardContent>
    </Card>
  );
}
