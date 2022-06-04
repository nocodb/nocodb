import moment from 'moment'

export const durationOptions = [
  { id: 0, title: 'h:mm', example: '(e.g. 1:23)' },
  { id: 1, title: 'h:mm:ss', example: '(e.g. 3:45, 1:23:40)' },
  { id: 2, title: 'h:mm:ss.s', example: '(e.g. 3:34.6, 1:23:40.0)' },
  { id: 3, title: 'h:mm:ss.ss', example: '(e.g. 3.45.67, 1:23:40.00)' },
  { id: 4, title: 'h:mm:ss.sss', example: '(e.g. 3.45.678, 1:23:40.000)' }
]

// pad zero
// mm && ss
// e.g.  3 -> 03
// e.g. 12 -> 12
// sss
// e.g.  1 -> 001
// e.g. 10 -> 010
const padZero = (val, isSSS = false) => {
  if (isSSS) {
    if (val >= 0 && val <= 9) {
      return `00${val}`
    } else if (val >= 10 && val <= 99) {
      return `0${val}`
    }
  } else if (val >= 0 && val <= 9) {
    return `0${val}`
  }
  return val
}

export const parseDuration = (val, durationType) => {
  if (!val) { return null }
  // 600000ms --> 10:00 (10 mins)
  const d = moment.duration(val, 'milliseconds')._data
  if (durationType === 0) {
    // h:mm
    return `${d.hours}:${padZero(d.minutes)}`
  } else if (durationType === 1) {
    // h:mm:ss
    return `${d.hours}:${padZero(d.minutes)}:${padZero(d.seconds)}`
  } else if (durationType === 2) {
    // h:mm:ss.s
    return `${d.hours}:${padZero(d.minutes)}:${padZero(d.seconds)}.${~~(d.milliseconds / 100)}`
  } else if (durationType === 3) {
    // h:mm:ss.ss
    return `${d.hours}:${padZero(d.minutes)}:${padZero(d.seconds)}.${padZero(~~(d.milliseconds / 10))}`
  } else if (durationType === 4) {
    // h:mm:ss.sss
    return `${d.hours}:${padZero(d.minutes)}:${padZero(d.seconds)}.${padZero(d.milliseconds, true)}`
  }
  return val
}

export const getMSFromDuration = (val, durationType) => {
  const res = {
    valid: false,
    ms: null
  }
  // 10:00 (10 mins) -> 600000ms
  const duration = moment.duration(val, durationType == 0 ? 'minutes' : 'seconds')
  if (moment.isDuration(duration)) {
    const d = duration._data
    const ms = d.hours * 3600000 + d.minutes * 60000 + d.seconds * 1000 + d.milliseconds
    if (ms >= 0) {
      res.valid = true
      res.ms = ms
    }
  }
  return res
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
