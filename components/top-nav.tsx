"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Package, Receipt, BarChart3 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/inventory", label: "Inventory", Icon: Package },
  { href: "/sales", label: "Sales", Icon: Receipt },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/inventory" className="flex items-center gap-2 font-semibold shrink-0">
          <Package className="size-5" />
          <span className="truncate">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 px-2 py-1 text-sm rounded-md ${
                  active ? "bg-zinc-100 font-medium" : "text-zinc-600"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
