<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'
import { validateDashboardName } from '~/utils/validation'

const props = defineProps<{
  modelValue: boolean
  baseId: string
}>()

const emits = defineEmits<Emits>()

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: DashboardType): void
}

const baseStore = useBase()
const { baseId: activeBaseId } = storeToRefs(baseStore)

const baseId = toRef(props, 'baseId')

const dialogShow = useVModel(props, 'modelValue', emits)

const inputEl = ref<HTMLInputElement>()

const dashboardStore = useDashboardStore()

const { createDashboard } = dashboardStore

const { dashboards: baseDashboards } = storeToRefs(dashboardStore)

const dashboard = reactive<Pick<DashboardType, 'title' | 'description'>>({})

const dashboards = computed(() => baseDashboards.value.get(baseId.value) || [])

const useForm = Form.useForm

const enableDescription = ref(false)

const removeDescription = () => {
  dashboard.description = ''
  enableDescription.value = false
}

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
const { validate, validateInfos } = useForm(dashboard, validators)

const creating = ref(false)

const _createDashboard = async () => {
  if (creating.value) return
  try {
    creating.value = true
    await validate()
    const createdDashboard = await createDashboard(baseId.value, dashboard)
    dialogShow.value = false
    emits('created', createdDashboard as DashboardType)
  } catch (e: any) {
    console.error(e)

    if (e?.errorFields?.length) {
      e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
      return
    }

    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const toggleDescription = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      inputEl.value?.focus()
    }, 100)
  }
}

onMounted(() => {
  if (!dashboards.value) return
  dashboard.title = generateUniqueTitle(`Dashboard`, dashboards.value ?? [], 'title', '-', true)

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})

watch(activeBaseId, () => {
  if (activeBaseId.value !== props.baseId) {
    dialogShow.value = false
  }
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createDashboard')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="!top-[25vh]"
    wrap-class-name="nc-modal-dashboard-create-wrapper"
    @keydown.esc="dialogShow = false"
  >
    <div class="p-5 flex flex-col gap-5">
      <div class="flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="dashboards" class="!text-gray-600 w-5 h-5" />
          {{ $t('activity.createDashboard') }}
        </div>
      </div>

      <a-form
        layout="vertical"
        :model="dashboard"
        name="create-new-dashboard-form"
        class="flex flex-col px-5 gap-5"
        @keydown.enter="_createDashboard"
        @keydown.esc="dialogShow = false"
      >
        <div class="flex flex-col gap-5">
          <a-form-item v-bind="validateInfos.title" class="relative nc-dashboard-input-wrapper relative">
            <a-input
              ref="inputEl"
              v-model:value="dashboard.title"
              class="nc-dashboard-input nc-input-sm nc-input-shadow"
              hide-details
              data-testid="create-dashboard-title-input"
              :placeholder="$t('msg.info.enterDashboardName')"
            />
          </a-form-item>

          <a-form-item v-if="enableDescription" v-bind="validateInfos.description" class="!mb-0">
            <div class="flex gap-3 text-gray-800 h-7 mb-1 items-center justify-between">
              <span class="text-[13px]">
                {{ $t('labels.description') }}
              </span>
              <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
                <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
              </NcButton>
            </div>

            <a-textarea
              ref="inputEl"
              v-model:value="dashboard.description"
              class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
              hide-details
              data-testid="create-dashboard-title-input"
              :placeholder="$t('msg.info.enterDashboardDescription')"
            />
          </a-form-item>
        </div>
        <div class="flex flex-row items-center justify-between gap-x-2">
          <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="toggleDescription">
            <div class="flex !text-gray-700 items-center gap-2">
              <GeneralIcon icon="plus" class="h-4 w-4" />

              <span class="first-letter:capitalize">
                {{ $t('labels.addDescription').toLowerCase() }}
              </span>
            </div>
          </NcButton>
          <div v-else></div>
          <div class="flex gap-2 items-center">
            <NcButton type="secondary" size="small" :disabled="creating" @click="dialogShow = false">
              {{ $t('general.cancel') }}
            </NcButton>

            <NcButton
              v-e="['a:dashboard:create']"
              type="primary"
              size="small"
              :disabled="validateInfos.title?.validateStatus === 'error' || creating"
              :loading="creating"
              @click="_createDashboard"
            >
              {{ $t('activity.createDashboard') }}
              <template #loading> {{ $t('title.creatingDashboard') }} </template>
            </NcButton>
          </div>
        </div>
      </a-form>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-wrapper.nc-modal-dashboard-create-wrapper {
  .ant-modal-content {
    @apply !rounded-5;
  }

  .ant-form-item {
    @apply mb-0;
  }

  .nc-input-text-area {
    padding-block: 8px !important;
  }
}
</style>
