<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'

interface Props {
  modelValue?: boolean
  tableMeta: TableType
  sourceId: string
}

const { tableMeta, ...props } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { $e, $api } = useNuxtApp()

const { setMeta } = useMetas()

const dialogShow = useVModel(props, 'modelValue', emit)

const { loadProjectTables } = useTablesStore()

const baseStore = useBase()

const { loadTables } = baseStore

const { addUndo, defineProjectScope } = useUndoRedo()

const inputEl = ref<HTMLTextAreaElement>()

const loading = ref(false)

const useForm = Form.useForm

const formState = reactive({
  description: '',
})

const validators = computed(() => {
  return {
    description: [
      {
        validator: (_: any, _value: any) => {
          return new Promise<void>((resolve, _reject) => {
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
    if (tableMeta?.description) formState.description = `${tableMeta.description}`

    nextTick(() => {
      const input = inputEl.value?.$el as HTMLInputElement

      if (input) {
        input.setSelectionRange(0, formState.description.length)
        input.focus()
      }
    })
  },
  { flush: 'post' },
)

const updateDescription = async (undo = false) => {
  if (!tableMeta) return

  if (formState.description) {
    formState.description = formState.description.trim()
  }

  loading.value = true
  try {
    await $api.dbTable.update(tableMeta.id as string, {
      base_id: tableMeta.base_id,
      description: formState.description,
    })

    dialogShow.value = false

    await loadProjectTables(tableMeta.base_id!, true)

    if (!undo) {
      addUndo({
        redo: {
          fn: (t: string) => {
            formState.description = t
            updateDescription(true, true)
          },
          args: [formState.description],
        },
        undo: {
          fn: (t: string) => {
            formState.description = t
            updateDescription(true, true)
          },
          args: [tableMeta.description],
        },
        scope: defineProjectScope({ model: tableMeta }),
      })
    }

    await loadTables()

    // update metas
    const newMeta = await $api.dbTable.read(tableMeta.id as string)
    await setMeta(newMeta)

    $e('a:table:description:update')

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  loading.value = false
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small" :show-separator="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="table" class="w-6 h-6 text-gray-700" />
        <span class="text-gray-900 font-bold">
          {{ tableMeta?.title ?? tableMeta?.table_name }}
        </span>
      </div>
    </template>
    <div class="mt-1">
      <a-form layout="vertical" :model="formState" name="create-new-table-form">
        <a-form-item :label="$t('labels.description')" v-bind="validateInfos.description">
          <a-textarea
            ref="inputEl"
            v-model:value="formState.description"
            class="nc-input-sm !py-2 nc-text-area nc-input-shadow"
            hide-details
            size="small"
            :placeholder="$t('msg.info.enterTableDescription')"
            @keydown.enter.exact="() => updateDescription()"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton
          key="submit"
          type="primary"
          size="small"
          :disabled="
            validateInfos?.description?.validateStatus === 'error' || formState.description?.trim() === tableMeta?.description
          "
          :loading="loading"
          @click="() => updateDescription()"
        >
          {{ $t('general.save') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-text-area {
  @apply !py-2 min-h-[120px] max-h-[200px];
}

:deep(.ant-form-item-label > label) {
  @apply !text-md font-base  !leading-[20px] text-gray-800 flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}
</style>
