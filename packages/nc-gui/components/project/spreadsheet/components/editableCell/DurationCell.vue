<template>
  <div class="duration-cell-wrapper">
    <input
      ref="durationInput"
      v-model="localState"
      :placeholder="durationPlaceholder"
      @blur="onBlur"
      @keypress="checkDurationFormat($event)"
      @keydown.enter="$emit('input', durationInMS)"
    >
    <div v-if="showWarningMessage == true" class="duration-warning">
      <!-- TODO: i18n -->
      Please enter a number
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { durationOptions, parseDuration } from '~/helpers/durationHelper'

export default {
  name: 'DurationCell',
  props: {
    column: Object,
    value: Number,
    readOnly: Boolean
  },
  data: () => ({
    showWarningMessage: false,
    durationInMS: null
  }),
  computed: {
    localState: {
      get() {
        return parseDuration(this.value, this.column?.meta?.duration || 0)
      },
      set(val) {
        // 10:00 (10 mins) -> 600000ms
        const duration = moment.duration(val)
        if (moment.isDuration(duration)) {
          const d = duration._data
          const ms = d.hours * 3600000 + d.minutes * 60000 + d.seconds * 1000 + d.milliseconds
          if (ms >= 0) {
            this.durationInMS = ms
          }
        }
      }
    },
    durationPlaceholder() {
      return durationOptions[this.column?.meta?.duration || 0].title
    }
  },
  mounted() {
    window.addEventListener('keypress', (_) => {
      this.$refs.durationInput.focus()
    })
  },
  methods: {
    checkDurationFormat(evt) {
      evt = evt || window.event
      const charCode = (evt.which) ? evt.which : evt.keyCode
      // ref: http://www.columbia.edu/kermit/ascii.html
      const PRINTABLE_CTL_RANGE = charCode > 31
      const NON_DIGIT = charCode < 48 || charCode > 57
      const NON_COLON = charCode !== 58
      const NON_PERIOD = charCode !== 46
      if (PRINTABLE_CTL_RANGE && NON_DIGIT && NON_COLON && NON_PERIOD) {
        this.showWarningMessage = true
        evt.preventDefault()
      } else {
        this.showWarningMessage = false
        // only allow digits, '.' and ':' (without quotes)
        return true
      }
    },
    onBlur() {
      if (this.durationInMS) {
        this.$emit('input', this.durationInMS)
      }
    }
  }
}
</script>

<style scoped>

.duration-cell-wrapper {
    padding: 10px;
}

.duration-warning {
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
