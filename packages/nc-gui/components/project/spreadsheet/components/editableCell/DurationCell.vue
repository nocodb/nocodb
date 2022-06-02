<template>
  <div class="duration-cell-wrapper">
    <input
      style="background: black; color: white"
      ref="durationUnparsedInput"
      v-model="localState"
      :placeholder="selectedDurationTitle"
      @blur="onBlur"
      @keypress="checkDurationFormat($event)"
      @keydown.enter="$emit('input', msValue)"
      v-on="parentListeners"
    >
    <div v-if="showWarningMessage == true" class="duration-warning">
      <!-- TODO: i18n -->
      Please enter a number
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { durationOptions } from '~/helpers/durationHelper'

export default {
  name: 'DurationCell',
  props: {
    column: Object,
    value: Number,
    readOnly: Boolean
  },
  data: () => ({
    showWarningMessage: false,
    msValue: null
  }),
  computed: {
    localState: {
      get() {
        return this.parseDuration(this.value)
      },
      set(val) {
        // 10:00 (10 mins) -> 600000ms
        const duration = moment.duration(val)
        if (moment.isDuration(duration)) {
          const d = duration._data
          console.log(d)
          const ms = d.hours * 3600000 + d.minutes * 60000 + d.seconds * 1000 + d.milliseconds
          if (ms >= 0) {
            console.log('VALID = ' + ms)
            this.msValue = ms
          } else {
            console.log('NOT VALID')
          }
        } else {
          console.log("NOT DURATION")
          console.log(duration)
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
    },
    selectedDurationTitle() {
      return durationOptions[this.column?.meta?.duration || 0].title
    }
  },
  methods: {
    // TODO: put it to helper
    parseDuration(val) {
      if (!val) return null
      console.log("parseDuration= " + val)
      // 600000ms --> 10:00 (10 mins)
      const d = moment.duration(val, 'milliseconds')._data
      const durationType = this.column?.meta?.duration || 0
      if (durationType === 0) {
        // h:mm
        return `${d.hours}:${d.minutes}`
      } else if (durationType === 1) {
        // h:mm:ss
        return `${d.hours}:${d.minutes}:${d.seconds}`
      } else if (durationType === 2) {
        // h:mm:ss.s
        return `${d.hours}:${d.minutes}:${d.seconds}.${~~(d.milliseconds / 100)}`
      } else if (durationType === 3) {
        // h:mm:ss.ss
        return `${d.hours}:${d.minutes}:${d.seconds}.${~~(d.milliseconds / 10)}`
      } else if (durationType === 4) {
        // h:mm:ss.sss
        return `${d.hours}:${d.minutes}:${d.seconds}.${d.milliseconds}`
      }
      return val
    },
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
    onBlur(){
      this.$emit('input', this.msValue)
    },
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
