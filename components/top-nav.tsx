"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LogOut,
  LogIn,
  Package,
  Receipt,
  BarChart3,
  Tags,
  Home,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const PUBLIC_NAV = [{ href: "/", label: "Catalog", Icon: Home }];

const AUTHED_NAV = [
  { href: "/", label: "Catalog", Icon: Home },
  { href: "/inventory", label: "Inventory", Icon: Package },
  { href: "/categories", label: "Categories", Icon: Tags },
  { href: "/sales", label: "Sales", Icon: Receipt },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let unsubscribed = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!unsubscribed) setAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!unsubscribed) setAuthed(!!session?.user);
    });
    return () => {
      unsubscribed = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const nav = authed ? AUTHED_NAV : PUBLIC_NAV;

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold shrink-0"
        >
          <Package className="size-5" />
          <span className="truncate">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {nav.map(({ href, label, Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 px-2 py-1 text-sm rounded-md shrink-0 ${
                  active ? "bg-zinc-100 font-medium" : "text-zinc-600"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        {authed === null ? (
          <div className="w-20" />
        ) : authed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        ) : (
          <Link href="/login">
            <Button variant="ghost" size="sm">
              <LogIn className="size-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
