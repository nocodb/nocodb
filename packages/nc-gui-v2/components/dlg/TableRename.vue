<script setup lang="ts">
import { onMounted, watchEffect } from '@vue/runtime-core'
import { Form } from 'ant-design-vue'
import type { TableType } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import { useProject, useTableCreate, useTabs } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { validateTableName } from '~/utils/validation'
import { useNuxtApp } from '#app'

interface Props {
  modelValue?: boolean
  tableMeta: TableType
}

const { modelValue = false, tableMeta } = defineProps<Props>()
const emit = defineEmits(['update:modelValue', 'updated'])
const { $e, $api } = useNuxtApp()
const toast = useToast()
const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const { updateTab } = useTabs()
const { loadTables } = useProject()
const { project, tables } = useProject()

const prefix = computed(() => project?.value?.prefix || '')
const validateDuplicateAlias = (v: string) => {
  return (tables?.value || []).every((t) => t.title !== (v || '')) || 'Duplicate table alias'
}
const validateLeadingOrTrailingWhiteSpace = (v: string) => {
  return !/^\s+|\s+$/.test(v) || 'Leading or trailing whitespace not allowed in table name'
}
const validateDuplicate = (v: string) => {
  return (tables?.value || []).every((t) => t.table_name.toLowerCase() !== (v || '').toLowerCase()) || 'Duplicate table name'
}
const inputEl = $ref<any>()
const useForm = Form.useForm
const formState = reactive({
  title: '',
})
const validators = computed(() => {
  return {
    title: [validateTableName, validateDuplicateAlias],
    table_name: [validateTableName],
  }
})
const { resetFields, validate, validateInfos } = useForm(formState, validators)

watchEffect(() => {
  if (tableMeta?.title) formState.title = tableMeta?.title
  // todo: replace setTimeout and follow better approach
  nextTick(() => {
    const input = inputEl?.$el
    input.setSelectionRange(0, formState.title.length)
    input.focus()
  })
})

const renameTable = async () => {
  try {
    await $api.dbTable.update(tableMeta?.id as string, {
      title: formState.title,
    })

    loadTables()
    updateTab({ id: tableMeta?.id }, { title: formState.title })
    toast.success('Table renamed successfully')
    $e('a:table:rename')
  } catch (e) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-modal v-model:visible="dialogShow" @keydown.esc="dialogShow = false" @finish="renameTable">
    <template #footer>
      <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" type="primary" @click="renameTable">{{ $t('general.submit') }}</a-button>
    </template>
    <div class="pl-10 pr-10 pt-5">
      <a-form :model="formState" name="create-new-table-form">
        <!-- Rename Table -->
        <div class="prose-xl font-bold text-center my-4">Rename Table</div>
        <!-- hint="Enter table name" -->
        <div class="mb-2">Table Name</div>
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            size="large"
            hide-details
            :placeholder="$t('msg.info.enterTableName')"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>
