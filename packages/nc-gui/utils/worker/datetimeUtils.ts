import { getTimeZones } from '@vvo/tzdb'
export { constructDateFormat, constructDateTimeFormat, constructTimeFormat, workerWithTimezone } from 'nocodb-sdk'

const timezones = getTimeZones({ includeUtc: true })
export function getTimeZoneFromName(name: string = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return timezones.find((k) => isSameTimezone(k.name, name))
}
