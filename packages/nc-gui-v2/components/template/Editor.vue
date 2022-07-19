<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { SizeType } from 'ant-design-vue/es/config-provider'
import { computed, onMounted, provide, watch } from '#imports'
import MdiTableIcon from '~icons/mdi/table'
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
const inputRefs = ref(<HTMLInputElement[]>[])
const LinkToAnotherRecord = 'LinkToAnotherRecord'
const Lookup = 'Lookup'
const Rollup = 'Rollup'
const iconSize = ref<SizeType>('middle')
const tableColumns = [
  {
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
    width: 250,
  },
  {
    name: 'Column Type',
    dataIndex: 'column_type',
    key: 'column_type',
    width: 250,
  },
  {
    name: 'Select Option',
    key: 'select_option',
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
    tables: tables.map(({ v = [], columns = [], ...rest }: Record<string, any>) => ({
      ...rest,
      columns: [
        ...columns.map((c: any, idx: number) => {
          c.key = idx
          return c
        }),
        ...v.map((v: any) => {
          const res: any = {
            column_name: v.title,
            ref_table_name: {
              ...v,
            },
          }
          return res
        }),
      ],
    })),
  }
  project.value = parsedTemplate
}

const onTableNameUpdate = (oldTable: string, newVal: string) => {
  // TODO:
}

const deleteTable = (tableIdx: number) => {
  const deleteTable = project.value.tables[tableIdx]
  for (const table of project.value.tables) {
    if (table === deleteTable) {
      continue
    }
    table.columns = table.columns.filter((c: Record<string, any>) => c.ref_table_name !== deleteTable.table_name)
  }
  project.value.tables.splice(tableIdx, 1)
}

const isSelect = (col: ColumnType) => {
  return col.uidt === 'MultiSelect' || col.uidt === 'SingleSelect'
}

const onColumnNameUpdate = (oldCol: ColumnType, newVal: string, tn: string) => {
  // TODO
}

const deleteTableColumn = (i: number, j: number, col: Record<string, any>, table: Record<string, any>) => {
  const deleteTable = project.value.tables[i]
  const deleteColumn = deleteTable.columns[j]
  for (const table of project.value.tables) {
    if (table === deleteTable) {
      continue
    }
    table.columns = table.columns.filter(
      (c: Record<string, any>) => c.ref_table_name !== deleteTable.table_name || c.ref_column_name !== deleteColumn.column_name,
    )
  }
  deleteTable.columns.splice(j, 1)
}

const addNewColumnRow = (table: Record<string, any>, uidt?: string) => {
  table.columns.push({
    key: table.columns.length,
    column_name: `title${table.columns.length + 1}`,
    uidt,
  })
  nextTick(() => {
    const input = inputRefs.value[table.columns.length - 1]
    input.focus()
    input.select()
  })
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
      <a-collapse v-if="project.value?.tables && project.value?.tables.length" v-model:activeKey="expansionPanel">
        <a-collapse-panel v-for="(table, i) in project.value?.tables" :key="i">
          <template #header>
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
          </template>
          <template #extra>
            <a-tooltip bottom>
              <template #title>
                <!-- TODO: i18n -->
                <span>Delete Table</span>
              </template>
              <MdiDeleteOutlineIcon v-if="project.value.tables.length > 1" @click.stop="deleteTable(i)" />
            </a-tooltip>
          </template>
          <a-table v-if="table.columns.length" :dataSource="table.columns" :columns="tableColumns" :pagination="false">
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
                <a-input
                  v-model:value="record.column_name"
                  :ref="
                    (el) => {
                      inputRefs[record.key] = el
                    }
                  "
                />
              </template>
              <template v-else-if="column.key === 'column_type'">
                <!--                        TODO: render uidt dropdown-->
                {{ record.uidt }}
              </template>

              <template v-else-if="column.key === 'select_option'">
                <a-input v-model:value="record.dtxp" v-if="isSelect(record)" />
              </template>

              <template v-if="column.key === 'action'">
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
