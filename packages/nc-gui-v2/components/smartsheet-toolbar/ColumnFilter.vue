<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import FieldListAutoCompleteDropdown from './FieldListAutoCompleteDropdown.vue'
import { useNuxtApp } from '#app'
import { inject } from '#imports'
import { comparisonOp } from '~/utils/filterUtils'
import { ActiveViewInj, MetaInj, ReloadViewDataHookInj } from '~/components'
import useViewFilters from '~/composables/useViewFilters'
import MdiDeleteIcon from '~icons/mdi/close-box'

const { nested = false, parentId } = defineProps<{ nested?: boolean; parentId?: string }>()

const meta = inject(MetaInj)
const activeView = inject(ActiveViewInj)
const reloadDataHook = inject(ReloadViewDataHookInj)

const { $e } = useNuxtApp()

const { filters, deleteFilter, saveOrUpdate, loadFilters, addFilter } = useViewFilters(activeView, parentId, () => {
  reloadDataHook?.trigger()
})

const filterUpdateCondition = (filter, i) => {
  saveOrUpdate(filter, i)
  $e('a:filter:update', {
    logical: filter.logical_op,
    comparison: filter.comparison_op,
  })
}

// todo
// const filterComparisonOp = (f) =>
//   comparisonOp.filter((op) => {
//     // if (
//     //   f &&
//     //   f.fk_column_id &&
//     //   this.columnsById[f.fk_column_id] &&
//     //   this.columnsById[f.fk_column_id].uidt === UITypes.LinkToAnotherRecord &&
//     //   this.columnsById[f.fk_column_id].uidt === UITypes.Lookup
//     // ) {
//     //   return !['notempty', 'empty', 'notnull', 'null'].includes(op.value)
//     // }
//     return true
//   })

const columns = computed(() => meta?.value?.columns)
const types = computed(() => {
  if (!meta?.value?.columns?.length) {
    return {}
  }
  return meta?.value?.columns?.reduce((obj: any, col: any) => {
    switch (col.uidt) {
      case UITypes.Number:
      case UITypes.Decimal:
        obj[col.title] = obj[col.column_name] = 'number'
        break
      case UITypes.Checkbox:
        obj[col.title] = obj[col.column_name] = 'boolean'
        break
    }
    return obj
  }, {})
})

watch(
  () => activeView?.value?.id,
  (n, o) => {
    if (n !== o) loadFilters()
  },
  { immediate: true },
)

/* import { UITypes, getUIDTIcon } from '~/components/project/spreadsheet/helpers/uiTypes'
import FieldListAutoCompleteDropdown from '~/components/project/spreadsheet/components/FieldListAutoCompleteDropdown'

export default {
  name: 'ColumnFilter',
  components: {
    FieldListAutoCompleteDropdown,
  },
  props: {
    fieldList: [Array],
    meta: Object,
    nested: Boolean,
    parentId: String,
    viewId: String,
    shared: Boolean,
    webHook: Boolean,
    hookId: String,
  },
  data: () => ({
    filters: [],
    opList: [
      'is equal',
      'is not equal',
      'is like',
      'is not like',
      // 'is empty', 'is not empty',
      'is null',
      'is not null',
      '>',
      '<',
      '>=',
      '<=',
    ],
    comparisonOp: [
      {
        text: 'is equal',
        value: 'eq',
      },
      {
        text: 'is not equal',
        value: 'neq',
      },
      {
        text: 'is like',
        value: 'like',
      },
      {
        text: 'is not like',
        value: 'nlike',
      },
      {
        text: 'is empty',
        value: 'empty',
        ignoreVal: true,
      },
      {
        text: 'is not empty',
        value: 'notempty',
        ignoreVal: true,
      },
      {
        text: 'is null',
        value: 'null',
        ignoreVal: true,
      },
      {
        text: 'is not null',
        value: 'notnull',
        ignoreVal: true,
      },
      {
        text: '>',
        value: 'gt',
      },
      {
        text: '<',
        value: 'lt',
      },
      {
        text: '>=',
        value: 'gte',
      },
      {
        text: '<=',
        value: 'lte',
      },
    ],
  }),
  computed: {
    columnIcon() {
      return this.meta.columns.reduce((iconsObj, c) => {
        return { ...iconsObj, [c.title]: getUIDTIcon(c.uidt) }
      }, {})
    },
    columnsById() {
      return (this.columns || []).reduce((o, c) => ({ ...o, [c.id]: c }), {})
    },
    autoApply() {
      return this.$store.state.settings.autoApplyFilter && !this.webHook
    },
    columns() {
      return (
        this.meta &&
        this.meta.columns
          .filter((c) => c && (!c.colOptions || !c.system))
          .map((c) => ({
            ...c,
            icon: getUIDTIcon(c.uidt),
          }))
      )
    },
    types() {
      if (!this.meta || !this.meta.columns || !this.meta.columns.length) {
        return {}
      }

      return this.meta.columns.reduce((obj, col) => {
        switch (col.uidt) {
          case UITypes.Number:
          case UITypes.Decimal:
            obj[col.title] = obj[col.column_name] = 'number'
            break
          case UITypes.Checkbox:
            obj[col.title] = obj[col.column_name] = 'boolean'
            break
          default:
            break
        }
        return obj
      }, {})
    },
  },
  watch: {
    async viewId(v) {
      if (v) {
        await this.loadFilter()
      }
    },
    filters: {
      handler(v) {
        this.$emit('input', v && v.filter((f) => (f.fk_column_id && f.comparison_op) || f.is_group))
      },
      deep: true,
    },
  },
  created() {
    this.loadFilter()
  },
  methods: {
    filterComparisonOp(f) {
      return this.comparisonOp.filter((op) => {
        if (
          f &&
          f.fk_column_id &&
          this.columnsById[f.fk_column_id] &&
          this.columnsById[f.fk_column_id].uidt === UITypes.LinkToAnotherRecord &&
          this.columnsById[f.fk_column_id].uidt === UITypes.Lookup
        ) {
          return !['notempty', 'empty', 'notnull', 'null'].includes(op.value)
        }
        return true
      })
    },
    async applyChanges(nested = false, { hookId } = {}) {
      for (const [i, filter] of Object.entries(this.filters)) {
        if (filter.status === 'delete') {
          if (this.hookId || hookId) {
            await this.$api.dbTableFilter.delete(filter.id)
          } else {
            await this.$api.dbTableFilter.delete(filter.id)
          }
        } else if (filter.status === 'update') {
          if (filter.id) {
            if (this.hookId || hookId) {
              await this.$api.dbTableFilter.update(filter.id, {
                ...filter,
                fk_parent_id: this.parentId,
              })
            } else {
              await this.$api.dbTableFilter.update(filter.id, {
                ...filter,
                fk_parent_id: this.parentId,
              })
            }
          } else if (this.hookId || hookId) {
            this.$set(
              this.filters,
              i,
              await this.$api.dbTableWebhookFilter.create(this.hookId || hookId, {
                ...filter,
                fk_parent_id: this.parentId,
              }),
            )
          } else {
            this.$set(
              this.filters,
              i,
              await this.$api.dbTableFilter.create(this.viewId, {
                ...filter,
                fk_parent_id: this.parentId,
              }),
            )
          }
        }
      }
      if (this.$refs.nestedFilter) {
        for (const nestedFilter of this.$refs.nestedFilter) {
          await nestedFilter.applyChanges(true)
        }
      }
      this.loadFilter()
      if (!nested) {
        this.$emit('updated')
      }
    },
    async loadFilter() {
      let filters = []
      if (this.viewId && this._isUIAllowed('filterSync')) {
        filters = this.parentId
          ? await this.$api.dbTableFilter.childrenRead(this.parentId)
          : await this.$api.dbTableFilter.read(this.viewId)
      }
      if (this.hookId && this._isUIAllowed('filterSync')) {
        filters = this.parentId
          ? await this.$api.dbTableFilter.childrenRead(this.parentId)
          : await this.$api.dbTableWebhookFilter.read(this.hookId)
      }

      this.filters = filters
    },
    addFilter() {
      this.filters.push({
        fk_column_id: null,
        comparison_op: 'eq',
        value: '',
        status: 'update',
        logical_op: 'and',
      })
      this.filters = this.filters.slice()
      this.$e('a:filter:add', { length: this.filters.length })
    },
    addFilterGroup() {
      this.filters.push({
        parentId: this.parentId,
        is_group: true,
        status: 'update',
      })
      this.filters = this.filters.slice()
      const index = this.filters.length - 1
      this.saveOrUpdate(this.filters[index], index)
    },
    filterUpdateCondition(filter, i) {
      this.saveOrUpdate(filter, i)
      this.$e('a:filter:update', {
        logical: filter.logical_op,
        comparison: filter.comparison_op,
      })
    },
    async saveOrUpdate(filter, i) {
      if (this.shared || !this._isUIAllowed('filterSync')) {
        // this.$emit('input', this.filters.filter(f => f.fk_column_id && f.comparison_op))
        this.$emit('updated')
      } else if (!this.autoApply) {
        filter.status = 'update'
      } else if (filter.id) {
        await this.$api.dbTableFilter.update(filter.id, {
          ...filter,
          fk_parent_id: this.parentId,
        })

        this.$emit('updated')
      } else {
        this.$set(
          this.filters,
          i,
          await this.$api.dbTableFilter.create(this.viewId, {
            ...filter,
            fk_parent_id: this.parentId,
          }),
        )

        this.$emit('updated')
      }
    },
    async deleteFilter(filter, i) {
      if (this.shared || !this._isUIAllowed('filterSync')) {
        this.filters.splice(i, 1)
        this.$emit('updated')
      } else if (filter.id) {
        if (!this.autoApply) {
          this.$set(filter, 'status', 'delete')
        } else {
          await this.$api.dbTableFilter.delete(filter.id)
          await this.loadFilter()
          this.$emit('updated')
        }
      } else {
        this.filters.splice(i, 1)
        this.$emit('updated')
      }
      this.$e('a:filter:delete')
    },
  },
} */
</script>

<template>
  <div class="backgroundColor pa-2 menu-filter-dropdown bg-background" :style="{ width: nested ? '100%' : '630px' }">
    <div v-if="filters && filters.length" class="grid" @click.stop>
      <template v-for="(filter, i) in filters" :key="filter.id || i">
        <template v-if="filter.status !== 'delete'">
          <div v-if="filter.is_group" :key="i" style="grid-column: span 4; padding: 6px" class="elevation-4">
            <div class="d-flex" style="gap: 6px; padding: 0 6px">
              <v-icon
                v-if="!filter.readOnly"
                :key="`${i}_3`"
                small
                class="nc-filter-item-remove-btn"
                @click.stop="deleteFilter(filter, i)"
              >
                mdi-close-box
              </v-icon>
              <span v-else :key="`${i}_1`" />
              <v-select
                v-model="filter.logical_op"
                class="flex-shrink-1 flex-grow-0 elevation-0 caption"
                :items="['and', 'or']"
                density="compact"
                variant="solo"
                hide-details
                placeholder="Group op"
                @click.stop
                @change="saveOrUpdate(filter, i)"
              >
                <!--                <template #item="{ item }"> -->
                <!--                  <span class="caption font-weight-regular">{{ item }}</span> -->
                <!--                </template> -->
              </v-select>
            </div>
            <!--            <column-filter
              v-if="filter.id || shared"
              ref="nestedFilter"
              v-model="filter.children"
              :parent-id="filter.id"
              :view-id="viewId"
              nested
              :meta="meta"
              :shared="shared"
              :web-hook="webHook"
              :hook-id="hookId"
              @updated="$emit('updated')"
              @input="$emit('input', filters)"
            /> -->
          </div>
          <template v-else>
            <!--                        <v-icon
                                      v-if="!filter.readOnly"
                                      :key="`${i}_3`"
                                      small
                                      class="nc-filter-item-remove-btn"
                                      @click.stop="deleteFilter(filter, i)"
                                    >
                                      mdi-close-box
                                    </v-icon> -->

            <MdiDeleteIcon
              v-if="!filter.readOnly"
              class="nc-filter-item-remove-btn text-grey align-self-center"
              @click.stop="deleteFilter(filter, i)"
            ></MdiDeleteIcon>
            <span v-else />

            <span v-if="!i" :key="`${i}_2`" class="text-xs d-flex align-center">{{ $t('labels.where') }}</span>

            <v-select
              v-else
              :key="`${i}_4`"
              v-model="filter.logical_op"
              class="w-full elevation-0 caption"
              :items="['and', 'or']"
              density="compact"
              variant="solo"
              hide-details
              :disabled="filter.readOnly"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            />
            <!--              <template #item="{ item }">
                <span class="caption font-weight-regular">{{ item }}</span>
              </template>
            </v-select> -->

            <FieldListAutoCompleteDropdown
              :key="`${i}_6`"
              v-model="filter.fk_column_id"
              class="caption text-sm nc-filter-field-select"
              :columns="columns"
              :disabled="filter.readOnly"
              @click.stop
              @change="saveOrUpdate(filter, i)"
            />

            <v-select
              v-model="filter.comparison_op"
              class="caption nc-filter-operation-select text-sm"
              :items="comparisonOp.map((it) => it.value)"
              :placeholder="$t('labels.operation')"
              density="compact"
              variant="solo"
              :disabled="filter.readOnly"
              hide-details
              @change="filterUpdateCondition(filter, i)"
            /><!--
            todo: filter based on column type

            item-value="value"
            item-text="text"
            :items="filterComparisonOp(filter)" -->

            <!--              <template #item="{ item }"> -->
            <!--                <span class="caption font-weight-regular">{{ item.text }}</span> -->
            <!--              </template> -->
            <!--            </v-select> -->
            <span v-if="['null', 'notnull', 'empty', 'notempty'].includes(filter.comparison_op)" :key="`span${i}`" />
            <v-checkbox
              v-else-if="types[filter.field] === 'boolean'"
              :key="`${i}_7`"
              v-model="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />
            <v-text-field
              v-else
              :key="`${i}_7`"
              v-model="filter.value"
              density="compact"
              variant="solo"
              hide-details
              class="caption text-sm nc-filter-value-select"
              :disabled="filter.readOnly"
              @click.stop
              @input="saveOrUpdate(filter, i)"
            />
          </template>
        </template>
      </template>
    </div>

    <v-btn small class="elevation-0 text-sm text-capitalize text-grey my-3" @click.stop="addFilter">
      <!--      <v-icon small color="grey"> mdi-plus </v-icon> -->
      <!-- Add Filter -->
      {{ $t('activity.addFilter') }}
    </v-btn>
    <slot />
  </div>

  <!--  <div class="backgroundColor pa-2 menu-filter-dropdown" :style="{ width: nested ? '100%' : '530px' }">
    <div class="grid" @click.stop>
      <template v-for="(filter, i) in filters" dense>
        <template v-if="filter.status !== 'delete'">
          <div v-if="filter.is_group" :key="i" style="grid-column: span 4; padding: 6px" class="elevation-4">
            <div class="d-flex" style="gap: 6px; padding: 0 6px">
              <v-icon
                v-if="!filter.readOnly"
                :key="`${i}_3`"
                small
                class="nc-filter-item-remove-btn"
                @click.stop="deleteFilter(filter, i)"
              >
                mdi-close-box
              </v-icon>
              <span v-else :key="`${i}_1`" />
              <v-select
                v-model="filter.logical_op"
                class="flex-shrink-1 flex-grow-0 elevation-0 caption"
                :items="['and', 'or']"
                solo
                flat
                dense
                hide-details
                placeholder="Group op"
                @click.stop
                @change="saveOrUpdate(filter, i)"
              >
                <template #item="{ item }">
                  <span class="caption font-weight-regular">{{ item }}</span>
                </template>
              </v-select>
            </div>
            <column-filter
              v-if="filter.id || shared"
              ref="nestedFilter"
              v-model="filter.children"
              :parent-id="filter.id"
              :view-id="viewId"
              nested
              :meta="meta"
              :shared="shared"
              :web-hook="webHook"
              :hook-id="hookId"
              @updated="$emit('updated')"
              @input="$emit('input', filters)"
            />
          </div>
          <template v-else>
            <v-icon
              v-if="!filter.readOnly"
              :key="`${i}_3`"
              small
              class="nc-filter-item-remove-btn"
              @click.stop="deleteFilter(filter, i)"
            >
              mdi-close-box
            </v-icon>
            <span v-else :key="`${i}_1`" />
            <span v-if="!i" :key="`${i}_2`" class="caption d-flex align-center">{{ $t('labels.where') }}</span>

            <v-select
              v-else
              :key="`${i}_4`"
              v-model="filter.logical_op"
              class="flex-shrink-1 flex-grow-0 elevation-0 caption"
              :items="['and', 'or']"
              solo
              flat
              dense
              hide-details
              :disabled="filter.readOnly"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            >
              <template #item="{ item }">
                <span class="caption font-weight-regular">{{ item }}</span>
              </template>
            </v-select>

            <FieldListAutoCompleteDropdown
              :key="`${i}_6`"
              v-model="filter.fk_column_id"
              class="caption nc-filter-field-select"
              :columns="columns"
              :disabled="filter.readOnly"
              @click.stop
              @change="saveOrUpdate(filter, i)"
            />

            <v-select
              :key="`k${i}`"
              v-model="filter.comparison_op"
              class="flex-shrink-1 flex-grow-0 caption nc-filter-operation-select"
              :items="filterComparisonOp(filter)"
              :placeholder="$t('labels.operation')"
              solo
              flat
              style="max-width: 120px"
              dense
              :disabled="filter.readOnly"
              hide-details
              item-value="value"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            >
              <template #item="{ item }">
                <span class="caption font-weight-regular">{{ item.text }}</span>
              </template>
            </v-select>
            <span v-if="['null', 'notnull', 'empty', 'notempty'].includes(filter.comparison_op)" :key="`span${i}`" />
            <v-checkbox
              v-else-if="types[filter.field] === 'boolean'"
              :key="`${i}_7`"
              v-model="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />
            <v-text-field
              v-else
              :key="`${i}_7`"
              v-model="filter.value"
              solo
              flat
              hide-details
              dense
              class="caption nc-filter-value-select"
              :disabled="filter.readOnly"
              @click.stop
              @input="saveOrUpdate(filter, i)"
            />
          </template>
        </template>
      </template>
    </div>

    <v-btn small class="elevation-0 grey&#45;&#45;text my-3" @click.stop="addFilter">
      <v-icon small color="grey"> mdi-plus </v-icon>
      &lt;!&ndash; Add Filter &ndash;&gt;
      {{ $t('activity.addFilter') }}
    </v-btn>
    <slot />
  </div> -->
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 30px 130px auto auto auto;
  column-gap: 6px;
  row-gap: 6px;
}
</style>
