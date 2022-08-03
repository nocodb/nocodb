<script lang="ts" setup>
import { useVModel } from '@vueuse/core'
import { useLTARStoreOrThrow } from '~/composables'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const {
  childrenExcludedList,
  loadChildrenExcludedList,
  childrenExcludedListPagination,
  relatedTablePrimaryValueProp,
  link
} =
  useLTARStoreOrThrow()

await loadChildrenExcludedList()
/* import Pagination from '~/components/project/spreadsheet/components/Pagination'
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
} */
</script>

<template>
  <a-modal v-model:visible="vModel" :footer="null" title="Related table rows">
    <div class="max-h-[max(calc(100vh_-_300px)_,500px)] flex flex-col">
      <div class="flex-1 overflow-auto min-h-0">
        <a-card v-for="row in childrenExcludedList.list" class="my-1 cursor-pointer" @click="link(row)">
          {{ row[relatedTablePrimaryValueProp] }}
        </a-card>
      </div>
      <a-pagination class="mt-2 mx-auto"
                    size="small"
                    v-model:current="childrenExcludedListPagination.page"
                    v-model:page-size="childrenExcludedListPagination.size"
                    :total="childrenExcludedList.pageInfo.totalRows"
                    show-less-items />
    </div>
  </a-modal>

  <!--  <v-dialog v-model="show" width="600" content-class="dialog">
    <v-icon small class="close-icon" @click="$emit('input', false)"> mdi-close </v-icon>
    <v-card width="600">
      <v-card-title class="textColor&#45;&#45;text mx-2 justify-center">
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
              <v-card-text class="primary-value textColor&#45;&#45;text text&#45;&#45;lighten-2 d-flex">
                <span class="font-weight-bold"> {{ ch[primaryCol] || (ch && Object.values(ch).slice(0, 1).join()) }}&nbsp;</span>
                <span v-if="primaryKey" class="grey&#45;&#45;text caption primary-key">(Primary Key : {{ ch[primaryKey] }})</span>
                <v-spacer />
                <v-chip v-if="hm && ch[`${hm._rtn}Read`] && ch[`${hm._rtn}Read`][hmParentPrimaryValCol]" x-small>
                  {{ ch[`${hm._rtn}Read`][hmParentPrimaryValCol] }}
                </v-chip>
              </v-card-text>
            </v-card>
          </template>

          <div v-else-if="data" class="text-center py-15 textLight&#45;&#45;text">
            &lt;!&ndash; No items found &ndash;&gt;
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
  </v-dialog> -->
</template>

<style scoped lang="scss">
/*.child-list-modal {
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
}*/

:deep(.ant-pagination-item a) {
  line-height: 21px !important;
}
</style>
