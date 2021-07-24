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
      <span
        v-if="localValue && localValue.length === 10"
        class="caption pointer ml-1 grey--text"
        @click="showLookupListModal"
      >more...
      </span>
    </div>
    <list-child-items-modal
      v-if="lookUpMeta && lookupListModal"
      ref="childList"
      v-model="lookupListModal"
      :is-form="isForm"
      :is-new="isNew"
      :size="10"
      :meta="lookUpMeta"
      :parent-meta="meta"
      :primary-col="lookUpColumnAlias"
      :api="lookupApi"
      :read-only="true"
      :query-params="queryParams"
    />
  </div>
</template>

<script>
import ApiFactory from '@/components/project/spreadsheet/apis/apiFactory'
import ItemChip from '@/components/project/spreadsheet/components/virtualCell/components/itemChip'
import ListChildItemsModal
  from '@/components/project/spreadsheet/components/virtualCell/components/listChildItemsModal'

export default {
  name: 'LookupCell',
  components: { ListChildItemsModal, ItemChip },
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
  data: () => ({
    lookupListModal: false
  }),
  computed: {
    // todo : optimize
    lookupApi() {
      // return this.$ncApis({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   table: this.column.tn
      // })

      return this.lookUpMeta && this.lookUpMeta._tn
        ? ApiFactory.create(
          this.$store.getters['project/GtrProjectType'],
          this.lookUpMeta._tn,
          this.lookUpMeta.columns,
          this,
          this.lookUpMeta
        )
        : null
    },
    lookUpMeta() {
      return this.$store.state.meta.metas[this.column.tn]
    },
    assocMeta() {
      return this.column.type === 'mm' && this.$store.state.meta.metas[this.column.relation.vtn]
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
    },
    queryParams() {
      switch (this.column.type) {
        case 'bt':
          return { where: `(${this.lookUpMeta.columns.find(c => c.cn === this.column.relation.rcn)._cn},eq,${this.row[this.meta.columns.find(c => c.cn === this.column.relation.cn)._cn]})` }
        case 'hm':
          return { where: `(${this.lookUpMeta.columns.find(c => c.cn === this.column.relation.cn)._cn},eq,${this.row[this.meta.columns.find(c => c.cn === this.column.relation.rcn)._cn]})` }
        case 'mm':
          return this.assocMeta
            ? {
                conditionGraph: {
                  [this.assocMeta.tn]: {
                    relationType: 'hm',
                    [this.assocMeta.columns.find(c => c.cn === this.column.relation.vcn).cn]: {
                      eq: this.row[this.meta.columns.find(c => c.cn === this.column.relation.cn)._cn]
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
          tn: this.column.tn
        })
      }
      if (this.column.type === 'mm' && !this.assocMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.column.relation.vtn
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
