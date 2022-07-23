<script setup lang="ts">
import { watchEffect } from '@vue/runtime-core'
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

const inputEl = $ref<any>()
let loading = $ref(false)
const useForm = Form.useForm
const formState = reactive({
  title: '',
})
const validators = computed(() => {
  return {
    title: [
      validateTableName,
      {
        validator: (rule: any, value: any, callback: (errMsg?: string) => void) => {
          if (/^\s+|\s+$/.test(value)) {
            callback('Leading or trailing whitespace not allowed in table name')
          }
          if (
            !(tables?.value || []).every(
              (t) => t.id === tableMeta.id || t.table_name.toLowerCase() !== (value || '').toLowerCase(),
            )
          ) {
            callback('Duplicate table alias')
          }
          callback()
        },
      },
    ],
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
  loading = true
  try {
    await $api.dbTable.update(tableMeta?.id as string, {
      title: formState.title,
    })
    dialogShow.value = false
    loadTables()
    updateTab({ id: tableMeta?.id }, { title: formState.title })
    toast.success('Table renamed successfully')
    $e('a:table:rename')
    dialogShow.value = false
  } catch (e) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading = false
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :title="$t('activity.renameTable')"
    @keydown.esc="dialogShow = false"
    @finish="renameTable"
  >
    <template #footer>
      <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" type="primary" :loading="loading" @click="renameTable">{{ $t('general.submit') }}</a-button>
    </template>
    <div class="pl-10 pr-10 pt-5">
      <a-form :model="formState" name="create-new-table-form">
        <!-- hint="Enter table name" -->
        <div class="mb-2">{{ $t('msg.info.enterTableName') }}</div>
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            hide-details
            :placeholder="$t('msg.info.enterTableName')"
            @keydown.enter="renameTable"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>
