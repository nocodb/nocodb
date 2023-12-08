import dayjs, { extend } from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import duration from 'dayjs/plugin/duration.js'
import utc from 'dayjs/plugin/utc.js'
import weekday from 'dayjs/plugin/weekday.js'
import timezone from 'dayjs/plugin/timezone.js'
import updateLocale from 'dayjs/plugin/updateLocale'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin(() => {
  extend(utc)
  extend(relativeTime)
  extend(customParseFormat)
  extend(duration)
  extend(weekday)
  extend(timezone)
  extend(updateLocale)
  dayjs.updateLocale('en', {
    weekStart: 1,
  })
})
