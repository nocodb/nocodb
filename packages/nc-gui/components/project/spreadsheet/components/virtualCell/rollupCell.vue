<template>
  <span>
    {{ row[column._cn] }}
  </span>
</template>

<script>

export default {
  name: 'RollupCell',
  components: {},
  props: {
    meta: [Object],
    column: [Object],
    nodes: [Object],
    row: [Object]
  }

}
</script>

<style scoped lang="scss">
.chips-wrapper {
  .chips {
    max-width: 100%;

    &.lookup-items {
      flex-wrap: wrap;
      row-gap: 3px;
      gap: 3px;
      margin: 3px 0;
    }
  }

  &.active {
    .chips {
      max-width: calc(100% - 44px);
    }
  }
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
