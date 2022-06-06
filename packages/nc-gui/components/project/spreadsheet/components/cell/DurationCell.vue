<template>
  <input
    v-model="localValue"
    :placeholder="durationPlaceholder"
    readonly
  >
</template>

<script>
import { durationOptions, convertMS2Duration } from '~/helpers/durationHelper'

export default {
  name: 'DurationCell',
  props: {
    column: Object,
    value: [String, Number]
  },
  data: () => ({
    showWarningMessage: false,
    localValue: null
  }),
  computed: {
    durationPlaceholder() {
      return durationOptions[this.column?.meta?.duration || 0].title
    }
  },
  watch: {
    'column.meta.duration'(newValue, oldValue) {
      if (oldValue !== newValue) {
        this.localValue = convertMS2Duration(this.value, newValue)
      }
    },
    value(val, oldVal) {
      this.localValue = convertMS2Duration(val !== oldVal && (!val && val !== 0) ? oldVal : val, this.column?.meta?.duration || 0)
    }
  },
  created() {
    this.localValue = convertMS2Duration(this.value, this.column?.meta?.duration || 0)
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
