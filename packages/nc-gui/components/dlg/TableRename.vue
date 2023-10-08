<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import { useTitle } from '@vueuse/core'
import {
  Form,
  computed,
  extractSdkResponseErrorMsg,
  message,
  nextTick,
  reactive,
  storeToRefs,
  useBase,
  useCommandPalette,
  useMetas,
  useNuxtApp,
  useTablesStore,
  useTabs,
  useUndoRedo,
  useVModel,
  validateTableName,
  watchEffect,
} from '#imports'

interface Props {
  modelValue?: boolean
  tableMeta: TableType
  sourceId: string
}

const { tableMeta, sourceId, ...props } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { $e, $api } = useNuxtApp()

const { setMeta } = useMetas()

const dialogShow = useVModel(props, 'modelValue', emit)

const { updateTab } = useTabs()

const { loadProjectTables } = useTablesStore()

const baseStore = useBase()
const { loadTables, isMysql, isMssql, isPg } = baseStore
const { tables, base } = storeToRefs(baseStore)

const { allRecentViews } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { addUndo, defineProjectScope } = useUndoRedo()

const inputEl = ref<ComponentPublicInstance>()

const loading = ref(false)

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
            if (isMysql(sourceId)) {
              tableNameLengthLimit = 64
            } else if (isPg(sourceId)) {
              tableNameLengthLimit = 63
            } else if (isMssql(sourceId)) {
              tableNameLengthLimit = 128
            }
            const basePrefix = base?.value?.prefix || ''
            if ((basePrefix + value).length > tableNameLengthLimit) {
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
      const input = inputEl.value?.$el as HTMLInputElement

      if (input) {
        input.setSelectionRange(0, formState.title.length)
        input.focus()
      }
    })
  },
  { flush: 'post' },
)

const renameTable = async (undo = false, disableTitleDiffCheck?: boolean | undefined) => {
  if (!tableMeta) return
  if (formState.title === tableMeta.title && !disableTitleDiffCheck) return

  loading.value = true
  try {
    await $api.dbTable.update(tableMeta.id as string, {
      base_id: tableMeta.base_id,
      table_name: formState.title,
      title: formState.title,
    })

    dialogShow.value = false

    await loadProjectTables(tableMeta.base_id!, true)

    if (!undo) {
      addUndo({
        redo: {
          fn: (t: string) => {
            formState.title = t
            renameTable(true, true)
          },
          args: [formState.title],
        },
        undo: {
          fn: (t: string) => {
            formState.title = t
            renameTable(true, true)
          },
          args: [tableMeta.title],
        },
        scope: defineProjectScope({ model: tableMeta }),
      })
    }

    await loadTables()

    // update recent views if default view is renamed
    allRecentViews.value = allRecentViews.value.map((v) => {
      if (v.tableID === tableMeta.id && v.isDefault) {
        v.viewName = formState.title
      }
      return v
    })

    // update metas
    const newMeta = await $api.dbTable.read(tableMeta.id as string)
    await setMeta(newMeta)

    updateTab({ id: tableMeta.id }, { title: newMeta.title })

    refreshCommandPalette()

    $e('a:table:rename')

    useTitle(`${base.value?.title}: ${newMeta?.title}`)

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  loading.value = false
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="table" />
        {{ $t('activity.renameTable') }}
      </div>
    </template>
    <div class="mt-2">
      <a-form :model="formState" name="create-new-table-form">
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            class="nc-input-md"
            hide-details
            size="large"
            :placeholder="$t('msg.info.enterTableName')"
            @keydown.enter="() => renameTable()"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-6">
        <NcButton type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton
          key="submit"
          type="primary"
          :disabled="validateInfos.title.validateStatus === 'error' || formState.title === tableMeta.title"
          label="Rename Table"
          loading-label="Renaming Table"
          :loading="loading"
          @click="() => renameTable()"
        >
          {{ $t('title.renameTable') }}
          <template #loading> {{ $t('title.renamingTable') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
