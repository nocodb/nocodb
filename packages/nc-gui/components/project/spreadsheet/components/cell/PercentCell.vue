<template>
  <span>{{ localValue }}</span>
</template>

<script>
import { renderPercent } from '~/helpers/percentHelper';

export default {
  name: 'PercentCell',
  props: {
    column: Object,
    value: [String, Number],
  },
  data: () => ({
    localValue: null,
  }),
  computed: {},
  watch: {
    'column.meta.precision'(newValue, oldValue) {
      if (oldValue !== newValue) {
        this.localValue = renderPercent(this.value, newValue);
      }
    },
    value(val, oldVal) {
      this.localValue = renderPercent(val, this.column?.meta?.precision || 0);
    },
  },
  created() {
    this.localValue = renderPercent(this.value, this.column?.meta?.precision || 0);
  },
  methods: {},
};
</script>

<style scoped></style>

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
