<template>
  <div class="chips-wrapper">
    <div class="chips d-flex align-center  lookup-items">
      <template v-if="localValue">
        <item-chip
          v-for="(value,i) in localValue"
          :key="i"
          :active="active"
          :value="value"
          :readonly="true"
        />
      </template>
    </div>
  </div>
</template>

<script>
import ItemChip from '@/components/project/spreadsheet/components/virtualCell/components/itemChip'

export default {
  name: 'LookupCell',
  components: { ItemChip },
  props: {
    meta: [Object],
    column: [Object],
    nodes: [Object],
    row: [Object],
    api: [Object, Function],
    sqlUi: [Object, Function],
    active: Boolean,
    isNew: Boolean,
    isForm: Boolean
  },
  computed: {
    lookUpMeta() {
      return this.$store.state.meta.metas[this.column.tn]
    },
    lookUpColumnAlias() {
      if (!this.lookUpMeta || !this.column.cn) {
        return
      }
      return (this.$store.state.meta.metas[this.column.tn].columns.find(cl => cl.cn === this.column.cn) || {})._cn
    },
    localValueObj() {
      if (!this.column || !this.row) {
        return null
      }
      switch (this.column.type) {
        case 'mm':
          return this.row[`${this.column._tn}MMList`]
        case 'hm':
          return this.row[`${this.column._tn}List`]
        case 'bt':
          return this.row[`${this.column._tn}Read`]
        default:
          return null
      }
    },
    localValue() {
      if (!this.localValueObj || !this.lookUpColumnAlias) {
        return null
      }
      if (Array.isArray(this.localValueObj)) {
        return this.localValueObj.map(o => o[this.lookUpColumnAlias])
      }
      return [this.localValueObj[this.lookUpColumnAlias]]
    }
  },
  created() {
    this.loadLookupMeta()
  },
  methods: {
    async loadLookupMeta() {
      if (!this.lookUpMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.column.tn
        })
      }
    }
  }
}
</script>

<style scoped lang="scss">
.chips-wrapper {
  .chips {
    max-width: 100%;
    &.lookup-items{
      flex-wrap: wrap;
      row-gap: 3px;
      gap:3px;
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
