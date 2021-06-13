<template>
  <editable-attachment-cell
    :isLocked="isLocked"
    :db-alias="dbAlias"
    @click.stop="$emit('enableedit')" v-if="isAttachment" :value="value" :column="column"></editable-attachment-cell>
  <set-list-cell @click.stop="$emit('enableedit')" v-else-if="isSet" :value="value" :column="column"></set-list-cell>
<!--  <enum-list-editable-cell @click.stop="$emit('enableedit')" v-else-if="isEnum && selected" :value="value" :column="column"></enum-list-editable-cell>-->
  <enum-cell @click.stop="$emit('enableedit')" v-else-if="isEnum" :value="value" :column="column"></enum-cell>
  <span v-else>{{ value }}</span>
</template>

<script>
import cell from "@/components/project/spreadsheet/mixins/cell";
import SetListCell from "@/components/project/spreadsheet/components/cell/setListCell";
import EnumCell from "@/components/project/spreadsheet/components/cell/enumCell";
import AttachmentCell from "@/components/project/spreadsheet/components/cell/attachmentCell";
import EditableAttachmentCell from "@/components/project/spreadsheet/components/editableCell/editableAttachmentCell";
import EnumListEditableCell from "@/components/project/spreadsheet/components/editableCell/enumListEditableCell";

export default {
  name: "tableCell",
  components: {EnumListEditableCell, EditableAttachmentCell, AttachmentCell, EnumCell, SetListCell},
  props: ['value','dbAlias','isLocked','selected'],
  mixins: [cell],
  computed: {}
}
</script>

<style scoped>
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
