/**
 * Status label for DM status. Plain text; color carries the state.
 */

const statusConfig: Record<string, { text: string; label: string }> = {
  SENT: { text: "text-success", label: "Inviato" },
  FAILED: { text: "text-error", label: "Fallito" },
  PENDING: { text: "text-warning", label: "In attesa" },
  SKIPPED_DEDUP: { text: "text-muted", label: "Dedup" },
  SKIPPED_RATE_LIMIT: { text: "text-warning", label: "Limite di invii raggiunto" },
  SKIPPED_PLAN_LIMIT: { text: "text-warning", label: "Saltato" },
  SKIPPED_NO_MATCH: { text: "text-muted", label: "Nessuna corrispondenza" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.PENDING;

  return (
    <span className={`shrink-0 whitespace-nowrap text-sm ${config.text}`}>
      {config.label}
    </span>
  );
}
