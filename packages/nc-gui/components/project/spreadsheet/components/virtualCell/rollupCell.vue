<template>
  <span>
    {{ row[column._cn] }}
  </span>
</template>

<script>

export default {
  name: 'RollupCell',
  components: { },
  props: {
    meta: [Object],
    column: [Object],
    nodes: [Object],
    row: [Object]
  },
  data: () => ({
    lookupListModal: false
  }),
  computed: {
    // todo : optimize
    lookupApi() {
      return this.column && this.$ncApis.get({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        table: this.column.lk.ltn
      })
    },
    lookUpMeta() {
      return this.$store.state.meta.metas[this.column.lk.ltn]
    },
    assocMeta() {
      return this.column.lk.type === 'mm' && this.$store.state.meta.metas[this.column.lk.vtn]
    },
    lookUpColumnAlias() {
      if (!this.lookUpMeta || !this.column.lk.lcn) {
        return
      }
      return (this.$store.state.meta.metas[this.column.lk.ltn].columns.find(cl => cl.cn === this.column.lk.lcn) || {})._cn
    },
    lookUpColumn() {
      if (!this.lookUpMeta || !this.column.lk.lcn) {
        return
      }
      return (this.$store.state.meta.metas[this.column.lk.ltn].columns.find(cl => cl.cn === this.column.lk.lcn) || {})
    },
    localValueObj() {
      if (!this.column || !this.row) {
        return null
      }
      switch (this.column.lk.type) {
        case 'mm':
          return this.row[`${this.column.lk._ltn}MMList`]
        case 'hm':
          return this.row[`${this.column.lk._ltn}List`]
        case 'bt':
          return this.row[`${this.column.lk._ltn}Read`]
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
    },
    queryParams() {
      switch (this.column.lk.type) {
        case 'bt':
          return { where: `(${this.lookUpMeta.columns.find(c => c.cn === this.column.lk.rcn)._cn},eq,${this.row[this.meta.columns.find(c => c.cn === this.column.lk.cn)._cn]})` }
        case 'hm':
          return { where: `(${this.lookUpMeta.columns.find(c => c.cn === this.column.lk.cn)._cn},eq,${this.row[this.meta.columns.find(c => c.cn === this.column.lk.rcn)._cn]})` }
        case 'mm':
          return this.assocMeta
            ? {
                conditionGraph: {
                  [this.assocMeta.tn]: {
                    relationType: 'hm',
                    [this.assocMeta.columns.find(c => c.cn === this.column.lk.vcn).cn]: {
                      eq: this.row[this.meta.columns.find(c => c.cn === this.column.lk.cn)._cn]
                    }
                  }
                }
              }
            : {}
        default:
          return {}
      }
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
          tn: this.column.lk.ltn
        })
      }
      if (this.column.lk.type === 'mm' && !this.assocMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.column.lk.vtn
        })
      }
    },
    showLookupListModal() {
      this.lookupListModal = true
    }
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
