<template>
  <div
    class="backgroundColor pa-2"
    :style="{width:nested ? '100%' : '530px'}"
  >
    <div class="grid" @click.stop>
      <template v-for="(filter,i) in filters" dense>
        <template v-if="filter.status !== 'delete'">
          <div v-if="filter.is_group" :key="i" style="grid-column: span 4; padding:6px" class="elevation-4 ">
            <div class="d-flex" style="gap:6px; padding: 0 6px">
              <v-icon
                v-if="!filter.readOnly"
                :key="i + '_3'"
                small
                class="nc-filter-item-remove-btn"
                @click.stop="deleteFilter(filter,i)"
              >
                mdi-close-box
              </v-icon>
              <span v-else :key="i + '_1'" />
              <v-select
                v-model="filter.logical_op"
                class="flex-shrink-1 flex-grow-0 elevation-0 caption "
                :items="['and' ,'or']"
                solo
                flat
                dense
                hide-details
                placeholder="Group op"
                @click.stop
                @change="saveOrUpdate(filter, i)"
              >
                <template #item="{item}">
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
              :key="i + '_3'"
              small
              class="nc-filter-item-remove-btn"
              @click.stop="deleteFilter(filter,i)"
            >
              mdi-close-box
            </v-icon>
            <span v-else :key="i + '_1'" />
            <span
              v-if="!i"
              :key="i + '_2'"
              class="caption d-flex align-center"
            >{{ $t('labels.where') }}</span>

            <v-select
              v-else
              :key="i + '_4'"
              v-model="filter.logical_op"
              class="flex-shrink-1 flex-grow-0 elevation-0 caption "
              :items="['and' ,'or']"
              solo
              flat
              dense
              hide-details
              :disabled="filter.readOnly"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            >
              <template #item="{item}">
                <span class="caption font-weight-regular">{{ item }}</span>
              </template>
            </v-select>

            <v-select
              :key="i + '_6'"
              v-model="filter.fk_column_id"
              class="caption nc-filter-field-select"
              :items="columns"
              :placeholder="$t('objects.field')"
              solo
              flat
              dense
              :disabled="filter.readOnly"
              hide-details
              item-value="id"
              item-text="title"
              @click.stop
              @change="saveOrUpdate(filter, i)"
            >
              <template #item="{item}">
                <span
                  :class="`caption font-weight-regular nc-filter-fld-${item.title}`"
                >
                  {{ item.title }}
                </span>
              </template>
            </v-select>
            <v-select
              :key="'k' + i"
              v-model="filter.comparison_op"
              class="flex-shrink-1 flex-grow-0 caption  nc-filter-operation-select"
              :items="filterComparisonOp(filter)"
              :placeholder="$t('labels.operation')"
              solo
              flat
              style="max-width:120px"
              dense
              :disabled="filter.readOnly"
              hide-details
              item-value="value"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            >
              <template #item="{item}">
                <span class="caption font-weight-regular">{{ item.text }}</span>
              </template>
            </v-select>
            <span v-if="['null', 'notnull', 'empty', 'notempty'].includes(filter.comparison_op)" :key="'span' + i" />
            <v-checkbox
              v-else-if="types[filter.field] === 'boolean'"
              :key="i + '_7'"
              v-model="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />
            <v-text-field
              v-else
              :key="i + '_7'"
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

    <v-btn
      small
      class="elevation-0 grey--text my-3"
      @click.stop="addFilter"
    >
      <v-icon small color="grey">
        mdi-plus
      </v-icon>
      <!-- Add Filter -->
      {{ $t('activity.addFilter') }}
    </v-btn>
    <slot />
  </div>
</template>

<script>
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'

export default {
  name: 'ColumnFilter',
  props: {
    fieldList: [Array],
    meta: Object,
    nested: Boolean,
    parentId: String,
    viewId: String,
    shared: Boolean,
    webHook: Boolean,
    hookId: String
  },
  data: () => ({
    filters: [],
    opList: [
      'is equal', 'is not equal', 'is like', 'is not like',
      // 'is empty', 'is not empty',
      'is null', 'is not null',
      '>',
      '<',
      '>=',
      '<='
    ],
    comparisonOp: [
      {
        text: 'is equal',
        value: 'eq'
      },
      {
        text: 'is not equal',
        value: 'neq'
      },
      {
        text: 'is like',
        value: 'like'
      },
      {
        text: 'is not like',
        value: 'nlike'
      },
      {
        text: 'is empty',
        value: 'empty',
        ignoreVal: true
      },
      {
        text: 'is not empty',
        value: 'notempty',
        ignoreVal: true
      },
      {
        text: 'is null',
        value: 'null',
        ignoreVal: true
      },
      {
        text: 'is not null',
        value: 'notnull',
        ignoreVal: true
      },
      {
        text: '>',
        value: 'gt'
      },
      {
        text: '<',
        value: 'lt'
      },
      {
        text: '>=',
        value: 'gte'
      },
      {
        text: '<=',
        value: 'lte'
      }
    ]
  }),
  computed: {
    columnsById() {
      return (this.columns || []).reduce((o, c) => ({ ...o, [c.id]: c }), {})
    },
    autoApply() {
      return this.$store.state.windows.autoApplyFilter && !this.webHook
    },
    columns() {
      return (this.meta && this.meta.columns.filter(c => c && (!c.colOptions || !c.system)))
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
    }
  },
  watch: {
    async viewId(v) {
      if (v) {
        await this.loadFilter()
      }
    },
    filters: {
      handler(v) {
        this.$emit('input', v && v.filter(f => (f.fk_column_id && f.comparison_op) || f.is_group))
      },
      deep: true
    }
  },
  created() {
    this.loadFilter()
  },
  methods: {
    filterComparisonOp(f) {
      return this.comparisonOp.filter((op) => {
        if (f && f.fk_column_id && this.columnsById[f.fk_column_id] &&
          this.columnsById[f.fk_column_id].uidt === UITypes.LinkToAnotherRecord &&
          this.columnsById[f.fk_column_id].uidt === UITypes.Lookup
        ) {
          return ![
            'notempty',
            'empty',
            'notnull',
            'null'
          ].includes(op.value)
        }
        return true
      })
    },
    async applyChanges(nested = false, { hookId } = {}) {
      for (const [i, filter] of Object.entries(this.filters)) {
        if (filter.status === 'delete') {
          if (this.hookId || hookId) {
            await this.$api.dbTableFilter.delete(this.hookId || hookId, filter.id)
          } else {
            await this.$api.dbTableFilter.delete(this.viewId, filter.id)
          }
        } else if (filter.status === 'update') {
          if (filter.id) {
            if (this.hookId || hookId) {
              await this.$api.dbTableFilter.update(this.hookId || hookId, filter.id, {
                ...filter,
                fk_parent_id: this.parentId
              })
            } else {
              await this.$api.dbTableFilter.update(this.viewId, filter.id, {
                ...filter,
                fk_parent_id: this.parentId
              })
            }
          } else if (this.hookId || hookId) {
            this.$set(this.filters, i, (await this.$api.dbTableFilter.create(this.hookId || hookId, {
              ...filter,
              fk_parent_id: this.parentId
            })))
          } else {
            this.$set(this.filters, i, (await this.$api.dbTableFilter.create(this.viewId, {
              ...filter,
              fk_parent_id: this.parentId
            })))
          }
        }
      }
      if (this.$refs.nestedFilter) {
        for (const nestedFilter of this.$refs.nestedFilter) {
          await nestedFilter.applyChanges(true)
        }
      }
      this.loadFilter()
      if (!nested) { this.$emit('updated') }
    },
    async loadFilter() {
      let filters = []
      if (this.viewId && this._isUIAllowed('filterSync')) {
        filters = this.parentId
          ? (await this.$api.dbTableFilter.childrenRead(this.viewId, this.parentId))
          : (await this.$api.dbTableFilter.read(this.viewId))
      }
      if (this.hookId && this._isUIAllowed('filterSync')) {
        filters = this.parentId
          ? (await this.$api.dbTableWebhookFilter.childrenRead(this.hookId, this.parentId))
          : (await this.$api.dbTableWebhookFilter.read(this.hookId))
      }

      this.filters = filters
    },
    addFilter() {
      this.filters.push({
        fk_column_id: null,
        comparison_op: 'eq',
        value: '',
        status: 'update',
        logical_op: 'and'
      })
      this.filters = this.filters.slice()
      this.$tele.emit(`filter:add:trigger:${this.filters.length}`)
    },
    addFilterGroup() {
      this.filters.push({
        parentId: this.parentId,
        is_group: true,
        status: 'update'
      })
      this.filters = this.filters.slice()
      const index = this.filters.length - 1
      this.saveOrUpdate(this.filters[index], index)
    },
    filterUpdateCondition(filter, i) {
      this.saveOrUpdate(filter, i)
      this.$tele.emit(`filter:condition:${filter.logical_op}:${filter.comparison_op}`)
    },
    async saveOrUpdate(filter, i) {
      if (this.shared || !this._isUIAllowed('filterSync')) {
        // this.$emit('input', this.filters.filter(f => f.fk_column_id && f.comparison_op))
        this.$emit('updated')
      } else if (!this.autoApply) {
        filter.status = 'update'
      } else if (filter.id) {
        await this.$api.dbTableFilter.update(this.viewId, filter.id, {
          ...filter,
          fk_parent_id: this.parentId
        })

        this.$emit('updated')
      } else {
        this.$set(this.filters, i, (await this.$api.dbTableFilter.create(this.viewId, {
          ...filter,
          fk_parent_id: this.parentId
        })))

        this.$emit('updated')
      }
    },
    async deleteFilter(filter, i) {
      if (this.shared || !this._isUIAllowed('filterSync')) {
        this.filters.splice(i, 1)
        // this.$emit('input', this.filters.filter(f => f.fk_column_id && f.comparison_op))
        this.$emit('updated')
      } else if (filter.id) {
        if (!this.autoApply) {
          this.$set(filter, 'status', 'delete')
        } else {
          await this.$api.dbTableFilter.delete(this.viewId, filter.id)
          await this.loadFilter()
          this.$emit('updated')
        }
      } else {
        this.filters.splice(i, 1)
        this.$emit('updated')
      }
      // this.$emit('input', this.filters.filter(f => f.fk_column_id && f.comparison_op))
      this.$tele.emit('filter:delete')
    }
  }
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns:22px 80px auto auto auto;
  column-gap: 6px;
  row-gap: 6px
}
</style>
