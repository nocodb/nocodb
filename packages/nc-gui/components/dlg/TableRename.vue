<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import {
  Form,
  computed,
  extractSdkResponseErrorMsg,
  message,
  nextTick,
  reactive,
  useI18n,
  useMetas,
  useNuxtApp,
  useProject,
  useTabs,
  validateTableName,
  watchEffect,
} from '#imports'

interface Props {
  modelValue?: boolean
  tableMeta: TableType
}

const { modelValue = false, tableMeta } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const { setMeta } = useMetas()

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const { updateTab } = useTabs()

const { loadTables, tables, project, isMysql, isMssql, isPg } = useProject()

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
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (/^\s+|\s+$/.test(value)) {
              return reject(new Error('Leading or trailing whitespace not allowed in table name'))
            }
            if (
              !(tables?.value || []).every(
                (t) => t.id === tableMeta.id || t.table_name.toLowerCase() !== (value || '').toLowerCase(),
              )
            ) {
              return reject(new Error('Duplicate table alias'))
            }
            resolve()
          })
        },
      },
    ],
  }
})

const { validateInfos } = useForm(formState, validators)

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
      project_id: tableMeta?.project_id,
      table_name: formState.title,
    })

    dialogShow.value = false

    await loadTables()

    updateTab({ id: tableMeta?.id }, { title: formState.title })

    // update metas
    await setMeta(await $api.dbTable.read(tableMeta?.id as string))

    // Table renamed successfully
    message.success(t('msg.success.tableRenamed'))
    $e('a:table:rename')
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  loading = false
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :title="$t('activity.renameTable')"
    :mask-closable="false"
    wrap-class-name="nc-modal-table-rename"
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
