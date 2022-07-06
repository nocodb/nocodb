export const precisions = [
  { id: 0, title: '1' },
  { id: 1, title: '1.0' },
  { id: 2, title: '1.00' },
  { id: 3, title: '1.000' },
  { id: 4, title: '1.0000' },
  { id: 5, title: '1.00000' },
  { id: 6, title: '1.000000' },
  { id: 7, title: '1.0000000' },
  { id: 8, title: '1.00000000' }
]

export const renderPercent = (value, precision, withPercentSymbol = true) => {
  if (!value) { return value }
  value = (Number(value) * 100).toFixed(precision)
  if (withPercentSymbol) { return padPercentSymbol(value) }
  return value
}

export const isValidPercent = (val, negative) => {
  if (negative) { return /^-?\d{1,20}(\.\d+)?$/.test(val) }
  return /^\d{1,20}(\.\d+)?$/.test(val)
}

const padPercentSymbol = (value) => {
  return value ? value + '%' : value
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
