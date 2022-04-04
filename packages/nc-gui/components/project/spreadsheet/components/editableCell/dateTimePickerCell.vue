<template>
  <div>
    <v-datetime-picker
      ref="picker"
      v-model="localState"
      class="caption xc-date-time-picker"
      :text-field-props="{
        class:'caption mt-0 pt-0',
        flat:true,
        solo:true,
        dense:true,
        hideDetails:true
      }"
      :time-picker-props="{
        format:'24hr'
      }"
      v-on="parentListeners"
    />
  </div>
</template>

<script>

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export default {
  name: 'DateTimePickerCell',
  props: {
    value: [String, Date, Number], ignoreFocus: Boolean
  },
  computed: {
    localState: {
      get() {
        if (!this.value) {
          return this.value
        }

        return (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value))
          .format('YYYY-MM-DD HH:mm')
      },
      set(value) {
        if (this.$parent.sqlUi.name === 'MysqlUi') {
          this.$emit('input', value && dayjs(value).format('YYYY-MM-DD HH:mm:ss'))
        } else {
          this.$emit('input', value && dayjs(value).format('YYYY-MM-DD HH:mm:ssZ'))
        }
      }
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        // $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    }
  },
  mounted() {
    if (!this.ignoreFocus) {
      this.$refs.picker.display = true
    }
  }
}
</script>

<style scoped>
/deep/ .v-input, /deep/ .v-text-field {
  margin-top: 0 !important;
  padding-top: 0 !important;
  font-size: inherit !important;
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
