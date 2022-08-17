<template>
  <editable-attachment-cell
    v-if="isAttachment"
    :is-locked="isLocked"
    :db-alias="dbAlias"
    :value="value"
    :column="column"
    @click.stop="$emit('enableedit')"
  />
  <set-list-cell v-else-if="isSet" :value="value" :column="column" @click.stop="$emit('enableedit')" />
  <!--  <enum-list-editable-cell @click.stop="$emit('enableedit')" v-else-if="isEnum && selected" :value="value" :column="column"></enum-list-editable-cell>-->
  <enum-cell v-else-if="isEnum" :value="value" :column="column" @click.stop="$emit('enableedit')" />
  <url-cell v-else-if="isURL" :value="value" />
  <email-cell v-else-if="isEmail" :value="value" />
  <json-cell v-else-if="isJSON" :value="value" />
  <date-cell v-else-if="isDate" :value="value" />
  <date-time-cell v-else-if="isDateTime" :value="value" />
  <time-cell v-else-if="isTime" :value="value" />
  <boolean-cell v-else-if="isBoolean" :value="value" read-only />
  <duration-cell v-else-if="isDuration" :column="column" :value="value" read-only />
  <rating-cell v-else-if="isRating" :value="value" read-only />
  <currency-cell v-else-if="isCurrency" :value="value" :column="column" />

  <span v-else :class="{'long-text-cell' : isTextArea, 'max-100px' : true}" :title="title">{{ value }}</span>
</template>

<script>
import DateCell from './cell/DateCell';
import DateTimeCell from './cell/DateTimeCell';
import TimeCell from './cell/TimeCell';
import JsonCell from '~/components/project/spreadsheet/components/cell/JsonCell';
import UrlCell from '~/components/project/spreadsheet/components/cell/UrlCell';
import cell from '@/components/project/spreadsheet/mixins/cell';
import SetListCell from '~/components/project/spreadsheet/components/cell/SetListCell';
import EnumCell from '~/components/project/spreadsheet/components/cell/EnumCell';
import EditableAttachmentCell from '~/components/project/spreadsheet/components/editableCell/EditableAttachmentCell';
import BooleanCell from '~/components/project/spreadsheet/components/cell/BooleanCell';
import EmailCell from '~/components/project/spreadsheet/components/cell/EmailCell';
import RatingCell from '~/components/project/spreadsheet/components/editableCell/RatingCell';
import CurrencyCell from '@/components/project/spreadsheet/components/cell/CurrencyCell';
import DurationCell from '@/components/project/spreadsheet/components/cell/DurationCell';

export default {
  name: 'TableCell',
  components: {
    RatingCell,
    EmailCell,
    TimeCell,
    DateTimeCell,
    DateCell,
    JsonCell,
    UrlCell,
    EditableAttachmentCell,
    EnumCell,
    SetListCell,
    BooleanCell,
    CurrencyCell,
    DurationCell,
  },
  mixins: [cell],
  props: ['value', 'dbAlias', 'isLocked', 'selected', 'column'],
  computed: {
    title() {
      if (typeof this.value === 'string') {
        return this.value;
      }
      return '';
    },
  },
};
</script>

<style scoped>
.max-100px {
  display: block;
  max-height: 100px !important;
  overflow: auto;
}

.long-text-cell {
  white-space: break-spaces;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
-->
