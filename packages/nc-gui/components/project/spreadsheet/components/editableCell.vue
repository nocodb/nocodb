<template>
  <div
    @keydown.stop.left
    @keydown.stop.right
    @keydown.stop.up
    @keydown.stop.down
    @keydown.stop.enter="$emit('save')">
    <editable-attachment-cell
      :active="active"
      v-on="$listeners"
      :db-alias="dbAlias"
      v-if="isAttachment"
      v-model="localState"></editable-attachment-cell>


    <text-cell v-else-if="isString" v-on="parentListeners" v-model="localState"></text-cell>

    <text-area-cell
      :is-form="isForm"
      v-else-if="isTextArea" @input="$emit('save')" v-model="localState"
      v-on="parentListeners"
    ></text-area-cell>

    <boolean-cell :isForm="isForm" v-else-if="isBoolean" v-on="parentListeners"
                  v-model="localState" @input="$emit('change');"></boolean-cell>

    <integer-cell v-else-if="isInt" v-on="parentListeners"
                  v-model="localState"></integer-cell>

    <float-cell v-else-if="isFloat" v-on="parentListeners"
                v-model="localState"></float-cell>

    <date-picker-cell v-else-if="isDate" v-on="parentListeners"
                      @input="$emit('change')"
                      v-model="localState"></date-picker-cell>

    <time-picker-cell v-else-if="isTime" v-on="parentListeners"
                      @update="$emit('change')"
                      v-model="localState"></time-picker-cell>

    <date-time-picker-cell ignoreFocus="ignoreFocus" v-on="parentListeners"
                           @input="$emit('change')"
                           v-else-if="isDateTime" v-model="localState"></date-time-picker-cell>

    <enum-cell v-else-if="isEnum && !isForm && !active" :column="column" v-on="parentListeners"
               v-model="localState"></enum-cell>
    <enum-list-cell v-else-if="isEnum" :is-form="isForm" :column="column" v-on="parentListeners"
                    v-model="localState"></enum-list-cell>
    <!--    <enum-radio-editable-cell v-else-if="isEnum" :column="column" v-on="parentListeners"
                                  v-model="localState"></enum-radio-editable-cell>-->

    <json-cell v-else-if="isJSON" v-model="localState"
               v-on="parentListeners"
               @input="$emit('save')"
    ></json-cell>

    <set-list-editable-cell :column="column" v-else-if="isSet && (active || isForm)" v-model="localState"
                            v-on="parentListeners"></set-list-editable-cell>
    <set-list-cell :column="column" v-else-if="isSet" v-model="localState"
                   v-on="parentListeners"></set-list-cell>
    <!--<set-list-checkbox-cell :column="column" v-else-if="isSet" v-model="localState"
                            v-on="parentListeners"></set-list-checkbox-cell>-->

    <text-cell v-else v-model="localState" v-on="$listeners"></text-cell>
  </div>
</template>

<script>
import DatePickerCell from "@/components/project/spreadsheet/editableCell/datePickerCell";
import TextCell from "@/components/project/spreadsheet/editableCell/textCell";
import DateTimePickerCell from "@/components/project/spreadsheet/editableCell/dateTimePickerCell";
import TextAreaCell from "@/components/project/spreadsheet/editableCell/textAreaCell";
import EnumListCell from "@/components/project/spreadsheet/editableCell/enumListEditableCell";
import JsonCell from "@/components/project/spreadsheet/editableCell/jsonCell";
import IntegerCell from "@/components/project/spreadsheet/editableCell/integerCell";
import FloatCell from "@/components/project/spreadsheet/editableCell/floatCell";
import TimePickerCell from "@/components/project/spreadsheet/editableCell/timePickerCell";
import BooleanCell from "@/components/project/spreadsheet/editableCell/booleanCell";
import SetListCheckboxCell from "@/components/project/spreadsheet/editableCell/setListCheckboxCell";
import cell from "@/components/project/spreadsheet/mixins/cell";
import EnumRadioEditableCell from "@/components/project/spreadsheet/editableCell/enumRadioEditableCell";
import EditableAttachmentCell from "@/components/project/spreadsheet/editableCell/editableAttachmentCell";
import EnumCell from "@/components/project/spreadsheet/cell/enumCell";
import SetListEditableCell from "@/components/project/spreadsheet/editableCell/setListEditableCell";
import SetListCell from "@/components/project/spreadsheet/cell/setListCell";

export default {
  name: "editable-cell",
  mixins: [cell],
  components: {
    SetListCell,
    SetListEditableCell,
    EnumCell,
    EditableAttachmentCell,
    EnumRadioEditableCell,
    SetListCheckboxCell,
    BooleanCell,
    TimePickerCell,
    FloatCell,
    IntegerCell, JsonCell, EnumListCell, TextAreaCell, DateTimePickerCell, TextCell, DatePickerCell
  },
  props: {
    dbAlias: String,
    value: [String, Number, Object, Boolean],
    meta: Object,
    ignoreFocus: Boolean,
    isForm: Boolean,
    active: Boolean,
  },
  data: () => ({
    changed: false,
  }),
  mounted() {
    // this.$refs.input.focus();
  },
  beforeDestroy() {
    if (this.changed && !(this.isAttachment || this.isEnum || this.isBoolean || this.isSet || this.isTime)) {
      this.$emit('change');
    }
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.changed = true;
        this.$emit('input', val);
      }
    },
    parentListeners() {
      const $listeners = {};

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur;
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus;
      }

      if (this.$listeners.cancel) {
        $listeners.cancel = this.$listeners.cancel;
      }

      if (this.$listeners.update) {
        $listeners.update = this.$listeners.update;
      }

      return $listeners;
    },

  }
}
</script>

<style scoped>
div {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
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
