<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { SizeType } from 'ant-design-vue/es/config-provider'
import { computed, onMounted, provide, watch } from '#imports'
import MdiTableIcon from '~icons/mdi/table'
import MdiDeleteIcon from '~icons/mdi/close-box'
import MdiStringIcon from '~icons/mdi/alpha-a'
import MdiLongTextIcon from '~icons/mdi/text'
import MdiNumericIcon from '~icons/mdi/numeric'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiKeyStarIcon from '~icons/mdi/key-star'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'

interface Props {
  quickImportType: string
  projectTemplate: object
}

const { quickImportType, projectTemplate } = defineProps<Props>()

const valid = ref(false)
const expansionPanel = ref(<number[]>[])
const editableTn = ref({})
const LinkToAnotherRecord = 'LinkToAnotherRecord'
const Lookup = 'Lookup'
const Rollup = 'Rollup'
const iconSize = ref<SizeType>('middle')
const tableColumns = [
  {
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
  },
  {
    name: 'Column Type',
    dataIndex: 'column_type',
    key: 'column_type',
  },
  {
    name: 'Action',
    key: 'action',
  },
]

const project = reactive(<any>{
  name: 'Project Name',
  tables: [],
})

onMounted(() => {
  parseAndLoadTemplate()
})

const parseAndLoadTemplate = () => {
  if (projectTemplate) {
    parseTemplate(projectTemplate)
    expansionPanel.value = Array.from({ length: project.value?.tables.length || 0 }, (_, i) => i)
  }
}

const parseTemplate = ({ tables = [], ...rest }: Record<string, any>) => {
  const parsedTemplate = {
    ...rest,
    tables: tables.map(
      ({ manyToMany = [], hasMany = [], belongsTo = [], v = [], columns = [], ...rest }: Record<string, any>) => ({
        ...rest,
        columns: [
          ...columns.map((c: any, idx: number) => {
            c.key = idx
            return c
          }),
          ...manyToMany.map((mm: any) => ({
            column_name: mm.title || `${rest.table_name} <=> ${mm.ref_table_name}`,
            uidt: LinkToAnotherRecord,
            type: 'mm',
            ...mm,
          })),
          ...hasMany.map((hm: any) => ({
            column_name: hm.title || `${rest.table_name} => ${hm.table_name}`,
            uidt: LinkToAnotherRecord,
            type: 'hm',
            ref_table_name: hm.table_name,
            ...hm,
          })),
          ...belongsTo.map((bt: any) => ({
            column_name: bt.title || `${rest.table_name} => ${bt.ref_table_name}`,
            uidt: UITypes.ForeignKey,
            ref_table_name: bt.table_name,
            ...bt,
          })),
          ...v.map((v: any) => {
            const res: any = {
              column_name: v.title,
              ref_table_name: {
                ...v,
              },
            }
            if (v.lk) {
              res.uidt = Lookup
              res.ref_table_name.table_name = v.lk.ltn
              res.ref_column_name = v.lk.lcn
              res.ref_table_name.type = v.lk.type
            } else if (v.rl) {
              res.uidt = Rollup
              res.ref_table_name.table_name = v.rl.rltn
              res.ref_column_name = v.rl.rlcn
              res.ref_table_name.type = v.rl.type
              res.fn = v.rl.fn
            }
            return res
          }),
        ],
      }),
    ),
  }
  console.log(parsedTemplate)
  project.value = parsedTemplate
}

const onTableNameUpdate = (oldTable: string, newVal: string) => {
  // TODO:
}

const deleteTable = (tableIdx: number) => {
  // TODO:
}

const isRelation = (col: ColumnType) => {
  return col.uidt === 'LinkToAnotherRecord' || col.uidt === 'ForeignKey'
}

const isLookup = (col: ColumnType) => {
  return col.uidt === 'Lookup'
}

const isRollup = (col: ColumnType) => {
  return col.uidt === 'Rollup'
}

const isVirtual = (col: ColumnType) => {
  // TODO: uiTypes
  // return col && uiTypes.some(ut => ut.name === col.uidt && ut.virtual);
}

const isLookupOrRollup = (col: ColumnType) => {
  return isLookup(col) || isRollup(col)
}

const isSelect = (col: ColumnType) => {
  return col.uidt === 'MultiSelect' || col.uidt === 'SingleSelect'
}

const onColumnNameUpdate = (oldCol: ColumnType, newVal: string, tn: string) => {
  // TODO
}

const onRTypeChange = (oldType: string, newType: string, col: ColumnType, table: string) => {
  // TODO
}

const deleteTableColumn = (i: number, j: number, col: ColumnType, table: string) => {
  // TODO
}

const addNewColumnRow = (table: string, uidt?: string) => {
  // TODO
}

const getIcon = (type: string) => {
  // TODO
  return {
    name: 'CreateTime',
    icon: 'mdi-calendar-clock',
  }
}
</script>

<template>
  <a-card>
    <template #title>
      <slot name="toolbar" />
    </template>
    <v-form ref="form" v-model="valid">
      <p v-if="project.tables && quickImportType === 'excel'" class="caption grey--text mt-4">
        {{ project.tables.length }} sheet{{ project.tables.length > 1 ? 's' : '' }}
        available for import
      </p>
      <a-collapse
        v-if="project.value?.tables && project.value?.tables.length"
        v-model:activeKey="expansionPanel"
        v-for="(table, i) in project.value?.tables"
        :key="i"
      >
        <template #expandIcon="{ isActive }">
          <v-text-field
            v-if="editableTn[i]"
            :value="table.table_name"
            class="font-weight-bold"
            style="max-width: 300px"
            outlinedk
            autofocus
            density="compact"
            hide-details
            @input="(e) => onTableNameUpdate(table, e)"
            @click="(e) => e.stopPropagation()"
            @blur="$set(editableTn, i, false)"
            @keydown.enter="$set(editableTn, i, false)"
          />
          <span v-else class="font-weight-bold">
            <MdiTableIcon />
            {{ table.table_name }}
          </span>
          <v-spacer />
          <a-tooltip bottom>
            <template #title>
              <!-- TODO: i18n -->
              <span>Delete Table</span>
            </template>
            <MdiDeleteIcon v-if="project.value.tables.length > 1" @click.stop="deleteTable(i)" />
          </a-tooltip>
        </template>
        <a-collapse-panel>
          <a-table
            v-if="table.columns.length"
            :dataSource="table.columns"
            :columns="tableColumns"
            :pagination="false"
          >
            <template #headerCell="{ column }">
              <template v-if="column.key === 'column_name'">
                <span>
                  {{ $t('labels.columnName') }}
                </span>
              </template>
              <template v-else-if="column.key === 'column_type'">
                <span>
                  {{ $t('labels.columnType') }}
                </span>
              </template>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'column_name'">
                <!--                        TODO: make it editable -->
                <span> {{ record.column_name }} </span>
              </template>
              <template v-else-if="column.key === 'column_type'">
                <!--                        TODO: render uidt dropdown-->
                {{ record.uidt }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-tooltip v-if="record.key == 0" bottom>
                  <template #title>
                    <!-- TODO: i18n -->
                    <span>Primary Value</span>
                  </template>
                  <MdiKeyStarIcon />
                </a-tooltip>
                <a-tooltip v-else bottom>
                  <template #title>
                    <!-- TODO: i18n -->
                    <span>Delete Column</span>
                  </template>
                  <a-button type="link" @click="deleteTableColumn(i, record.key, record, table)" :size="iconSize">
                    <template #icon>
                      <MdiDeleteOutlineIcon />
                    </template>
                  </a-button>
                </a-tooltip>
              </template>
            </template>
          </a-table>

          <div class="text-center">
            <a-tooltip bottom>
              <template #title>
                <!-- TODO: i18n -->
                <span>Add Number Column</span>
              </template>
              <a-button @click="addNewColumnRow(table, 'Number')" :size="iconSize">
                <template #icon>
                  <MdiNumericIcon />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip bottom>
              <template #title>
                <!-- TODO: i18n -->
                <span>Add SingleLineText Column</span>
              </template>
              <a-button @click="addNewColumnRow(table, 'SingleLineText')" :size="iconSize">
                <template #icon>
                  <MdiStringIcon />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip bottom>
              <template #title>
                <!-- TODO: i18n -->
                <span>Add LongText Column</span>
              </template>
              <a-button @click="addNewColumnRow(table, 'LongText')" :size="iconSize">
                <template #icon>
                  <MdiLongTextIcon />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip bottom>
              <template #title>
                <!-- TODO: i18n -->
                <span>Add Other Column</span>
              </template>
              <a-button @click="addNewColumnRow(table)" :size="iconSize">
                <template #icon>
                  <MdiPlusIcon />
                </template>
                Column
              </a-button>
            </a-tooltip>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </v-form>
  </a-card>
</template>
