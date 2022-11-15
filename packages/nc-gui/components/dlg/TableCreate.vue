<script setup lang="ts">
import { Form, computed, onMounted, ref, useProject, useTable, useTabs, useVModel, validateTableName } from '#imports'
import { TabType } from '~/lib'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const isAdvanceOptVisible = ref(false)

const inputEl = ref<HTMLInputElement>()

const { addTab } = useTabs()

const { loadTables, isMysql, isMssql, isPg } = useProject()

const { table, createTable, generateUniqueTitle, tables, project } = useTable(async (table) => {
  await loadTables()

  addTab({
    id: table.id as string,
    title: table.title,
    type: TabType.TABLE,
  })

  dialogShow.value = false
})

const useForm = Form.useForm

const validateDuplicateAlias = (v: string) => (tables.value || []).every((t) => t.title !== (v || '')) || 'Duplicate table alias'

const validators = computed(() => {
  return {
    title: [
      validateTableName,
      validateDuplicateAlias,
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            let tableNameLengthLimit = 255
            if (isMysql) {
              tableNameLengthLimit = 64
            } else if (isPg) {
              tableNameLengthLimit = 63
            } else if (isMssql) {
              tableNameLengthLimit = 128
            }
            const projectPrefix = project?.value?.prefix || ''
            if ((projectPrefix + value).length > tableNameLengthLimit) {
              return reject(new Error(`Table name exceeds ${tableNameLengthLimit} characters`))
            }
            resolve()
          })
        },
      },
    ],
    table_name: [validateTableName],
  }
})
const { validateInfos } = useForm(table, validators)

const systemColumnsCheckboxInfo = SYSTEM_COLUMNS.map((c, index) => ({
  value: c,
  disabled: index === 0,
}))

onMounted(() => {
  generateUniqueTitle()

  inputEl.value?.focus()
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-table-create"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="large" type="primary" @click="createTable()">{{ $t('general.submit') }}</a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <a-form :model="table" name="create-new-table-form" @keydown.enter="createTable">
        <!-- Create A New Table -->
        <div class="prose-xl font-bold self-center my-4">{{ $t('activity.createTable') }}</div>

        <!-- hint="Enter table name" -->
        <!--        Table name -->
        <div class="mb-2">{{ $t('labels.tableName') }}</div>

        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="table.title"
            size="large"
            hide-details
            data-testid="create-table-title-input"
            :placeholder="$t('msg.info.enterTableName')"
          />
        </a-form-item>

        <div class="flex justify-end items-center">
          <div class="pointer flex flex-row items-center gap-x-1" @click="isAdvanceOptVisible = !isAdvanceOptVisible">
            {{ isAdvanceOptVisible ? $t('general.hideAll') : $t('general.showMore') }}

            <MdiMinusCircleOutline v-if="isAdvanceOptVisible" class="text-gray-500" />
            <MdiPlusCircleOutline v-else class="text-gray-500" />
          </div>
        </div>
        <div class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
          <!-- hint="Table name as saved in database" -->
          <div v-if="!project.prefix" class="mb-2">{{ $t('msg.info.tableNameInDb') }}</div>

          <a-form-item v-if="!project.prefix" v-bind="validateInfos.table_name">
            <a-input v-model:value="table.table_name" size="large" hide-details :placeholder="$t('msg.info.tableNameInDb')" />
          </a-form-item>

          <div>
            <div class="mb-1">
              <!-- Add Default Columns -->
              {{ $t('msg.info.addDefaultColumns') }}
            </div>

            <a-row>
              <a-checkbox-group
                v-model:value="table.columns"
                :options="systemColumnsCheckboxInfo"
                class="!flex flex-row justify-between w-full"
              >
                <template #label="{ value }">
                  <a-tooltip v-if="value === 'id'" placement="top" class="!flex">
                    <template #title>
                      <span>ID column is required, you can rename this later if required.</span>
                    </template>
                    ID
                  </a-tooltip>
                  <div v-else class="flex">
                    {{ value }}
                  </div>
                </template>
              </a-checkbox-group>
            </a-row>
          </div>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
