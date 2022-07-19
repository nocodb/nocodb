import dayjs from 'dayjs'

import * as relativeTime from 'dayjs/plugin/relativeTime'
import * as utc from 'dayjs/plugin/utc'
dayjs.extend(utc)
dayjs.extend(relativeTime)

export function calculateDiff(date) {
  return dayjs.utc(date).fromNow()
}
