<template>
  <div>
    <v-chip
      v-if="enumValues.find(el => el.title === value)"
      :color="enumValues.find(el => el.title === value) ? enumValues.find(el => el.title === value).color : ''"
      small
      class="set-item ma-1 py-1 px-3"
    >
      {{ enumValues.find(el => el.title === value).title }}
    </v-chip>
  </div>
</template>

<script>
export default {
  name: 'EnumCell',
  props: ['value', 'column'],
  computed: {
    enumValues() {
      const opts = (this.column.colOptions)
        ? this.column.colOptions.options.filter(el => el.title !== '') || []
        : [];
      for (const op of opts.filter(el => el.order === null)) {
        op.title = op.title.replace(/^'/, '').replace(/'$/, '');
      }
      return opts;
    }
  },
};
</script>

<style scoped>
/*
.set-item {
  display: inline-block;
  border-radius: 25px;
  white-space: nowrap;
}
*/
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
