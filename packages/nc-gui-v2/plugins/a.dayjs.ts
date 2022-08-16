import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import duration from 'dayjs/plugin/duration.js'
import utc from 'dayjs/plugin/utc.js'
import weekday from 'dayjs/plugin/weekday.js'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin(() => {
  dayjs.extend(utc)
  dayjs.extend(relativeTime)
  dayjs.extend(customParseFormat)
  dayjs.extend(duration)
  dayjs.extend(weekday)
})
