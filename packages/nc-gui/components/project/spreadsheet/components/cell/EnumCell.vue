<template>
  <div>
    <span
      v-for="v in [(value || '').replace(/\\'/g, '\'').replace(/^'|'$/g, '')]"
      :key="v"
      :style="{
        background: colors[v],
      }"
      class="set-item ma-1 py-1 px-3"
      >{{ v }}</span
    >
  </div>
</template>

<script>
import { enumColor as colors } from '@/components/project/spreadsheet/helpers/colors';

export default {
  name: 'EnumCell',
  props: ['value', 'column'],
  computed: {
    colors() {
      const col = this.$store.state.settings.darkTheme ? colors.dark : colors.light;
      if (this.column && this.column.dtxp) {
        return this.column.dtxp
          .split(',')
          .map(v => v.replace(/\\'/g, "'").replace(/^'|'$/g, ''))
          .reduce(
            (obj, v, i) => ({
              ...obj,
              [v]: col[i % col.length],
            }),
            {}
          );
      }
      return {};
    },
  },
};
</script>

<style scoped>
.set-item {
  display: inline-block;
  border-radius: 25px;
  white-space: nowrap;
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
