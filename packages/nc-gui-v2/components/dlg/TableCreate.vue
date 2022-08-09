<script setup lang="ts">
import { Form } from 'ant-design-vue'
import { onMounted, useProject, useTable, useTabs } from '#imports'
import { validateTableName } from '~/utils/validation'
import { TabType } from '~/composables'

interface Props {
  modelValue?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const isAdvanceOptVisible = ref(false)

const { addTab } = useTabs()

const { loadTables } = useProject()

const { table, createTable, generateUniqueTitle, tables, project } = useTable(async (table) => {
  await loadTables()

  addTab({
    id: table.id as string,
    title: table.title,
    type: TabType.TABLE,
  })
  dialogShow.value = false
})

// const prefix = computed(() => project?.value?.prefix || '')

const validateDuplicateAlias = (v: string) => {
  return (tables?.value || []).every((t) => t.title !== (v || '')) || 'Duplicate table alias'
}
// const validateLeadingOrTrailingWhiteSpace = (v: string) => {
//   return !/^\s+|\s+$/.test(v) || 'Leading or trailing whitespace not allowed in table name'
// }
// const validateDuplicate = (v: string) => {
//   return (tables?.value || []).every((t) => t.table_name.toLowerCase() !== (v || '').toLowerCase()) || 'Duplicate table name'
// }

const inputEl = ref<HTMLInputElement>()

const useForm = Form.useForm

const validators = computed(() => {
  return {
    title: [validateTableName, validateDuplicateAlias],
    table_name: [validateTableName],
  }
})
const { validateInfos } = useForm(table, validators)

onMounted(() => {
  generateUniqueTitle()
  inputEl.value?.focus()
})
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(30vw, 600px)" :mask-closable="false" @keydown.esc="dialogShow = false">
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" size="large" type="primary" @click="createTable()">{{ $t('general.submit') }}</a-button>
    </template>
    <div class="pl-10 pr-10 pt-5">
      <a-form :model="table" name="create-new-table-form" @keydown.enter="createTable">
        <!-- Create A New Table -->
        <div class="prose-xl font-bold self-center my-4">{{ $t('activity.createTable') }}</div>
        <!-- hint="Enter table name" -->
        <div class="mb-2">Table Name</div>
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="table.title"
            size="large"
            hide-details
            :placeholder="$t('msg.info.enterTableName')"
          />
        </a-form-item>
        <div class="flex justify-end">
          <div class="pointer" @click="isAdvanceOptVisible = !isAdvanceOptVisible">
            {{ isAdvanceOptVisible ? 'Hide' : 'Show' }} more
            <v-icon x-small color="grey">
              {{ isAdvanceOptVisible ? 'mdi-minus-circle-outline' : 'mdi-plus-circle-outline' }}
            </v-icon>
          </div>
        </div>
        <div class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
          <!-- hint="Table name as saved in database" -->
          <div v-if="!project.prefix" class="mb-2">{{ $t('msg.info.tableNameInDb') }}</div>
          <a-form-item v-if="!project.prefix" v-bind="validateInfos.table_name">
            <a-input v-model:value="table.table_name" size="large" hide-details :placeholder="$t('msg.info.tableNameInDb')" />
          </a-form-item>
          <div>
            <div class="mb-5">
              <!-- Add Default Columns -->
              {{ $t('msg.info.addDefaultColumns') }}
            </div>
            <a-row>
              <a-col :span="6">
                <a-tooltip placement="top">
                  <template #title>
                    <span>ID column is required, you can rename this later if required.</span>
                  </template>
                  <a-checkbox v-model:checked="table.columns.id" disabled>ID</a-checkbox>
                </a-tooltip>
              </a-col>
              <a-col :span="6">
                <a-checkbox v-model:checked="table.columns.title"> title </a-checkbox>
              </a-col>
              <a-col :span="6">
                <a-checkbox v-model:checked="table.columns.created_at"> created_at </a-checkbox>
              </a-col>
              <a-col :span="6">
                <a-checkbox v-model:checked="table.columns.updated_at"> updated_at </a-checkbox>
              </a-col>
            </a-row>
          </div>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
::v-deep {
  .v-text-field__details {
    padding: 0 2px !important;

    .v-messages:not(.error--text) {
      .v-messages__message {
        color: grey;
        font-size: 0.65rem;
      }
    }
  }
}

.add-default-title {
  font-size: 0.65rem;
}

.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
