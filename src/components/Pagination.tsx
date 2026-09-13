import { useTranslation } from "../i18n/useTranslation";
import { colors, radius } from "../theme";
import { ChevronIcon } from "./icons";

interface PaginationProps {
  page: number; // 1-indexed
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// Simple client-side pagination control — data is fetched in full and
// sliced in-memory by the caller, which is fine at this app's current
// scale (a single shop's entries). Worth revisiting with server-side
// pagination (range() queries) if any one shop's history grows large
// enough that fetching everything up front becomes slow.
export default function Pagination({ page, totalItems, pageSize, onPageChange }: PaginationProps) {
  const { tr } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) return null;

  const navButton = (dir: "start" | "end", disabled: boolean, onClick: () => void) => (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.pill,
        border: `1px solid ${colors.border}`,
        background: disabled ? colors.surfaceMuted : colors.surface,
        color: disabled ? colors.textFaint : colors.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <ChevronIcon size={15} dir={dir} />
    </button>
  );

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 16 }}>
      {navButton("start", page <= 1, () => onPageChange(page - 1))}
      <span style={{ fontSize: 12.5, color: colors.textSecondary, fontWeight: 600 }}>
        {tr("pagination.pageOf", { current: page, total: totalPages })}
      </span>
      {navButton("end", page >= totalPages, () => onPageChange(page + 1))}
    </div>
  );
}
