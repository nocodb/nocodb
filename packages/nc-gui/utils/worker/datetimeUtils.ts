import { getTimeZones } from '@vvo/tzdb'
import dayjs from 'dayjs'
export { constructDateFormat, constructDateTimeFormat, constructTimeFormat } from 'nocodb-sdk'

const timezones = getTimeZones({ includeUtc: true })
export function getTimeZoneFromName(name: string = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return timezones.find((k) => isSameTimezone(k.name, name))
}

export function workerWithTimezone(isEeUI: boolean, timezone?: string) {
  return {
    dayjsTz(value?: string | number | null | dayjs.Dayjs, format?: string) {
      if (!isEeUI) {
        return dayjs(value, format)
      }
      if (typeof value === 'object') {
        return value
      }
      if (timezone) {
        if (!format) {
          return dayjs.tz(value, timezone)
        } else {
          return dayjs.tz(value, format, timezone)
        }
      } else {
        return dayjs(value, format)
      }
    },
    timezonize(value?: dayjs.Dayjs) {
      if (!value) {
        return undefined
      }
      if (!isEeUI) {
        return value.local()
      }
      if (timezone) {
        return value.tz(timezone)
      } else {
        return value.local()
      }
    },
  }
}
