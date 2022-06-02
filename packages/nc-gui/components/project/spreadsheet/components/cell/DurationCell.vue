<template>
  <input style="background-color: red; color: white;" v-model="localState" :disabled="true"/>
</template>

<script>
import moment from 'moment'

export default {
  name: 'DurationCell',
  props: ['value'],
  data: () => ({
    showWarningMessage: false,
    localValue: null
  }),
  created() {
    this.localValue = this.value  
  },
  computed: {
    localState: {
      get() {
        return this.parseDuration(this.localValue)
      }
    }
  },
  watch: { 
    value (val, oldVal) {
      if (val != oldVal && (!val && val !== 0)) {
          this.localValue = oldVal
      } else {
          this.localValue = val
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
  }
}
</script>

<style scoped>

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
