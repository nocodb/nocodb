<script setup lang="ts">
import {
  Form,
  TabType,
  computed,
  nextTick,
  onMounted,
  ref,
  useProject,
  useTableNew,
  useTablesStore,
  useTabs,
  useVModel,
  validateTableName,
} from '#imports'

const props = defineProps<{
  modelValue: boolean
  baseId: string
  projectId: string
}>()

const emit = defineEmits(['update:modelValue', 'create'])

const dialogShow = useVModel(props, 'modelValue', emit)

const isAdvanceOptVisible = ref(false)

const inputEl = ref<HTMLInputElement>()

const { addTab } = useTabs()

const { isMysql, isMssql, isPg } = useProject()

const { loadProjectTables, addTable } = useTablesStore()

const { table, createTable, generateUniqueTitle, tables, project } = useTableNew({
  async onTableCreate(table) {
    // await loadProject(props.projectId)

    await addTab({
      id: table.id as string,
      title: table.title,
      type: TabType.TABLE,
      projectId: props.projectId,
      // baseId: props.baseId,
    })

    addTable(props.projectId, table)
    await loadProjectTables(props.projectId, true)

    emit('create', table)
    dialogShow.value = false
  },
  baseId: props.baseId,
  projectId: props.projectId,
})

const useForm = Form.useForm

const validators = computed(() => {
  return {
    title: [
      validateTableName,
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if ((tables.value || []).some((t) => t.title === (value || '') && t.base_id === props.baseId)) {
              return reject(new Error('Duplicate table alias'))
            }
            return resolve(true)
          })
        },
      },
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            let tableNameLengthLimit = 255
            if (isMysql(props.baseId)) {
              tableNameLengthLimit = 64
            } else if (isPg(props.baseId)) {
              tableNameLengthLimit = 63
            } else if (isMssql(props.baseId)) {
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
const { validate, validateInfos } = useForm(table, validators)

const systemColumnsCheckboxInfo = SYSTEM_COLUMNS.map((c, index) => ({
  value: c,
  disabled: index === 0,
}))

const creating = ref(false)

const _createTable = async () => {
  if (creating.value) return
  try {
    creating.value = true
    await validate()
    await createTable()
    dialogShow.value = false
  } catch (e: any) {
    console.error(e)
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

onMounted(() => {
  generateUniqueTitle()
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})
</script>

<template>
  <NcModal v-model:visible="dialogShow" :header="$t('activity.createTable')" size="small" @keydown.esc="dialogShow = false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="table" />
        {{ $t('activity.createTable') }}
      </div>
    </template>
    <div class="flex flex-col mt-2">
      <a-form :model="table" name="create-new-table-form" @keydown.enter="_createTable" @keydown.esc="dialogShow = false">
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="table.title"
            class="nc-input-md"
            hide-details
            data-testid="create-table-title-input"
            :placeholder="$t('msg.info.enterTableName')"
          />
        </a-form-item>
        <div class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
          <div>
            <div class="mb-1">
              <!-- Add Default Columns -->
              {{ $t('msg.info.defaultColumns') }}
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
                      <span>{{ $t('msg.idColumnRequired') }}</span>
                    </template>
                    {{ $t('datatype.ID') }}
                  </a-tooltip>
                  <div v-else class="flex">
                    {{ value }}
                  </div>
                </template>
              </a-checkbox-group>
            </a-row>
          </div>
        </div>
        <div class="flex flex-row justify-end gap-x-2 mt-2">
          <NcButton type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

          <NcButton
            type="primary"
            :disabled="validateInfos.title.validateStatus === 'error'"
            :loading="creating"
            @click="_createTable"
          >
            {{ $t('activity.createTable') }}
            <template #loading> {{ $t('title.creatingTable') }} </template>
          </NcButton>
        </div>
      </a-form>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 100px;
  }
}
</style>
