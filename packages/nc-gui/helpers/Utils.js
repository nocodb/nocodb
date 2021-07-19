export default class Utils {
  static dateToHowManyAgo(stringDate) {
    const currDate = new Date()
    const diffMs = currDate.getTime() - new Date(stringDate).getTime()
    const sec = diffMs / 1000
    if (sec < 60) { return parseInt(sec) + ' second' + (parseInt(sec) > 1 ? 's' : '') + ' ago' }
    const min = sec / 60
    if (min < 60) { return parseInt(min) + ' minute' + (parseInt(min) > 1 ? 's' : '') + ' ago' }
    const h = min / 60
    if (h < 24) { return parseInt(h) + ' hour' + (parseInt(h) > 1 ? 's' : '') + ' ago' }
    const d = h / 24
    if (d < 30) { return parseInt(d) + ' day' + (parseInt(d) > 1 ? 's' : '') + ' ago' }
    const m = d / 30
    if (m < 12) { return parseInt(m) + ' month' + (parseInt(m) > 1 ? 's' : '') + ' ago' }
    const y = m / 12
    return parseInt(y) + ' year' + (parseInt(y) > 1 ? 's' : '') + ' ago'
  }

  static findById(o, id) {
    // Early return
    if (o.id === id) {
      return o
    }
    let result, p
    for (p in o) {
      // eslint-disable-next-line no-prototype-builtins
      if (o.hasOwnProperty(p) && typeof o[p] === 'object') {
        result = this.findById(o[p], id)
        if (result) {
          return result
        }
      }
    }
    return result
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
