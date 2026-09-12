import { AdminLayout } from "@/components/admin-layout";

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout maxWidth="md">{children}</AdminLayout>;
}
