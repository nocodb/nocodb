<template>
  <div
    class="backgroundColor pa-2 menu-filter-dropdown"
    :class="{ nested }"
    :style="{ width: nested ? '100%' : '630px' }"
  >
    <div class="grid" @click.stop>
      <template v-for="(filter, i) in filters" dense>
        <template v-if="filter.status !== 'delete'">
          <template v-if="filter.is_group">
            <v-icon
              v-if="!filter.readOnly"
              :key="i + '_1'"
              small
              class="nc-filter-item-remove-btn"
              @click.stop="deleteFilter(filter, i)"
            >
              mdi-close-box
            </v-icon>
            <span v-else :key="i + '_1'" />

            <span v-if="!i" :key="i + '_2'" class="caption d-flex align-center">{{ $t('labels.where') }}</span>
            <v-select
              v-else
              :key="i + '_2'"
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
            <span :key="i + '_3'" style="grid-column: span 3" />
          </template>

          <div v-if="filter.is_group" :key="i + '_4'" style="grid-column: span 5; padding: 6px" class="elevation-4">
            <column-filter
              v-if="filter.id || shared || !autoApply"
              ref="nestedFilter"
              v-model="filter.children"
              :parent-id="filter.id"
              :view-id="viewId"
              nested
              :meta="meta"
              :shared="shared"
              :web-hook="webHook"
              :hook-id="hookId"
              :sql-ui="sqlUi"
              @updated="$emit('updated')"
              @input="$emit('input', filters)"
            />
          </div>
          <template v-else>
            <v-icon
              v-if="!filter.readOnly"
              :key="i + '_5'"
              small
              class="nc-filter-item-remove-btn"
              @click.stop="deleteFilter(filter, i)"
            >
              mdi-close-box
            </v-icon>
            <span v-else :key="i + '_5'" />
            <span v-if="!i" :key="i + '_6'" class="caption d-flex align-center">{{ $t('labels.where') }}</span>

            <v-select
              v-else
              :key="i + '_6'"
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

            <field-list-auto-complete-dropdown
              :key="i + '_7'"

              v-model="filter.fk_column_id"
              class="caption nc-filter-field-select"
              :columns="columns"
              :disabled="filter.readOnly"
              @click.stop
              @change="
                filter.value = null;
                saveOrUpdate(filter, i);
              "
            />

            <v-select
              v-if="filter && filter.fk_column_id"
              :key="i + '_8'"
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
            <span v-else :key="i + '_8'" />
            <span v-if="isValuelessFilter(filter)" :key="i + '_5'" />
            <filter-value-input
              v-else-if="filter && filter.fk_column_id"
              :key="i + '_9'"
              v-model="filter.value"
              class="backgroundColorDefault d-flex align-center justify-center"
              :column="columnsById[filter.fk_column_id]"
              :sql-ui="sqlUi"
              @input="saveOrUpdate(filter, i)"
            />
            <span v-else :key="i + '_9'" />
          </template>
        </template>
      </template>
    </div>

    <v-btn small class="elevation-0 grey--text my-3" @click.stop="addFilter">
      <v-icon small color="grey"> mdi-plus </v-icon>
      <!-- Add Filter -->
      {{ $t('activity.addFilter') }}
    </v-btn>
    <v-btn v-if="!webHook" small class="elevation-0 grey--text my-3" @click.stop="addFilterGroup">
      <v-icon small color="grey"> mdi-plus </v-icon>
      Add Filter Group
      <!--     todo: add i18n {{ $t('activity.addFilterGroup') }}-->
    </v-btn>
    <slot />
  </div>
</template>

<script>
import { getUIDTIcon, UITypes } from '~/components/project/spreadsheet/helpers/uiTypes';
import FieldListAutoCompleteDropdown from '~/components/project/spreadsheet/components/FieldListAutoCompleteDropdown';
import FilterValueInput from '~/components/project/spreadsheet/components/filterValueInput/FilterValueInput';

export default {
  name: 'ColumnFilter',
  components: {
    FieldListAutoCompleteDropdown,
    FilterValueInput,
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
    sqlUi: [Object, Function],
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
        return { ...iconsObj, [c.title]: getUIDTIcon(c.uidt) };
      }, {});
    },
    columnsById() {
      return (this.columns || []).reduce((o, c) => ({ ...o, [c.id]: c }), {});
    },
    autoApply() {
      return this.$store.state.settings.autoApplyFilter && !this.webHook;
    },
    columns() {
      return (
        this.meta &&
        this.meta.columns
          .filter(c => c && (!c.colOptions || !c.system))
          .map(c => ({
            ...c,
            icon: getUIDTIcon(c.uidt),
          }))
      );
    },
    types() {
      if (!this.meta || !this.meta.columns || !this.meta.columns.length) {
        return {};
      }

      return this.meta.columns.reduce((obj, col) => {
        switch (col.uidt) {
          case UITypes.Number:
          case UITypes.Decimal:
            obj[col.title] = obj[col.column_name] = 'number';
            break;
          case UITypes.Checkbox:
            obj[col.title] = obj[col.column_name] = 'boolean';
            break;
          default:
            break;
        }
        return obj;
      }, {});
    },
  },
  watch: {
    viewId: {
      async handler(v) {
        if (v) {
          await this.loadFilter();
        }
      },
      immediate: true,
    },
    hookId: {
      async handler(v) {
        if (v) {
          await this.loadFilter();
        }
      },
      immediate: true,
    },
    filters: {
      handler(v) {
        this.$emit('input', v && v.filter(f => (f.fk_column_id && f.comparison_op) || f.is_group));
      },
      deep: true,
    },
  },
  methods: {
    filterComparisonOp(f) {
      return this.comparisonOp.filter(op => {
        if (f && f.fk_column_id && this.columnsById[f.fk_column_id]) {
          const uidt = this.columnsById[f.fk_column_id].uidt;
          if (uidt === UITypes.Lookup) {
            // TODO: handle it later
            return !['notempty', 'empty', 'notnull', 'null'].includes(op.value);
          } else if (uidt === UITypes.LinkToAnotherRecord) {
            const type = this.columnsById[f.fk_column_id].colOptions.type;
            if (type === 'hm' || type === 'mm') {
              // exclude notnull & null
              return !['notnull', 'null'].includes(op.value);
            } else if (type === 'bt') {
              // exclude notempty & empty
              return !['notempty', 'empty'].includes(op.value);
            }
          }
        }
        return true;
      });
    },
    async applyChanges(nested = false, { hookId } = {}) {
      for (const [i, filter] of Object.entries(this.filters)) {
        if (filter.status === 'delete') {
          if (this.hookId || hookId) {
            await this.$api.dbTableFilter.delete(filter.id);
          } else {
            await this.$api.dbTableFilter.delete(filter.id);
          }
        } else if (filter.status === 'update') {
          if (filter.id) {
            if (this.hookId || hookId) {
              await this.$api.dbTableFilter.update(filter.id, {
                ...filter,
                fk_parent_id: this.parentId,
                children: undefined,
                status: undefined,
              });
            } else {
              await this.$api.dbTableFilter.update(filter.id, {
                ...filter,
                fk_parent_id: this.parentId,
                children: undefined,
                status: undefined,
              });
            }
          } else if (this.hookId || hookId) {
            this.$set(
              this.filters,
              i,
              await this.$api.dbTableWebhookFilter.create(this.hookId || hookId, {
                ...filter,
                fk_parent_id: this.parentId,
                status: undefined,
              })
            );
          } else {
            this.$set(
              this.filters,
              i,
              await this.$api.dbTableFilter.create(this.viewId, {
                ...filter,
                fk_parent_id: this.parentId,
                status: undefined,
              })
            );
          }
        }
      }
      if (this.$refs.nestedFilter) {
        for (const nestedFilter of this.$refs.nestedFilter) {
          if (nestedFilter.parentId) {
            await nestedFilter.applyChanges(true);
          }
        }
      }
      this.loadFilter();
      if (!nested) {
        this.$emit('updated');
      }
    },
    async loadFilter() {
      let filters = [];
      if (this.viewId && this._isUIAllowed('filterSync')) {
        filters = this.nested
          ? await this.$api.dbTableFilter.childrenRead(this.parentId)
          : await this.$api.dbTableFilter.read(this.viewId);
      }
      if (this.hookId && this._isUIAllowed('filterSync')) {
        filters = this.nested
          ? await this.$api.dbTableFilter.childrenRead(this.parentId)
          : await this.$api.dbTableWebhookFilter.read(this.hookId);
      }

      this.filters = filters;
    },
    addFilter() {
      this.filters.push({
        fk_column_id: null,
        comparison_op: 'eq',
        value: '',
        status: 'update',
        logical_op: 'and',
      });
      this.filters = this.filters.slice();
      this.$e('a:filter:add', { length: this.filters.length });
    },
    addFilterGroup() {
      this.filters.push({
        parentId: this.parentId,
        is_group: true,
        status: 'update',
        logical_op: 'and',
      });
      this.filters = this.filters.slice();
      const index = this.filters.length - 1;
      this.saveOrUpdate(this.filters[index], index);
    },
    filterUpdateCondition(filter, i) {
      this.saveOrUpdate(filter, i);
      this.$e('a:filter:update', {
        logical: filter.logical_op,
        comparison: filter.comparison_op,
      });
    },
    isValuelessFilter(filter) {
      return ['notempty', 'empty', 'notnull', 'null'].includes(filter.comparison_op);
    },
    isFilterValueEmpty(filter) {
      return filter.value == null || filter.value === '';
    },
    async saveOrUpdate(filter, i) {
      if (this.shared || !this._isUIAllowed('filterSync')) {
        this.$emit('updated');
      } else if (!this.autoApply) {
        filter.status = 'update';
      } else {
        if (!filter.is_group && !this.isValuelessFilter(filter) && this.isFilterValueEmpty(filter)) {
          return;
        }

        if (filter.id) {
          await this.$api.dbTableFilter.update(filter.id, {
            ...filter,
            fk_parent_id: this.parentId,
          });

          this.$emit('updated');
        } else {
          this.$set(
            this.filters,
            i,
            await this.$api.dbTableFilter.create(this.viewId, {
              ...filter,
              fk_parent_id: this.parentId,
            })
          );

          this.$emit('updated');
        }
      }
    },
    async deleteFilter(filter, i) {
      if (this.shared || !this._isUIAllowed('filterSync')) {
        this.filters.splice(i, 1);
        this.$emit('updated');
      } else if (filter.id) {
        if (!this.autoApply) {
          this.$set(filter, 'status', 'delete');
        } else {
          await this.$api.dbTableFilter.delete(filter.id);
          await this.loadFilter();
          this.$emit('updated');
        }
      } else {
        this.filters.splice(i, 1);
        this.$emit('updated');
      }
      this.$e('a:filter:delete');
    },
  },
};
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 22px 80px auto auto auto;
  column-gap: 6px;
  row-gap: 6px;
}

.v-input {
  min-width: 0;
}
</style>
