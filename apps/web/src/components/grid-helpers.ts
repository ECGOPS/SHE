import type { GridColDef, GridLocaleText } from '@mui/x-data-grid';

/** Titles are stored in varchar(256) columns. */
export const TITLE_MAX = 256;

/** Below this width the module lists show cards; at and above it, the table. */
export const TABLE_MIN_WIDTH_QUERY = '(min-width: 1360px)';

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  // A plain "2026-11-08" is a calendar day, not midnight UTC; read it as local
  // so users west of UTC don't see the day before.
  const day = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "8 Nov 2026" (month spelled out, so 8/11 vs 11/8 can't be misread). */
export function formatDate(value: unknown): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '';
}

/** "8 Nov 2026, 07:42" */
export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '';
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}

/** Table footer with thousands separators: "1–25 of 12,847". */
export const gridLocaleText: Partial<GridLocaleText> = {
  MuiTablePagination: {
    labelDisplayedRows: ({ from, to, count }) =>
      `${formatCount(from)}–${formatCount(to)} of ${count === -1 ? `more than ${formatCount(to)}` : formatCount(count)}`,
  },
};

/**
 * Let a table fit the space it gets instead of pushing columns off to the
 * side. Fixed widths become shares of the free space with a smaller floor,
 * so text columns shrink (the full value is in the cell's tooltip). Columns
 * that render chips keep their width, since a cut-off status reads wrong.
 * The title column takes the largest share.
 */
export function fitColumns(columns: GridColDef[]): GridColDef[] {
  return columns.map((col) => {
    if (col.flex) {
      return { ...col, flex: 3, minWidth: Math.min(col.minWidth ?? 180, 180) };
    }
    const width = col.width ?? 150;
    const keepWhole = typeof col.renderCell === 'function';
    return {
      ...col,
      flex: width / 100,
      minWidth: keepWhole ? width : Math.max(96, Math.round(width * 0.55)),
    };
  });
}

/** Clamp a card title to a few lines; the full title is on the detail page. */
export function clampLines(lines: number) {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  } as const;
}
