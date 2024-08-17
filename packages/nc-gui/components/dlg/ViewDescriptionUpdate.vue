<script setup lang="ts">
import type { ViewType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'

interface Props {
  modelValue?: boolean
  view: ViewType
  sourceId?: string
}

const { view, ...props } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { $e, $api } = useNuxtApp()

const dialogShow = useVModel(props, 'modelValue', emit)

const { loadViews } = useViewsStore()

const { addUndo, defineProjectScope } = useUndoRedo()

const inputEl = ref<ComponentPublicInstance>()

const loading = ref(false)

const useForm = Form.useForm

const formState = reactive({
  description: '',
})

const validators = computed(() => {
  return {
    description: [
      {
        validator: (_: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (value.length > 255) {
              return reject(new Error(`View description exceeds 255 characters`))
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
    if (view?.description) formState.description = `${view.description}`

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
  if (!view) return

  if (formState.description) {
    formState.description = formState.description.trim()
  }

  loading.value = true
  try {
    await $api.dbView.update(view.id as string, {
      description: formState.description,
    })

    dialogShow.value = false

    // await loadProjectTables(view.base_id!, true)

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
          args: [view.description],
        },
        scope: defineProjectScope({ view }),
      })
    }

    await loadViews({ tableId: view.fk_model_id, ignoreLoading: true, force: true })

    $e('a:view:description:update')

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
        <GeneralViewIcon :meta="view" class="mt-0.5 !text-2xl" />

        <span class="text-gray-900 font-bold">
          {{ view?.title }}
        </span>
      </div>
    </template>
    <div class="mt-1">
      <a-form :model="formState" name="create-new-table-form">
        <a-form-item v-bind="validateInfos.description">
          <a-textarea
            ref="inputEl"
            v-model:value="formState.description"
            class="nc-input-sm !py-2 nc-text-area nc-input-shadow"
            hide-details
            size="small"
            :placeholder="$t('msg.info.enterTableDescription')"
            @keydown.enter="() => updateDescription()"
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
            validateInfos?.description?.validateStatus === 'error' || formState.description?.trim() === view?.description
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
</style>
