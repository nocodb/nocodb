<template>
  <div class="duration-cell-wrapper">
    <!--      v-model="localState"-->
      <!-- v-on="parentListeners" -->

      <!-- @keypress="checkDurationFormat($event)" -->

    <!-- show unparse value when focusing -->
    <input
      v-show="focused"
      ref="durationUnparsedInput"
      v-model="unparsedValue"
      :placeholder="selectedDurationTitle"
      @blur="onUserInputBlur"
    >
    <!-- show the parsed value when bluring -->
    <input
      v-show="!focused"
      ref="durationParsedInput"
      v-model="parsedValue"
      :placeholder="selectedDurationTitle"
      @focus="onFocus"
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
    focused: false,
    unparsedValue: null,
    parsedValue: null
  }),
  computed: {
    localState: {
      get() {
        console.log("Trigging GET " + this.unparsedValue)
        return this.unparsedValue
      },
      set(val) {
        console.log('Trigging SET ' + val)
        this.unparsedValue = val
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
  created() {
    this.parsedValue = this.parseDuration(this.value)
    this.unparsedValue = this.parsedValue
  },
   watch: {
    value (val, oldVal) {
        console.log("val " + val)
        console.log("oldVal " + oldVal)
      if (val != oldVal) {
        this.parsedValue = this.parseDuration(val)
        this.unparsedValue = this.parsedValue
      }
    }
  },
  methods: {
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
    onUserInputBlur(){
      console.log("onUserInputBlur")
      // 10:00 (10 mins) -> 600000ms
      const duration = moment.duration(this.unparsedValue)
      if (moment.isDuration(duration)) {
        const d = duration._data
        console.log(d)
        const ms = d.hours * 3600000 + d.minutes * 60000 + d.seconds * 1000 + d.milliseconds
        if (ms >= 0) {
          console.log('VALID = ' + ms)
          this.$emit('input', ms)
          this.unparsedValue = this.parseDuration(ms)
          this.parsedValue = this.parseDuration(ms)
        } else {
          console.log('NOT VALID')
        }
      } else {
        console.log("NOT DURATION")
        console.log(duration)
      }
      this.focused = false
    },
    onFocus() {
      console.log("onFocus")
      this.focused = true
      this.$nextTick(() => this.$refs.durationUnparsedInput.focus())
      this.$nextTick(() => this.$refs.durationParsedInput.blur())
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
