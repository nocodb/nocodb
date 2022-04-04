import { UITypes } from 'nocodb-sdk'
import { uiTypes } from '@/components/project/spreadsheet/helpers/uiTypes'

export default {
  props: {
    sqlUi: [Object, Function],
    column: Object
  },
  computed: {
    uiDatatype() {
      return this.column && this.column.uidt
    },
    uiDatatypeIcon() {
      const ui = this.uiDatatype && uiTypes.find(ui => ui.name === this.uiDatatype)
      return ui && ui.icon
    },
    abstractType() {
      return this.sqlUi && this.column && this.column.dt && this.sqlUi.getAbstractType(this.column)
    },
    dataTypeLow() {
      return this.column && this.column.dt && this.column.dt.toLowerCase()
    },
    isBoolean() {
      return this.abstractType === 'boolean'
    },
    isString() {
      return this.abstractType === 'string'
    },
    isTextArea() {
      return this.uiDatatype === UITypes.LongText
    },
    isInt() {
      return this.abstractType === 'integer'
    },
    isFloat() {
      return this.abstractType === 'float'
    },
    isDate() {
      return this.abstractType === 'date' || this.uiDatatype === 'Date'
    },
    isTime() {
      return this.abstractType === 'time' || this.uiDatatype === 'Time'
    },
    isDateTime() {
      return this.abstractType === 'datetime' || this.uiDatatype === 'DateTime'
    },
    isJSON() {
      return this.abstractType === 'json' || this.uiDatatype === 'JSON'
    },
    isEnum() {
      return this.uiDatatype === 'SingleSelect'
    },
    isSet() {
      return this.uiDatatype === 'MultiSelect'
    },
    isURL() {
      return this.uiDatatype === 'URL'
    },
    isAttachment() {
      return this.uiDatatype === 'Attachment'
    },
    isCurrency() {
      return this.column.uidt == 'Currency'
    }

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
