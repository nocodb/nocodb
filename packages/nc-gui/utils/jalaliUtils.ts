import type dayjs from 'dayjs'
import { jalaaliMonthLength, toGregorian, toJalaali } from 'nocodb-sdk'

/**
 * dayjs-based helpers used by the date picker components to render and navigate a
 * Jalali (Persian) calendar. Values remain Gregorian `dayjs` objects — these
 * helpers only reinterpret the year/month/day through the Jalali calendar while
 * preserving the object's time and timezone.
 */

export function jalaliPartsOf(d: dayjs.Dayjs) {
  return toJalaali(d.year(), d.month() + 1, d.date())
}

// Set the Gregorian y/m/d of a dayjs object without overflow (day is reset to 1 first)
function withYmd(d: dayjs.Dayjs, gy: number, gm: number, gd: number): dayjs.Dayjs {
  return d
    .date(1)
    .year(gy)
    .month(gm - 1)
    .date(gd)
}

export function jalaliStartOfMonth(d: dayjs.Dayjs): dayjs.Dayjs {
  const { jy, jm } = jalaliPartsOf(d)
  const { gy, gm, gd } = toGregorian(jy, jm, 1)
  return withYmd(d, gy, gm, gd)
}

export function jalaliAddMonths(d: dayjs.Dayjs, n: number): dayjs.Dayjs {
  const { jy, jm, jd } = jalaliPartsOf(d)
  const total = jy * 12 + (jm - 1) + n
  const newJy = Math.floor(total / 12)
  const newJm = total - newJy * 12 + 1
  const newJd = Math.min(jd, jalaaliMonthLength(newJy, newJm))
  const { gy, gm, gd } = toGregorian(newJy, newJm, newJd)
  return withYmd(d, gy, gm, gd)
}

export function jalaliAddYears(d: dayjs.Dayjs, n: number): dayjs.Dayjs {
  return jalaliAddMonths(d, n * 12)
}

// A Gregorian dayjs representing the 1st of the given Jalali year/month (month 1-based)
export function jalaliDate(base: dayjs.Dayjs, jy: number, jm: number, jd = 1): dayjs.Dayjs {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return withYmd(base, gy, gm, gd)
}

export function isSameJalaliMonth(a: dayjs.Dayjs, b: dayjs.Dayjs): boolean {
  if (!a || !b) return false
  const pa = jalaliPartsOf(a)
  const pb = jalaliPartsOf(b)
  return pa.jy === pb.jy && pa.jm === pb.jm
}

export function isSameJalaliYear(a: dayjs.Dayjs, b: dayjs.Dayjs): boolean {
  if (!a || !b) return false
  return jalaliPartsOf(a).jy === jalaliPartsOf(b).jy
}

// Replace the Jalali year and/or month of a date, clamping the day to the target
// month's length while preserving the time/timezone.
export function jalaliSet(base: dayjs.Dayjs, parts: { jy?: number; jm?: number }): dayjs.Dayjs {
  const cur = jalaliPartsOf(base)
  const jy = parts.jy ?? cur.jy
  const jm = parts.jm ?? cur.jm
  const jd = Math.min(cur.jd, jalaaliMonthLength(jy, jm))
  return jalaliDate(base, jy, jm, jd)
}
