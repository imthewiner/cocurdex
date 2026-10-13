import {
  AlertCircle,
  Check,
  Circle,
  Loader2,
  type LucideIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib";

const statusIcons: Record<string, LucideIcon> = {
  running: Loader2,
  in_progress: Loader2,
  pending: Loader2,
  completed: Check,
  failed: AlertCircle,
  error: AlertCircle,
  cancelled: X,
  interrupted: X,
  exited: X,
  idle: Circle,
};

export function ExecutionStatusIcon({ status }: { status: string }) {
  const Icon = statusIcons[status] ?? Circle;
  return (
    <Icon
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground",
        Icon === Loader2 && "animate-spin",
        Icon === AlertCircle && "text-destructive",
      )}
    />
  );
}
