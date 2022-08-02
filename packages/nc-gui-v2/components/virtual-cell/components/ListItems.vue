<script>
import Pagination from '~/components/project/spreadsheet/components/Pagination'
import { NOCO } from '~/lib/constants'

export default {
  name: 'ListItems',
  components: { Pagination },
  props: {
    value: Boolean,
    tn: String,
    hm: [Object, Function, Boolean],
    title: {
      type: String,
      default: 'Link Record',
    },
    queryParams: {
      type: Object,
      default() {
        return {}
      },
    },
    primaryKey: String,
    primaryCol: String,
    meta: Object,
    size: Number,
    api: [Object, Function],
    mm: [Object, Function],
    parentId: [String, Number],
    parentMeta: [Object],
    isPublic: Boolean,
    password: String,
    column: Object,
    rowId: [Number, String],
  },
  emits: ['input', 'add', 'addNewRecord'],
  data: () => ({
    data: null,
    page: 1,
    query: '',
  }),
  computed: {
    show: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      },
    },
    hmParentPrimaryValCol() {
      return this.hm && this.parentMeta && this.parentMeta.columns.find((v) => v.pv).title
    },
  },
  mounted() {
    this.loadData()
  },
  methods: {
    async loadData() {
      if (this.isPublic) {
        this.data = await this.$api.public.dataRelationList(
          this.$route.params.id,
          this.column.id,
          {},
          {
            headers: {
              'xc-password': this.password,
            },
            query: {
              limit: this.size,
              offset: this.size * (this.page - 1),
              ...this.queryParams,
            },
          },
        )
      } else {
        const where = `(${this.primaryCol},like,%${this.query}%)`

        if (this.column && this.column.colOptions && this.rowId) {
          this.data = await this.$api.dbTableRow.nestedChildrenExcludedList(
            NOCO,
            this.projectName,
            this.parentMeta.title,
            this.rowId,
            this.column.colOptions.type,
            this.column.title,
            {
              limit: this.size,
              offset: this.size * (this.page - 1),
              where: this.query && `(${this.primaryCol},like,${this.query})`,
            },
          )
        } else {
          this.data = await this.$api.dbTableRow.list(NOCO, this.projectName, this.meta.title, {
            limit: this.size,
            offset: this.size * (this.page - 1),
            ...this.queryParams,
            where,
          })
        }
      }
    },
  },
}
</script>

<template>
  <v-dialog v-model="show" width="600" content-class="dialog">
    <v-icon small class="close-icon" @click="$emit('input', false)"> mdi-close </v-icon>
    <v-card width="600">
      <v-card-title class="textColor--text mx-2 justify-center">
        {{ title }}
      </v-card-title>

      <v-card-title>
        <v-text-field
          v-model="query"
          hide-details
          dense
          outlined
          placeholder="Filter query"
          class="caption search-field ml-2"
          @keydown.enter="loadData"
        >
          <template #append>
            <x-icon tooltip="Apply filter" small icon class="mt-1" @click="loadData"> mdi-keyboard-return </x-icon>
          </template>
        </v-text-field>
        <v-spacer />

        <v-icon small class="mr-1" @click="loadData()"> mdi-reload </v-icon>
        <v-btn v-if="!isPublic" small class="caption mr-2" color="primary" @click="$emit('addNewRecord')">
          <v-icon small> mdi-plus </v-icon>&nbsp; New Record
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="items-container">
          <template v-if="data && data.list && data.list.length">
            <v-card v-for="(ch, i) in data.list" :key="i" v-ripple class="ma-2 child-card" outlined @click="$emit('add', ch)">
              <v-card-text class="primary-value textColor--text text--lighten-2 d-flex">
                <span class="font-weight-bold"> {{ ch[primaryCol] || (ch && Object.values(ch).slice(0, 1).join()) }}&nbsp;</span>
                <span v-if="primaryKey" class="grey--text caption primary-key">(Primary Key : {{ ch[primaryKey] }})</span>
                <v-spacer />
                <v-chip v-if="hm && ch[`${hm._rtn}Read`] && ch[`${hm._rtn}Read`][hmParentPrimaryValCol]" x-small>
                  {{ ch[`${hm._rtn}Read`][hmParentPrimaryValCol] }}
                </v-chip>
              </v-card-text>
            </v-card>
          </template>

          <div v-else-if="data" class="text-center py-15 textLight--text">
            <!-- No items found -->
            {{ $t('placeholder.noItemsFound') }}
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="justify-center py-2 flex-column">
        <Pagination
          v-if="data && data.list && data.list.length"
          v-model="page"
          :size="size"
          :count="data && data.pageInfo && data.pageInfo.totalRows"
          class="mb-3"
          @input="loadData"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
.child-list-modal {
  position: relative;

  .remove-child-icon {
    position: absolute;
    right: 10px;
    top: 10px;
    bottom: 10px;
    opacity: 0;
  }

  &:hover .remove-child-icon {
    opacity: 1;
  }
}

.child-card {
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 0.2em var(--v-textColor-lighten5);
  }
}

.primary-value {
  .primary-key {
    display: none;
    margin-left: 0.5em;
  }

  &:hover .primary-key {
    display: inline;
  }
}

.items-container {
  overflow-x: visible;
  max-height: min(500px, 60vh);
  overflow-y: auto;
}

::v-deep {
  .dialog {
    position: relative;

    .close-icon {
      width: auto;
      position: absolute;
      right: 10px;
      top: 10px;
      z-index: 9;
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
