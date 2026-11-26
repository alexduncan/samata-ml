import type { DateColumnStats, DatetimeColumnStats, TimeColumnStats } from '../../types/dataset';

/** Column statistics whose values {@link formatTemporalValue} can render. */
export type TemporalColumnStats = DateColumnStats | TimeColumnStats | DatetimeColumnStats;

function pad(value: number, width: number): string {
	return String(value).padStart(width, '0');
}

function formatTimeOfDay(value: number, precision: 'minute' | 'second' | 'millisecond'): string {
	const hours = Math.floor(value / 3_600_000) % 24;
	const minutes = Math.floor(value / 60_000) % 60;
	const seconds = Math.floor(value / 1000) % 60;
	const milliseconds = Math.floor(value % 1000);
	const base = `${pad(hours, 2)}:${pad(minutes, 2)}`;
	if (precision === 'minute') return base;
	if (precision === 'second') return `${base}:${pad(seconds, 2)}`;
	return `${base}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
}

/**
 * Formats a stored temporal value for display.
 *
 * Output is built from UTC fields only, so the browser's time zone never changes it. A date gives
 * `YYYY-MM-DD`. A time gives `HH:MM`, `HH:MM:SS` or `HH:MM:SS.sss` by precision. A datetime gives
 * `YYYY-MM-DDTHH:MMZ`, `YYYY-MM-DDTHH:MM:SSZ` or the full ISO string by precision. Legacy
 * datetime metadata without a precision gets the full ISO string.
 *
 * @param value - Stored value: epoch milliseconds, or milliseconds since midnight for a time.
 * @param column - Statistics of the column the value belongs to.
 * @returns The display string.
 */
export function formatTemporalValue(value: number, column: TemporalColumnStats): string {
	if (column.type === 'time') return formatTimeOfDay(value, column.precision);
	const iso = new Date(value).toISOString();
	if (column.type === 'date') return iso.slice(0, 10);
	if (column.precision === 'minute') return `${iso.slice(0, 16)}Z`;
	if (column.precision === 'second') return `${iso.slice(0, 19)}Z`;
	return iso;
}
