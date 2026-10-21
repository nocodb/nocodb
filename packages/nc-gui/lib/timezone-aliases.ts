import { timezoneAliases } from 'nocodb-sdk'

export function isSameTimezone(tzName: string, expectedTzName: string) {
  // Both directions: a canonical zone records only one of its aliases, so
  // looking only at timezoneAliases[expectedTzName] made the answer depend on
  // which argument came first.
  return (
    tzName === expectedTzName ||
    tzName === timezoneAliases[expectedTzName] ||
    timezoneAliases[tzName] === expectedTzName
  )
}

export default timezoneAliases
