"use client";

import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text?: string;
  url?: string;
};

export function ShareButtons({ title, text, url }: Props) {
  const [copied, setCopied] = useState(false);

  const resolveUrl = () => url ?? (typeof window !== "undefined" ? window.location.href : "");

  const shareNative = async () => {
    const href = resolveUrl();
    const shareText = text ? `${text}\n${href}` : href;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url: href });
        return;
      } catch {
        // user cancelled — fall through
      }
    }
    // Fallback: WhatsApp web
    const wa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${shareText}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(resolveUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — noop
    }
  };

  return (
    <div className="flex gap-2">
      <Button type="button" variant="brand" size="md" onClick={shareNative}>
        <Share2 className="size-4" />
        Share
      </Button>
      <Button type="button" variant="outline" size="md" onClick={copyLink}>
        {copied ? (
          <>
            <Check className="size-4" />
            Copied
          </>
        ) : (
          <>
            <Link2 className="size-4" />
            Copy link
          </>
        )}
      </Button>
    </div>
  );
}
