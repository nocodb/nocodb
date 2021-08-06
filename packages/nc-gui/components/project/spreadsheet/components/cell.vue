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
  <json-cell v-else-if="isJSON" :value="value" />
  <span v-else :class="{'long-text-cell' : isTextArea}">{{ value }}</span>
</template>

<script>
import JsonCell from '@/components/project/spreadsheet/components/cell/jsonCell'
import UrlCell from '@/components/project/spreadsheet/components/cell/urlCell'
import cell from '@/components/project/spreadsheet/mixins/cell'
import SetListCell from '@/components/project/spreadsheet/components/cell/setListCell'
import EnumCell from '@/components/project/spreadsheet/components/cell/enumCell'
import EditableAttachmentCell from '@/components/project/spreadsheet/components/editableCell/editableAttachmentCell'

export default {
  name: 'TableCell',
  components: { JsonCell, UrlCell, EditableAttachmentCell, EnumCell, SetListCell },
  mixins: [cell],
  props: ['value', 'dbAlias', 'isLocked', 'selected'],
  computed: {}
}
</script>

<style scoped>
.long-text-cell{
  white-space: pre;
}
</style>
<!--
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
-->
