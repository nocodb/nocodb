<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'

interface Props {
  modelValue?: boolean
  dashboard: DashboardType
}

const { dashboard, ...props } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { loadDashboards, updateDashboard } = useDashboardStore()

const { $e } = useNuxtApp()

const dialogShow = useVModel(props, 'modelValue', emit)

const { addUndo, defineProjectScope } = useUndoRedo()

const inputEl = ref<ComponentPublicInstance>()

const loading = ref(false)

const formState = reactive({
  description: '',
})

watchEffect(
  () => {
    if (dashboard?.description) formState.description = `${dashboard.description}`

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
  if (!dashboard) return

  if (formState.description) {
    formState.description = formState.description.trim()
  }

  loading.value = true
  try {
    await updateDashboard(dashboard.base_id, dashboard.id as string, {
      description: formState.description,
    })

    dialogShow.value = false

    if (!undo) {
      addUndo({
        redo: {
          fn: (t: string) => {
            formState.description = t
            updateDescription(true)
          },
          args: [formState.description],
        },
        undo: {
          fn: (t: string) => {
            formState.description = t
            updateDescription(true)
          },
          args: [dashboard.description],
        },
        scope: defineProjectScope({ base_id: dashboard.base_id }),
      })
    }

    await loadDashboards({ baseId: dashboard.base_id, force: true })

    $e('a:dashboard:description:update')

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
        <GeneralIcon icon="dashboards" class="mt-0.5 !text-2xl" />

        <span class="text-nc-content-gray-emphasis font-semibold">
          {{ dashboard?.title }}
        </span>
      </div>
    </template>
    <div class="mt-1">
      <a-form layout="vertical" :model="formState" name="create-new-table-form">
        <a-form-item :label="$t('labels.description')">
          <a-textarea
            ref="inputEl"
            v-model:value="formState.description"
            class="nc-input-sm !py-2 nc-text-area !text-nc-content-gray nc-input-shadow"
            hide-details
            size="small"
            :placeholder="$t('msg.info.enterScriptDescription')"
            @keydown.enter.exact="() => updateDescription()"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton key="submit" type="primary" size="small" :loading="loading" @click="() => updateDescription()">
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
  @apply !leading-[20px] font-base !text-md text-nc-content-gray flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}
</style>
