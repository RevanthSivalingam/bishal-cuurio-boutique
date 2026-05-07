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
  Layers,
  Menu,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PUBLIC_NAV = [{ href: "/", label: "Catalog", Icon: Home }];

const AUTHED_NAV = [
  { href: "/", label: "Catalog", Icon: Home },
  { href: "/sales", label: "Sales", Icon: Receipt },
  { href: "/categories", label: "Categories", Icon: Tags },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/inventory", label: "Inventory", Icon: Package },
  { href: "/stock", label: "Stock", Icon: Layers },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

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

  // close drawer on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // lock body scroll while drawer open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/");
    router.refresh();
  };

  const nav = authed ? AUTHED_NAV : PUBLIC_NAV;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-zinc-100 active:bg-zinc-200"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="size-6" />
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold min-w-0"
          >
            <Package className="size-5 shrink-0" />
            <span className="truncate">
              {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
            </span>
          </Link>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 -ml-2 rounded-md hover:bg-zinc-100"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
          <span className="font-semibold truncate">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </span>
        </div>

        <nav className="flex flex-col p-2">
          {nav.map(({ href, label, Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  active
                    ? "bg-zinc-100 font-medium text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 mt-2 p-2">
          {authed === null ? null : authed ? (
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <LogIn className="size-5" />
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
