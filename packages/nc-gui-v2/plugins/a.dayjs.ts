import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import duration from 'dayjs/plugin/duration'
import utc from 'dayjs/plugin/utc'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin(() => {
  dayjs.extend(utc)
  dayjs.extend(relativeTime)
  dayjs.extend(customParseFormat)
  dayjs.extend(duration)
})
