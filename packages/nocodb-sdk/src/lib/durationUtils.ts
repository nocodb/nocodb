import { durationOptions } from './UITypes'
// pad zero
// mm && ss
// e.g.  3 -> 03
// e.g. 12 -> 12
// sss
// e.g.  1 -> 001
// e.g. 10 -> 010
const padZero = (val: number, isSSS = false) => {
  return `${val}`.padStart(isSSS ? 3 : 2, '0')
}

export const convertMS2Duration = (val: any, durationType: number) => {
  if (val === '' || val === null || val === undefined) {
    return val
  }
  // 600.000 s --> 10:00 (10 mins)
  const milliseconds = Math.round((val % 1) * 1000)
  const centiseconds = Math.round(milliseconds / 10)
  const deciseconds = Math.round(centiseconds / 10)
  const hours = Math.floor(parseInt(val, 10) / (60 * 60))
  const minutes = Math.floor((parseInt(val, 10) - hours * 60 * 60) / 60)
  const seconds = parseInt(val, 10) - hours * 60 * 60 - minutes * 60

  if (durationType === 0) {
    // h:mm
    return `${padZero(hours)}:${padZero(minutes + (seconds >= 30 ? 1 : 0))}`
  } else if (durationType === 1) {
    // h:mm:ss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`
  } else if (durationType === 2) {
    // h:mm:ss.s
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${deciseconds}`
  } else if (durationType === 3) {
    // h:mm:ss.ss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(centiseconds)}`
  } else if (durationType === 4) {
    // h:mm:ss.sss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(milliseconds, true)}`
  }
  return val
}

export const convertDurationToSeconds = (val: any, durationType: number) => {
  // 10:00 (10 mins) -> 600.000 s
  const res = {
    _sec: 0,
    _isValid: true,
  }
  const durationRegex = durationOptions[durationType].regex
  if (durationRegex.test(val)) {
    let h, mm, ss
    const groups = val.match(durationRegex)
    if (groups[0] && groups[1] && !groups[2] && !groups[3] && !groups[4]) {
      const val = parseInt(groups[1], 10)
      if (groups.input.slice(-1) === ':') {
        // e.g. 30:
        h = groups[1]
        mm = 0
        ss = 0
      } else if (durationType === 0) {
        // consider it as minutes
        // e.g. 360 -> 06:00
        h = Math.floor(val / 60)
        mm = Math.floor(val - (h * 3600) / 60)
        ss = 0
      } else {
        // consider it as seconds
        // e.g. 3600 -> 01:00:00
        h = Math.floor(groups[1] / 3600)
        mm = Math.floor(groups[1] / 60) % 60
        ss = val % 60
      }
    } else if (durationType !== 0 && groups[1] && groups[2] && !groups[3]) {
      // 10:10 means mm:ss instead of h:mm
      // 10:10:10 means h:mm:ss
      h = 0
      mm = groups[1]
      ss = groups[2]
    } else {
      h = groups[1] || 0
      mm = groups[2] || 0
      ss = groups[3] || 0
    }

    if (durationType === 0) {
      // h:mm
      res._sec = h * 3600 + mm * 60
    } else if (durationType === 1) {
      // h:mm:ss
      res._sec = h * 3600 + mm * 60 + ss * 1
    } else if (durationType === 2) {
      // h:mm:ss.s (deciseconds)
      const ds = groups[4] || 0
      const len = (Math.log(ds) * Math.LOG10E + 1) | 0
      const ms =
        // e.g. len = 4: 1234 -> 1, 1456 -> 1
        // e.g. len = 3:  123 -> 1,  191 -> 2
        // e.g. len = 2:   12 -> 1 ,  16 -> 2
        (len === 4
          ? Math.round(ds / 1000)
          : len === 3
          ? Math.round(ds / 100)
          : len === 2
          ? Math.round(ds / 10)
          : // take whatever it is
            ds) * 100
      res._sec = h * 3600 + mm * 60 + ss * 1 + ms / 1000
    } else if (durationType === 3) {
      // h:mm:ss.ss (centiseconds)
      const cs = groups[4] || 0
      const len = (Math.log(cs) * Math.LOG10E + 1) | 0
      const ms =
        // e.g. len = 4: 1234 -> 12, 1285 -> 13
        // e.g. len = 3:  123 -> 12,  128 -> 13
        // check the third digit
        (len === 4
          ? Math.round(cs / 100)
          : len === 3
          ? Math.round(cs / 10)
          : // take whatever it is
            cs) * 10
      res._sec = h * 3600 + mm * 60 + ss * 1 + ms / 1000
    } else if (durationType === 4) {
      // h:mm:ss.sss (milliseconds)
      let ms = groups[4] || 0
      const len = (Math.log(ms) * Math.LOG10E + 1) | 0
      ms =
        // e.g. 1235 -> 124
        // e.g. 1234 -> 123
        (len === 4
          ? Math.round(ms / 10)
          : // take whatever it is
            ms) * 1
      res._sec = h * 3600 + mm * 60 + ss * 1 + ms / 1000
    }
  } else {
    res._isValid = false
  }
  return res
}
