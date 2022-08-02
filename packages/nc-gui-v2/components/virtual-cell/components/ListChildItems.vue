<script>
import { RelationTypes } from 'nocodb-sdk'
import { NOCO } from '~/lib/constants'
import Pagination from '~/components/project/spreadsheet/components/Pagination'

export default {
  name: 'ListChildItems',
  components: { Pagination },
  props: {
    readOnly: Boolean,
    isForm: Boolean,
    bt: [Object],
    localState: [Array],
    isNew: Boolean,
    value: Boolean,
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
    parentMeta: Object,
    size: Number,
    api: [Object, Function],
    mm: [Object, Boolean],
    isPublic: Boolean,
    rowId: [String, Number],
    column: Object,
    type: String,
    password: String,
  },
  emits: ['input', 'edit', 'delete', 'unlink', 'newRecord'],
  data: () => ({
    RelationTypes,
    data: null,
    page: 1,
  }),
  computed: {
    isDataAvail() {
      return (this.data && this.data.list && this.data.list.length) || (this.localState && this.localState.length)
    },
    show: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      },
    },
  },
  watch: {
    queryParams() {
      this.loadData()
    },
  },
  mounted() {
    this.loadData()
  },
  methods: {
    async loadData() {
      if (!this.isForm && this.isPublic && this.$route.params.id) {
        if (this.column && this.column.colOptions && this.rowId) {
          this.data = await this.$api.public.dataNestedList(
            this.$route.params.id,
            this.rowId,
            this.column.colOptions.type,
            this.column.fk_column_id || this.column.id,
            {
              limit: this.size,
              offset: this.size * (this.page - 1),
            },
            {},
          )
        }

        return
      }

      if (this.isNew) {
        return
      }
      if (this.column && this.column.colOptions) {
        this.data = await this.$api.dbTableRow.nestedList(
          NOCO,
          this.projectName,
          this.parentMeta.title,
          this.rowId,
          this.column.colOptions.type,
          this.column.title,
          {
            limit: this.size,
            offset: this.size * (this.page - 1),
          },
        )
      } else {
        this.data = await this.$api.dbTableRow.list(NOCO, this.projectName, this.meta.title, {
          limit: this.size,
          offset: this.size * (this.page - 1),
          ...this.queryParams,
        })
      }
    },
  },
}
</script>

<template>
  <v-card width="600" color="">
    <v-card-title v-if="!isForm" class="textColor--text mx-2" :class="{ 'py-2': isForm }">
      <span v-if="!isForm">{{ meta ? meta.title : 'Children' }}</span>
      <v-spacer />
      <v-icon small class="mr-1" @click="loadData()"> mdi-reload </v-icon>
      <v-btn
        v-if="(isForm || !isPublic) && !readOnly && (isPublic || _isUIAllowed('xcDatatableEditable'))"
        small
        class="caption"
        color="primary"
        @click="$emit('newRecord')"
      >
        <v-icon small> mdi-link </v-icon>&nbsp; Link to '{{ meta.title }}'
      </v-btn>
    </v-card-title>
    <v-card-text>
      <div class="items-container pt-2 mb-n4" :class="{ 'mx-n2': isForm }">
        <div v-if="!readOnly && (isPublic || _isUIAllowed('xcDatatableEditable'))" class="text-right mb-2 mt-n2 mx-2">
          <v-btn v-if="isForm" x-small class="caption" color="primary" outlined @click="$emit('newRecord')">
            <v-icon x-small> mdi-link </v-icon>&nbsp; Link to '{{ meta.title }}'
          </v-btn>
        </div>
        <template v-if="isDataAvail">
          <v-card
            v-for="(ch, i) in (data && data.list) || localState"
            :key="i"
            class="mx-2 mb-2 child-list-modal child-card"
            outlined
            @click="!readOnly && $emit('edit', ch)"
          >
            <div class="remove-child-icon d-flex align-center">
              <x-icon
                v-if="((isPublic && isForm) || (!isPublic && _isUIAllowed('xcDatatableEditable'))) && !readOnly"
                :tooltip="`Unlink this '${meta.title}' from '${parentMeta.title}'`"
                :color="['error', 'grey']"
                small
                class="mr-1 mt-n1"
                @click.stop="$emit('unlink', ch, i)"
              >
                mdi-link-variant-remove
              </x-icon>
              <x-icon
                v-if="!isPublic && type === RelationTypes.HAS_MANY && !readOnly && _isUIAllowed('xcDatatableEditable')"
                :tooltip="`Delete row in '${meta.title}'`"
                :color="['error', 'grey']"
                small
                @click.stop="$emit('delete', ch, i)"
              >
                mdi-delete-outline
              </x-icon>
            </div>

            <v-card-title class="primary-value textColor--text text--lighten-2">
              {{ ch[primaryCol] }}
              <span v-if="primaryKey" class="grey--text caption primary-key ml-1"> (Primary Key : {{ ch[primaryKey] }})</span>
            </v-card-title>
          </v-card>
        </template>

        <div
          v-else-if="data || localState"
          class="text-center textLight--text"
          :class="{ 'pt-6 pb-4': !isForm, 'pt-4 pb-3': isForm }"
        >
          No item{{ bt ? '' : 's' }} found
        </div>

        <div v-if="isForm" class="mb-2 d-flex align-center justify-center">
          <Pagination
            v-if="!bt && data && data.pageInfo && data.pageInfo.totalRows > 1"
            v-model="page"
            :size="size"
            :count="data && data.pageInfo && data.pageInfo.totalRows"
            @input="loadData"
          />
        </div>
      </div>
    </v-card-text>
    <v-card-actions v-if="!isForm" class="justify-center flex-column" :class="{ 'py-0': isForm }">
      <Pagination
        v-if="!bt && data && data.pageInfo && data.pageInfo.totalRows > 1"
        v-model="page"
        :size="size"
        :count="data && data.pageInfo && data.pageInfo.totalRows"
        class="mb-3"
        @input="loadData"
      />
    </v-card-actions>
  </v-card>
  <!--  </v-dialog> -->
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

.items-container {
  overflow-x: visible;
  max-height: min(500px, 60vh);
  overflow-y: auto;
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
