import { AdminLayout } from "@/components/admin-layout";

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout maxWidth="sm">{children}</AdminLayout>;
}
