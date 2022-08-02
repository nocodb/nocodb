import dayjs from 'dayjs'

export const timeAgo = (date: any) => {
  return dayjs.utc(date).fromNow()
}

export const handleTZ = (val: any) => {
  if (!val) {
    return
  }
  if (typeof val !== 'string') {
    return val
  }
  return val.replace(
    /((?:-?(?:[1-9][0-9]*)?[0-9]{4})-(?:1[0-2]|0[1-9])-(?:3[01]|0[1-9]|[12][0-9])T(?:2[0-3]|[01][0-9]):(?:[0-5][0-9]):(?:[0-5][0-9])(?:\.[0-9]+)?(?:Z|[+-](?:2[0-3]|[01][0-9]):[0-5][0-9]))/g,
    (i, v) => {
      return dayjs(v).format('YYYY-MM-DD HH:mm')
    },
  )
}
