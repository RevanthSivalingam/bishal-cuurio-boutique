import { TopNav } from "@/components/top-nav";

const MAX_WIDTH = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
} as const;

type Props = {
  children: React.ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH;
};

export function AdminLayout({ children, maxWidth = "lg" }: Props) {
  return (
    <>
      <TopNav />
      <main className={`flex-1 w-full ${MAX_WIDTH[maxWidth]} mx-auto px-4 py-4`}>
        {children}
      </main>
    </>
  );
}
