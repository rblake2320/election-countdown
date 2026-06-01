import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerificationBadgeProps {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isFullyVerified?: boolean;
  ecId?: string | null;
  flaggedAsBot?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function VerificationBadge({
  emailVerified = false,
  phoneVerified = false,
  isFullyVerified = false,
  ecId,
  flaggedAsBot = false,
  size = "sm",
  showLabel = false,
  className,
}: VerificationBadgeProps) {
  const iconSize = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const textSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-[10px]";

  if (flaggedAsBot) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1", className)}>
              <ShieldAlert className={cn(iconSize, "text-red-500")} />
              {showLabel && <span className={cn(textSize, "text-red-500 font-medium")}>Flagged</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">This account has been flagged for review</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isFullyVerified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1", className)}>
              <ShieldCheck className={cn(iconSize, "text-green-600")} />
              {showLabel && <span className={cn(textSize, "text-green-600 font-medium")}>Verified</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Verified user {ecId ? <span className="font-mono">{ecId}</span> : ""}
              <br />Email and phone verified
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (emailVerified || phoneVerified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1", className)}>
              <Shield className={cn(iconSize, "text-yellow-600")} />
              {showLabel && <span className={cn(textSize, "text-yellow-600 font-medium")}>Partial</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Partially verified
              <br />{emailVerified ? "Email verified" : "Phone verified"} — complete verification for full badge
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1", className)}>
            <Shield className={cn(iconSize, "text-muted-foreground/40")} />
            {showLabel && <span className={cn(textSize, "text-muted-foreground font-medium")}>Unverified</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Unverified account — identity not confirmed</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
