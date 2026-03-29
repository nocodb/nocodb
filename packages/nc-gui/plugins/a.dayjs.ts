import dayjs, { extend } from 'dayjs'
import advanced from 'dayjs/plugin/advancedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import duration from 'dayjs/plugin/duration.js'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import timezone from 'dayjs/plugin/timezone.js'
import updateLocale from 'dayjs/plugin/updateLocale'
import utc from 'dayjs/plugin/utc.js'
import weekday from 'dayjs/plugin/weekday.js'

export default defineNuxtPlugin(() => {
  extend(utc)
  extend(relativeTime)
  extend(customParseFormat)
  extend(duration)
  extend(weekday)
  extend(timezone)
  extend(updateLocale)
  extend(isSameOrBefore)
  extend(isSameOrAfter)
  extend(isBetween)
  extend(advanced)
  dayjs.updateLocale('en', {
    weekStart: 1,
    relativeTime: {
      future: 'in %s',
      past: '%s ago',
      s: '%ds',
      m: '1m',
      mm: '%dm',
      h: '1h',
      hh: '%dh',
      d: '1d',
      dd: '%dd',
      M: '1mo',
      MM: '%dmo',
      y: '1y',
      yy: '%dy',
    },
  })
})
