import dayjs from 'dayjs'

export const renderValue = (value: string | number | boolean) => {
  if (!value || typeof value !== 'string') return value
  return value.replace(/\b(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(\+\d{2}:\d{2})?\b/g, (d) => {
    // TODO(timezone): retrieve the format from the corresponding column meta
    // assume hh:mm at this moment
    return dayjs(d).utc(value.indexOf('+') === -1).local().format('YYYY-MM-DD HH:mm')
  })
}
