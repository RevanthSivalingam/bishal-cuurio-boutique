import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3 px-4">
      {Icon && (
        <div className="size-14 rounded-full bg-zinc-100 flex items-center justify-center">
          <Icon className="size-7 text-zinc-400" aria-hidden="true" />
        </div>
      )}
      <div>
        <h2 className="font-medium text-base">{title}</h2>
        {description && (
          <p className="text-sm text-zinc-500 mt-1 max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
