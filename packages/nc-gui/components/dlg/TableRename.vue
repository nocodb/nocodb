<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import {
  Form,
  computed,
  extractSdkResponseErrorMsg,
  message,
  nextTick,
  reactive,
  storeToRefs,
  useCommandPalette,
  useI18n,
  useMetas,
  useNuxtApp,
  useProject,
  useTabs,
  useVModel,
  validateTableName,
  watchEffect,
} from '#imports'

interface Props {
  modelValue?: boolean
  tableMeta: TableType
  baseId: string
}

const { tableMeta, baseId, ...props } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const { setMeta } = useMetas()

const dialogShow = useVModel(props, 'modelValue', emit)

const { updateTab } = useTabs()

const projectStore = useProject()
const { loadTables, isMysql, isMssql, isPg } = projectStore
const { tables, project } = storeToRefs(projectStore)

const { refreshCommandPalette } = useCommandPalette()

const inputEl = $ref<ComponentPublicInstance>()

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
            if (isMysql(baseId)) {
              tableNameLengthLimit = 64
            } else if (isPg(baseId)) {
              tableNameLengthLimit = 63
            } else if (isMssql(baseId)) {
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
              !(tables?.value || []).every((t) => t.id === tableMeta.id || t.title.toLowerCase() !== (value || '').toLowerCase())
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

watchEffect(
  () => {
    if (tableMeta?.title) formState.title = `${tableMeta.title}`

    nextTick(() => {
      const input = inputEl?.$el as HTMLInputElement

      if (input) {
        input.setSelectionRange(0, formState.title.length)
        input.focus()
      }
    })
  },
  { flush: 'post' },
)

const renameTable = async () => {
  if (!tableMeta) return

  loading = true
  try {
    await $api.dbTable.update(tableMeta.id as string, {
      project_id: tableMeta.project_id,
      table_name: formState.title,
      title: formState.title,
    })

    dialogShow.value = false

    await loadTables()

    // update metas
    const newMeta = await $api.dbTable.read(tableMeta.id as string)
    await setMeta(newMeta)

    updateTab({ id: tableMeta.id }, { title: newMeta.title })

    refreshCommandPalette()

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
    :class="{ active: dialogShow }"
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
