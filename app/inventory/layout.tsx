import { TopNav } from "@/components/top-nav";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4">{children}</main>
    </>
  );
}
