"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Package } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function TopNav() {
  const router = useRouter();

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/inventory" className="flex items-center gap-2 font-semibold">
          <Package className="size-5" />
          <span>GiftShop</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
