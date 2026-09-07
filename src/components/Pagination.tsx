import { useTranslation } from "../i18n/useTranslation";

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

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 13 }}>
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {tr("pagination.prev")}
      </button>
      <span>{tr("pagination.pageOf", { current: page, total: totalPages })}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {tr("pagination.next")}
      </button>
    </div>
  );
}
