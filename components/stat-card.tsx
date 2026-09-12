/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend.
 */

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  /** Small line under the value: the period a total refers to, for instance. */
  hint?: string;
}

export default function StatCard({ label, value, trend, trendUp, hint }: StatCardProps) {
  return (
    <div className="panel rounded p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
      {trend && (
        <p className={`text-xs mt-1 ${trendUp ? "text-success" : "text-error"}`}>
          {trendUp ? "Up" : "Down"} {trend}
        </p>
      )}
    </div>
  );
}
