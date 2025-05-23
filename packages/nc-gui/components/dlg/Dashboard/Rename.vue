<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'

interface Props {
  modelValue?: boolean
  dashboard: DashboardType
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const dialogShow = useVModel(props, 'modelValue', emit)

const dashboard = toRef(props, 'dashboard')

const { updateDashboard } = useDashboardStore()

const dashboards = computed(() => dashboards.value.get(dashboard.value.base_id) || [])

const { $e } = useNuxtApp()

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
      validateDashboardName,
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if ((dashboards.value || []).some((t) => t.title === (value || ''))) {
              return reject(new Error('Duplicate dashboard name'))
            }
            return resolve(true)
          })
        },
      },
    ],
  }
})

const { validateInfos } = useForm(formState, validators)

watchEffect(
  () => {
    if (dashboard.value?.title) formState.title = `${dashboard.value.title}`

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

const renameDashboard = async (undo = false, disableTitleDiffCheck?: boolean | undefined) => {
  if (!dashboard) return

  if (formState.title) {
    formState.title = formState.title.trim()
  }

  if (formState.title === dashboard.value.title && !disableTitleDiffCheck) return

  loading.value = true
  try {
    await updateDashboard(dashboard.value.base_id, dashboard.value.id as string, {
      title: formState.title,
    })

    dialogShow.value = false

    if (!undo) {
      addUndo({
        redo: {
          fn: (t: string) => {
            formState.title = t
            renameDashboard(true, true)
          },
          args: [formState.title],
        },
        undo: {
          fn: (t: string) => {
            formState.title = t
            renameDashboard(true, true)
          },
          args: [dashboard.value.title],
        },
        scope: defineProjectScope({ base_id: dashboard.value.base_id }),
      })
    }

    $e('a:dashboard:rename')

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
        <GeneralIcon icon="rename" />
        {{ $t('activity.renameDashboard') }}
      </div>
    </template>
    <div class="mt-1">
      <a-form :model="formState" name="create-new-dashboard-form">
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            class="nc-input-sm nc-input-shadow"
            hide-details
            size="small"
            :placeholder="$t('msg.info.enterDashboardName')"
            @keydown.enter="() => renameDashboard()"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton
          key="submit"
          type="primary"
          size="small"
          :disabled="validateInfos.title.validateStatus === 'error' || formState.title?.trim() === dashboard.title"
          label="Rename Dashboard"
          loading-label="Renaming Dashboard"
          :loading="loading"
          @click="() => renameDashboard()"
        >
          {{ $t('title.renameDashboard') }}
          <template #loading> {{ $t('title.renamingDashboard') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
