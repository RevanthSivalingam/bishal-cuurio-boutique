"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

// Set NEXT_PUBLIC_SHOP_WHATSAPP to the shop's number with country code, digits only
// (e.g. "919876543210"). Without it, the link still opens WhatsApp so the shopper
// can pick the contact themselves.
const SHOP_WA = (process.env.NEXT_PUBLIC_SHOP_WHATSAPP ?? "").replace(/\D/g, "");

type Props = {
  name: string;
  price: string;
  available: boolean;
};

export function EnquireButton({ name, price, available }: Props) {
  const [href, setHref] = useState("#");

  useEffect(() => {
    const url = window.location.href;
    const message = `Hi! I'm interested in "${name}" (${price}). Is it still available?\n${url}`;
    const base = SHOP_WA ? `https://wa.me/${SHOP_WA}` : "https://wa.me/";
    // Build the link from the live page URL once mounted (needs window).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(`${base}?text=${encodeURIComponent(message)}`);
  }, [name, price]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brass-deep px-6 text-base font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass dark:text-[#14130f]"
    >
      <MessageCircle className="size-5" />
      {available ? "Enquire on WhatsApp" : "Ask if more are coming"}
    </a>
  );
}
