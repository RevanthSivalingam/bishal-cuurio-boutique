function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  if (words.length === 0) return "?";
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

// Deterministic hue from string hash so the same product keeps the same colour.
function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

type Props = {
  name: string;
  className?: string;
};

export function InitialsAvatar({ name, className }: Props) {
  const hue = hueFrom(name);
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] font-semibold ${className ?? ""}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 85%), hsl(${(hue + 40) % 360} 55% 75%))`,
        color: `hsl(${hue} 40% 25%)`,
      }}
      aria-hidden="true"
    >
      <span className="text-4xl md:text-5xl tracking-tight">
        {initials(name)}
      </span>
    </div>
  );
}
