import Link from "next/link";
import { MailX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function EmailNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MailX className="size-6" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold">Email not found</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This email may have been deleted, or the link is no longer valid.
        </p>
      </div>
      <Button variant="outline" render={<Link href="/inbox" />}>
        Back to inbox
      </Button>
    </div>
  );
}
