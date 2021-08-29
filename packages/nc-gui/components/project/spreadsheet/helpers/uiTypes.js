const uiTypes = [
  {
    name: 'ID',
    icon: 'mdi-identifier'
  },
  {
    name: 'LinkToAnotherRecord',
    icon: 'mdi-link-variant'
  },
  {
    name: 'ForeignKey',
    icon: 'mdi-link-variant'
  },
  {
    name: 'Lookup',
    icon: 'mdi-table-column-plus-before'
  },
  {
    name: 'SingleLineText',
    icon: 'mdi-format-color-text'
  },
  {
    name: 'LongText',
    icon: 'mdi-text-subject'
  },
  {
    name: 'Attachment',
    icon: 'mdi-attachment'
  },
  {
    name: 'Checkbox',
    icon: 'mdi-checkbox-marked-outline'
  },
  {
    name: 'MultiSelect',
    icon: 'mdi-format-list-bulleted-square'
  },
  {
    name: 'SingleSelect',
    icon: 'mdi-arrow-down-drop-circle'
  },
  // {
  //   name: 'Collaborator',
  //   icon: 'mdi-account',
  // },
  {
    name: 'Date',
    icon: 'mdi-calendar-month'
  },
  {
    name: 'Year',
    icon: 'mdi-calendar'
  },
  {
    name: 'Time',
    icon: 'mdi-clock'
  },
  {
    name: 'PhoneNumber',
    icon: 'mdi-file-phone'
  },
  {
    name: 'Email',
    icon: 'mdi-email'
  },
  {
    name: 'URL',
    icon: 'mdi-web'
  },
  {
    name: 'Number',
    icon: 'mdi-numeric'
  },
  {
    name: 'Decimal',
    icon: 'mdi-decimal'
  },
  {
    name: 'Currency',
    icon: 'mdi-currency-usd-circle-outline'
  },
  {
    name: 'Percent',
    icon: 'mdi-percent-outline'
  },
  {
    name: 'Duration',
    icon: 'mdi-timer-outline'
  },
  {
    name: 'Rating',
    icon: 'mdi-star'
  },
  {
    name: 'Formula',
    icon: 'mdi-math-integral'
  },
  {
    name: 'Rollup',
    icon: 'mdi-movie-roll'
  },
  {
    name: 'Count',
    icon: 'mdi-counter'
  },
  // {
  //   name: 'Lookup',
  //   icon: 'mdi-account-search',
  // },
  {
    name: 'DateTime',
    icon: 'mdi-calendar-clock'
  },
  {
    name: 'CreateTime',
    icon: 'mdi-calendar-clock'
  },
  // {
  //   name: 'LastModifiedTime',
  //   icon: 'mdi-calendar-clock',
  // },
  {
    name: 'AutoNumber',
    icon: 'mdi-numeric'
  },
  {
    name: 'Geometry',
    icon: 'mdi-ruler-square-compass'
  },
  {
    name: 'JSON',
    icon: 'mdi-code-json'
  },
  {
    name: 'SpecificDBType',
    icon: 'mdi-database-settings'
  }
  // {
  //   name: 'Barcode',
  //   icon: 'mdi-barcode',
  // },
  // {
  //   name: 'Button',
  //   icon: 'mdi-gesture-tap-button',
  // },
]

const getUIDTIcon = (uidt) => {
  return (uiTypes.find(t => t.name === uidt) || {}).icon
}

export {
  uiTypes, getUIDTIcon
}
export default [
  'ID',
  'ForeignKey',
  'SingleLineText',
  'LongText',
  'Attachment',
  'Checkbox',
  'MultiSelect',
  'SingleSelect',
  'Collaborator',
  'Date',
  'Year',
  'Time',
  'PhoneNumber',
  'Email',
  'URL',
  'Number',
  'Decimal',
  'Currency',
  'Percent',
  'Duration',
  'Rating',
  'Formula',
  'Rollup',
  'Count',
  'Lookup',
  'DateTime',
  'CreateTime',
  'LastModifiedTime',
  'AutoNumber',
  'Barcode',
  'Button',
  'SpecificDBType'
]

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
