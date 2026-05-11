type Props = {
  values: number[];
  height?: number;
  "aria-label"?: string;
};

export function Sparkline({ values, height = 40, "aria-label": ariaLabel }: Props) {
  if (values.length === 0) {
    return (
      <div
        className="skeleton rounded-md"
        style={{ height }}
        aria-hidden="true"
      />
    );
  }
  const max = Math.max(1, ...values);
  const barWidth = 100 / values.length;
  const gap = Math.min(barWidth * 0.2, 1.5);
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={ariaLabel ?? "Trend chart"}
    >
      {values.map((v, i) => {
        const h = (v / max) * (height - 2) + 2;
        return (
          <rect
            key={i}
            x={i * barWidth + gap / 2}
            y={height - h}
            width={barWidth - gap}
            height={h}
            className="fill-emerald-500"
            rx="0.5"
          />
        );
      })}
    </svg>
  );
}
