export default function(type) {
  switch (type) {
    case 'int':
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'bigint':
    case 'bit':
    case 'boolean':
    case 'float':
    case 'decimal':
    case 'double':
    case 'serial':
      return 'number'
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'time':
    case 'year':
      return 'date'
    case 'char':
    case 'varchar':
    case 'nchar':
    case 'text':
    case 'tinytext':
    case 'mediumtext':
    case 'longtext':
      return 'string'
    case 'binary':
      break
    case 'varbinary':
      break
    case 'blob':
      break
    case 'tinyblob':
      break
    case 'mediumblob':
      break
    case 'longblob':
      break
    case 'enum':
    case 'set':
      return 'string'
    case 'geometry':
      break
    case 'point':
      break
    case 'linestring':
      break
    case 'polygon':
      break
    case 'multipoint':
      break
    case 'multilinestring':
      break
    case 'multipolygon':
      break
    case 'json':
      return 'string'
  }

  return 'string'
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
