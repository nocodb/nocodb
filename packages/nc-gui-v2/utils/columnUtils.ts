import { UITypes } from 'nocodb-sdk'
import LinkVariant from '~icons/mdi/link-variant'
import TableColumnPlusBefore from '~icons/mdi/table-column-plus-before'
import FormatColorText from '~icons/mdi/format-color-text'
import TextSubject from '~icons/mdi/text-subject'
import Attachment from '~icons/mdi/attachment'
import CheckboxMarkedOutline from '~icons/mdi/checkbox-marked-outline'
import FormatListBulletedSquare from '~icons/mdi/format-list-bulleted-square'
import ArrowDownDropCircle from '~icons/mdi/arrow-down-drop-circle'
import CalendarMonth from '~icons/mdi/calendar-month'
import Calendar from '~icons/mdi/calendar'
import Clock from '~icons/mdi/clock'
import FilePhone from '~icons/mdi/file-phone'
import Email from '~icons/mdi/email'
import Web from '~icons/mdi/web'
import Numeric from '~icons/mdi/numeric'
import Decimal from '~icons/mdi/decimal'
import CurrencyUsdCircleOutline from '~icons/mdi/currency-usd-circle-outline'
import PercentOutline from '~icons/mdi/percent-outline'
import TimerOutline from '~icons/mdi/timer-outline'
import Star from '~icons/mdi/star'
import MathIntegral from '~icons/mdi/math-integral'
import MovieRoll from '~icons/mdi/movie-roll'
import Counter from '~icons/mdi/counter'
import CalendarClock from '~icons/mdi/calendar-clock'

const uiTypes = [
  {
    name: UITypes.LinkToAnotherRecord,
    icon: LinkVariant,
    virtual: 1,
  },
  {
    name: UITypes.Lookup,
    icon: TableColumnPlusBefore,
    virtual: 1,
  },
  {
    name: UITypes.SingleLineText,
    icon: FormatColorText,
  },
  {
    name: UITypes.LongText,
    icon: TextSubject,
  },
  {
    name: UITypes.Attachment,
    icon: Attachment,
  },
  {
    name: UITypes.Checkbox,
    icon: CheckboxMarkedOutline,
  },
  {
    name: UITypes.MultiSelect,
    icon: FormatListBulletedSquare,
  },
  {
    name: UITypes.SingleSelect,
    icon: ArrowDownDropCircle,
  },
  {
    name: UITypes.Date,
    icon: CalendarMonth,
  },
  {
    name: UITypes.Year,
    icon: Calendar,
  },
  {
    name: UITypes.Time,
    icon: Clock,
  },
  {
    name: UITypes.PhoneNumber,
    icon: FilePhone,
  },
  {
    name: UITypes.Email,
    icon: Email,
  },
  {
    name: UITypes.URL,
    icon: Web,
  },
  {
    name: UITypes.Number,
    icon: Numeric,
  },
  {
    name: UITypes.Decimal,
    icon: Decimal,
  },
  {
    name: UITypes.Currency,
    icon: CurrencyUsdCircleOutline,
  },
  {
    name: UITypes.Percent,
    icon: PercentOutline,
  },
  {
    name: UITypes.Duration,
    icon: TimerOutline,
  },
  {
    name: UITypes.Rating,
    icon: Star,
  },
  {
    name: UITypes.Formula,
    icon: MathIntegral,
    virtual: 1,
  },
  {
    name: UITypes.Rollup,
    icon: MovieRoll,
    virtual: 1,
  },
  {
    name: UITypes.Count,
    icon: Counter,
  },
  {
    name: UITypes.DateTime,
    icon: CalendarClock,
  },
  {
    name: UITypes.AutoNumber,
    icon: Numeric,
  },
  {
    name: UITypes.Geometry,
    icon: 'mdi-ruler-square-compass',
  },
  {
    name: UITypes.JSON,
    icon: 'mdi-code-json',
  },
  {
    name: UITypes.SpecificDBType,
    icon: 'mdi-database-settings',
  },
]

const getUIDTIcon = (uidt: UITypes) => {
  return (
    [
      ...uiTypes,
      {
        name: UITypes.CreateTime,
        icon: 'mdi-calendar-clock',
      },
      {
        name: UITypes.ID,
        icon: 'mdi-identifier',
      },
      {
        name: UITypes.ForeignKey,
        icon: 'mdi-link-variant',
      },
    ].find((t) => t.name === uidt) || {}
  ).icon
}

export { uiTypes, getUIDTIcon }

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
