<template>
  <div class="percent-cell-wrapper">
    <input
      ref="percentInput"
      v-model="localState"
      @blur="onBlur"
      @keypress="checkPercentFormat($event)"
      @keydown.enter="isEdited && $emit('input', percent)"
      v-on="parentListeners"
    >
    <div v-if="showWarningMessage == true" class="percent-warning">
      <!-- TODO: i18n -->
      Please enter a number
    </div>
  </div>
</template>

<script>
import { isValidPercent, renderPercent } from '~/helpers/percentHelper'

export default {
  name: 'PercentCell',
  props: {
    column: Object,
    value: [Number, String],
    readOnly: Boolean
  },
  data: () => ({
    // flag to determine to show warning message or not
    showWarningMessage: false,
    // percent in decimal format
    percent: null,
    // check if the cell is edited or not
    isEdited: false
  }),
  computed: {
    localState: {
      get() {
        return renderPercent(this.value, this.percentType)
      },
      set(val) {
        this.isEdited = true
        if (val === null) { val = 0 }
        const p = val.replace(/%/g, '')
        if (isValidPercent(p)) {
          this.percent = p / 100
        }
      }
    },
    percentType() {
      return this.column?.meta?.percentOption || 0
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    }
  },
  mounted() {
    window.addEventListener('keypress', (_) => {
      if (this.$refs.percentInput) {
        this.$refs.percentInput.focus()
      }
    })
  },
  methods: {
    checkPercentFormat(evt) {
      evt = evt || window.event
      const charCode = (evt.which) ? evt.which : evt.keyCode
      // ref: http://www.columbia.edu/kermit/ascii.html
      const PRINTABLE_CTL_RANGE = charCode > 31
      const NON_DIGIT = charCode < 48 || charCode > 57
      const NON_PERIOD = charCode !== 46
      if (PRINTABLE_CTL_RANGE && NON_DIGIT && NON_PERIOD) {
        this.showWarningMessage = true
        evt.preventDefault()
      } else {
        this.showWarningMessage = false
        // only allow digits and '.'
        return true
      }
    },
    onBlur() {
      if (this.isEdited) {
        this.$emit('input', this.percent)
      }
      this.isEdited = false
    }
  }
}
</script>

<style scoped>

.percent-cell-wrapper {
  padding: 10px;
}

.percent-warning {
  text-align: left;
  margin-top: 10px;
  color: #E65100;
}
</style>

<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
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
