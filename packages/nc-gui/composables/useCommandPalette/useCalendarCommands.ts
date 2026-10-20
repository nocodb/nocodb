import type dayjs from 'dayjs'

// Cmd+K's calendar commands (today, previous / next, range, side panel, new record on a date) are EE; CE registers none.

export function useCalendarCommands() {}

export function useCalendarNewRecordCommands(_deps: { fromDate: () => dayjs.Dayjs | undefined; newRecord: () => unknown }) {}
