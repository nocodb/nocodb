<template>
  <div
    class="nc-cell"
    @keydown.stop.left
    @keydown.stop.right
    @keydown.stop.up
    @keydown.stop.down
    @keydown.stop.enter.exact="$emit('save'),$emit('navigateToNext')"
    @keydown.stop.shift.enter.exact="$emit('save'),$emit('navigateToPrev')"
  >
    <editable-attachment-cell
      v-if="isAttachment"
      v-model="localState"
      :active="active"
      :db-alias="dbAlias"
      :meta="meta"
      :is-form="isForm"
      :column="column"
      :is-public-grid="isPublic && !isForm"
      :is-public-form="isPublic && isForm"
      :view-id="viewId"
      :is-locked="isLocked"
      v-on="$listeners"
    />

    <boolean-cell
      v-else-if="isBoolean"
      v-model="localState"
      :is-form="isForm"
      v-on="parentListeners"
    />

    <integer-cell
      v-else-if="isInt"
      v-model="localState"
      v-on="parentListeners"
    />

    <float-cell
      v-else-if="isFloat"
      v-model="localState"
      v-on="parentListeners"
    />

    <date-picker-cell
      v-else-if="isDate"
      v-model="localState"
      v-on="parentListeners"
    />

    <time-picker-cell
      v-else-if="isTime"
      v-model="localState"
      v-on="parentListeners"
    />

    <date-time-picker-cell
      v-else-if="isDateTime"
      v-model="localState"
      ignore-focus
      v-on="parentListeners"
    />

    <enum-cell
      v-else-if="isEnum && (( !isForm && !active) || isLocked || (isPublic && !isForm))"
      v-model="localState"
      :column="column"
      v-on="parentListeners"
    />
    <enum-list-cell
      v-else-if="isEnum"
      v-model="localState"
      :is-form="isForm"
      :column="column"
      v-on="parentListeners"
    />

    <json-editable-cell
      v-else-if="isJSON"
      v-model="localState"
      :is-form="isForm"
      v-on="parentListeners"
      @input="$emit('save')"
    />

    <set-list-editable-cell
      v-else-if="isSet && (active || isForm) && !isLocked && !(isPublic && !isForm)"
      v-model="localState"
      :column="column"
      v-on="parentListeners"
    />
    <set-list-cell
      v-else-if="isSet"
      v-model="localState"
      :column="column"
      v-on="parentListeners"
    />

    <editable-url-cell v-else-if="isURL" v-model="localState" v-on="parentListeners" />

    <text-cell v-else-if="isString" v-model="localState" v-on="parentListeners" />

    <text-area-cell
      v-else-if="isTextArea"
      v-model="localState"
      :is-form="isForm"
      v-on="parentListeners"
    />

    <text-cell v-else v-model="localState" v-on="$listeners" />
    <span v-if="hint" class="nc-hint">{{ hint }}</span>

    <div v-if="(isLocked || (isPublic && !isForm)) && !isAttachment" class="nc-locked-overlay" />
  </div>
</template>

<script>
import debounce from 'debounce'
import DatePickerCell from '@/components/project/spreadsheet/components/editableCell/datePickerCell'
import EditableUrlCell from '@/components/project/spreadsheet/components/editableCell/editableUrlCell'
import JsonEditableCell from '@/components/project/spreadsheet/components/editableCell/jsonEditableCell'
import TextCell from '@/components/project/spreadsheet/components/editableCell/textCell'
import DateTimePickerCell from '@/components/project/spreadsheet/components/editableCell/dateTimePickerCell'
import TextAreaCell from '@/components/project/spreadsheet/components/editableCell/textAreaCell'
import EnumListCell from '@/components/project/spreadsheet/components/editableCell/enumListEditableCell'
import IntegerCell from '@/components/project/spreadsheet/components/editableCell/integerCell'
import FloatCell from '@/components/project/spreadsheet/components/editableCell/floatCell'
import TimePickerCell from '@/components/project/spreadsheet/components/editableCell/timePickerCell'
import BooleanCell from '@/components/project/spreadsheet/components/editableCell/booleanCell'
import cell from '@/components/project/spreadsheet/mixins/cell'
import EditableAttachmentCell from '@/components/project/spreadsheet/components/editableCell/editableAttachmentCell'
import EnumCell from '@/components/project/spreadsheet/components/cell/enumCell'
import SetListEditableCell from '@/components/project/spreadsheet/components/editableCell/setListEditableCell'
import SetListCell from '@/components/project/spreadsheet/components/cell/setListCell'

export default {
  name: 'EditableCell',
  components: {
    JsonEditableCell,
    EditableUrlCell,
    SetListCell,
    SetListEditableCell,
    EnumCell,
    EditableAttachmentCell,
    BooleanCell,
    TimePickerCell,
    FloatCell,
    IntegerCell,
    EnumListCell,
    TextAreaCell,
    DateTimePickerCell,
    TextCell,
    DatePickerCell
  },
  mixins: [cell],
  props: {
    dbAlias: String,
    value: [String, Number, Object, Boolean, Array, Object],
    meta: Object,
    ignoreFocus: Boolean,
    isForm: Boolean,
    active: Boolean,
    dummy: Boolean,
    hint: String,
    isLocked: Boolean,
    isPublic: Boolean,
    viewId: String
  },
  data: () => ({
    changed: false,
    destroyed: false,
    syncDataDebounce: debounce(async function(self) {
      await self.syncData()
    }, 1000)
  }),
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        if (val !== this.value) {
          this.changed = true
          this.$emit('input', val)
          if (this.isAttachment || this.isEnum || this.isBoolean || this.isSet || this.isTime || this.isDateTime || this.isDate) {
            this.syncData()
          } else {
            if (!this.isCurrency) {
              this.syncDataDebounce(this)
            }
          }
        }
      }
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      if (this.$listeners.cancel) {
        $listeners.cancel = this.$listeners.cancel
      }


      return $listeners
    }

  },

  mounted() {
    // this.$refs.input.focus();
  },
  beforeDestroy() {
    if (this.changed && !(this.isAttachment || this.isEnum || this.isBoolean || this.isSet || this.isTime || this.isDateTime)) {
      this.changed = false
      this.$emit('change')
    }
    this.destroyed = true
  },
  methods: {
    syncData() {
      if (this.changed && !this.destroyed) {
        this.changed = false
        this.$emit('update')
      }
    }
  }
}
</script>

<style scoped>
div {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
}

.nc-hint {
  font-size: .61rem;
  color: grey;
}

.nc-cell {
  position: relative;
}

.nc-locked-overlay {
  position: absolute;
  z-index: 2;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
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
