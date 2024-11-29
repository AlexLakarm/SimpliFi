import { Loader2 } from "lucide-react";

export default function DetailsLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-lg text-muted-foreground animate-pulse">
        Loading details...
      </p>
    </div>
  );
}
