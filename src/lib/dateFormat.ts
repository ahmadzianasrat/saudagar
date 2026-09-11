import jalaali from "jalaali-js";
import type { DigitStyle } from "../contexts/LanguageContext";

export type DateSystem = "gregorian" | "shamsi";

const EASTERN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function swapDigits(str: string, digitStyle: DigitStyle): string {
  if (digitStyle !== "eastern_arabic") return str;
  return str.replace(/[0-9]/g, (d) => EASTERN_DIGITS[Number(d)]);
}

// Using the jalaali-js library rather than a hand-written conversion —
// Gregorian<->Jalali (Shamsi/Solar Hijri) has genuinely tricky leap-year
// edge cases (a 33-year break-point cycle, not a simple every-4-years
// rule), and getting that subtly wrong in a record-keeping app is a
// worse outcome than a small, well-tested dependency.
export function formatDate(dateInput: string | Date, dateSystem: DateSystem, digitStyle: DigitStyle = "western"): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  let str: string;

  if (dateSystem === "shamsi") {
    const { jy, jm, jd } = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    str = `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
  } else {
    str = date.toLocaleDateString("en-CA"); // YYYY-MM-DD, locale-stable format
  }

  return swapDigits(str, digitStyle);
}

export function formatDateTime(dateInput: string | Date, dateSystem: DateSystem, digitStyle: DigitStyle = "western"): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const time = swapDigits(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), digitStyle);
  return `${formatDate(date, dateSystem, digitStyle)} ${time}`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(dateInput: string | Date): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return isSameCalendarDay(date, new Date());
}

export function isYesterday(dateInput: string | Date): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(date, yesterday);
}

// Returns a group header label for a given date — "Today"/"Yesterday"
// (translated) for recent entries, otherwise the formatted date, so
// entry/transaction tables can visually separate today's activity
// from older history at a glance.
export function dateGroupLabel(
  dateInput: string | Date,
  dateSystem: DateSystem,
  digitStyle: DigitStyle,
  tr: (key: string) => string
): string {
  if (isToday(dateInput)) return tr("date.today");
  if (isYesterday(dateInput)) return tr("date.yesterday");
  return formatDate(dateInput, dateSystem, digitStyle);
}

// Relative "time ago" display — shown alongside, not instead of, the
// full date/time, per the request that both be visible together.
export function timeAgo(dateInput: string | Date, tr: (key: string, vars?: Record<string, string | number>) => string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return tr("time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return tr("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return tr("time.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return tr("time.monthsAgo", { count: months });
  const years = Math.floor(months / 12);
  return tr("time.yearsAgo", { count: years });
}
