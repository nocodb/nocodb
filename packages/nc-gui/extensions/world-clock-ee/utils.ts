import type { AcceptableTimezone } from './timezone-data'

function isValidTimezone(timezone: AcceptableTimezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch (e) {
    return false
  }
}

// Function to get date object for a specific timezone
export function getDateForTimezone(timezone: AcceptableTimezone, date = new Date()) {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`)
  }

  const targetDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  const localOffset = date.getTimezoneOffset()
  const targetOffset = new Date(date.toLocaleString('en-US', { timeZone: timezone })).getTimezoneOffset()
  const offsetDiff = targetOffset - localOffset
  targetDate.setMinutes(targetDate.getMinutes() + offsetDiff)

  return targetDate
}

// Function to get timezone offset
export function calculateTimeDifference(targetTimezone: AcceptableTimezone) {
  const now = new Date()
  const targetTime = new Date(now.toLocaleString('en-US', { timeZone: targetTimezone }))
  // @ts-expect-error Date subtraction
  const timeDifferenceInMillis = targetTime - now
  const timeDifferenceInHours = timeDifferenceInMillis / (1000 * 60 * 60)

  return Math.round(timeDifferenceInHours) ? timeDifferenceInHours.toPrecision(3) : 0
}

export function formatTime(date: Date, format: '12H' | '24H' = '12H') {
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')

  if (format === '12H') {
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours || 12
    return `${hours}:${minutes} ${ampm}`
  } else if (format === '24H') {
    return `${hours.toString().padStart(2, '0')}:${minutes}`
  } else {
    throw new Error("Format must be either '12H' or '24H'")
  }
}
