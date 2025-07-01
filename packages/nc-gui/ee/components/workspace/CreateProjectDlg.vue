<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import { computed } from '@vue/reactivity'
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const basesStore = useBases()
const { createProject: _createProject } = basesStore

const { refreshCommandPalette } = useCommandPalette()

const { navigateToProject } = useGlobal()

const { blockPrivateBases } = useEeConfig()

const nameValidationRules = [
  {
    required: true,
    message: 'Database name is required',
  },
  baseTitleValidator(),
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
  isPrivate: false,
  meta: {
    iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
  },
})

const creating = ref(false)

const createProject = async () => {
  if (formState.value.title) {
    formState.value.title = formState.value.title.trim()
  }

  creating.value = true
  try {
    const base = await _createProject({
      title: formState.value.title,
      workspaceId: activeWorkspace.value!.id!,
      meta: formState.value.meta,
    })

    navigateToProject({
      baseId: base.id!,
      workspaceId: activeWorkspace.value!.id!,
    })

    refreshCommandPalette()

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const aiMode = ref<boolean | null>(null)

const modalSize = computed(() => (aiMode.value !== true ? 'small' : 'lg'))

const input = ref<typeof Input>()

const onInit = () => {
  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: t('objects.project'),
      meta: {
        iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
      },
    }

    await nextTick()

    input.value?.$el?.focus()
    input.value?.$el?.select()
  }, 5)
}

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return

  aiMode.value = null
})

watch(aiMode, () => {
  if (aiMode.value !== false) return

  onInit()
})

const isOpenBaseAccessDropdown = ref(false)

const baseAccessOptions = [
  {
    label: t('general.public'),
    value: 'false',
    icon: 'ncUsers',
    subtext: t('title.baseAccessDefaultSubtext'),
  },
  {
    label: t('general.private'),
    value: 'true',
    icon: 'ncUser',
    subtext: t('title.baseAccessPrivateSubtext'),
  },
] as (NcListItemType & { icon: IconMapKey })[]

const selectedBaseAccessOption = computed(() => {
  return baseAccessOptions.find((option) => option.value === (formState.value.isPrivate.toString() || 'false'))!
})

const onBaseAccessChange = (value: RawValueType) => {
  formState.value.isPrivate = value === 'true'
}
</script>

<template>
  <NcModal
    :key="`${aiMode}`"
    v-model:visible="dialogShow"
    :size="modalSize"
    :show-separator="false"
    :width="aiMode === null ? 'auto' : undefined"
    :wrap-class-name="
      aiMode ? 'nc-modal-ai-base-create' : `nc-modal-wrapper ${aiMode === null ? 'nc-ai-select-base-create-mode-modal' : ''}`
    "
  >
    <template v-if="aiMode === false" #header>
      <!-- Create A New Table -->
      <div class="flex flex-row items-center text-base text-gray-800">
        <GeneralProjectIcon :color="formState.meta.iconColor" class="mr-2.5" />
        {{ $t('general.create') }} {{ $t('objects.project') }}
      </div>
    </template>
    <template v-if="aiMode === null">
      <WorkspaceProjectCreateMode v-model:ai-mode="aiMode" />
    </template>
    <template v-if="aiMode === false">
      <div class="mt-1">
        <a-form
          ref="form"
          :model="formState"
          name="basic"
          layout="vertical"
          class="w-full !mx-auto flex flex-col gap-5"
          no-style
          autocomplete="off"
          @finish="createProject"
        >
          <a-form-item name="title" :rules="nameValidationRules" class="!mb-0">
            <a-input
              ref="input"
              v-model:value="formState.title"
              name="title"
              class="nc-metadb-base-name nc-input-sm nc-input-shadow"
              placeholder="Title"
            />
          </a-form-item>

          <a-form-item name="isPrivate" class="!mb-0">
            <template #label>
              <div>{{ t('general.baseAccess') }}</div>
            </template>

            <NcListDropdown v-model:is-open="isOpenBaseAccessDropdown">
              <div class="flex-1 flex items-center gap-2 text-nc-content-gray-subtle">
                <GeneralIcon :icon="selectedBaseAccessOption.icon" class="flex-none h-4 w-4" />
                <span class="text-captionDropdownDefault">{{ selectedBaseAccessOption.label }}</span>
              </div>
              <template #overlay="{ onEsc }">
                <NcList
                  v-model:open="isOpenBaseAccessDropdown"
                  :value="formState.isPrivate ? 'true' : 'false'"
                  :list="baseAccessOptions"
                  :item-height="48"
                  class="!w-auto"
                  variant="medium"
                  wrapper-class-name="!h-auto"
                  @update:value="onBaseAccessChange"
                  @escape="onEsc"
                >
                  <template #listItem="{ option, isSelected }">
                    <div class="w-full flex flex-col">
                      <div class="w-full flex items-center justify-between">
                        <div class="flex items-center gap-2 text-nc-content-gray">
                          <GeneralIcon :icon="option.icon" class="flex-none h-4 w-4" />
                          <span class="text-captionDropdownDefault">{{ option.label }}</span>
                        </div>

                        <PaymentUpgradeBadge
                          v-if="blockPrivateBases"
                          :feature="PlanFeatureTypes.FEATURE_PRIVATE_BASES"
                          :plan-title="PlanTitles.BUSINESS"
                          remove-click
                        />
                        <GeneralIcon v-else-if="isSelected" icon="check" class="text-primary h-4 w-4" />
                      </div>
                      <div class="text-bodySm text-nc-content-gray-muted ml-6">{{ option.description }}</div>
                    </div>
                  </template>
                </NcList>
              </template>
            </NcListDropdown>
          </a-form-item>
        </a-form>

        <div class="flex flex-row justify-end mt-5 gap-x-2">
          <NcButton type="secondary" size="small" :disabled="creating" @click="dialogShow = false">{{
            $t('labels.cancel')
          }}</NcButton>
          <NcButton
            v-e="['a:base:create']"
            data-testid="docs-create-proj-dlg-create-btn"
            :loading="creating"
            type="primary"
            size="small"
            :disabled="creating"
            :label="`Create ${t('objects.project')}`"
            :loading-label="`Creating ${t('objects.project')}`"
            @click="createProject"
          >
            {{ $t('general.createEntity', { entity: t('objects.project') }) }}
            <template #loading>
              {{ $t('general.creatingEntity', { entity: t('objects.project') }) }}
            </template>
          </NcButton>
        </div>
      </div>
    </template>
    <template v-if="aiMode === true">
      <WorkspaceProjectAiCreateProject
        v-model:ai-mode="aiMode"
        v-model:dialog-show="dialogShow"
        :workspace-id="activeWorkspace.id"
      />
    </template>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-ai-base-create .ant-modal-content {
  .nc-modal {
    @apply !p-0;

    .nc-modal-header {
      @apply mb-0 px-4 py-2 items-center gap-3;
    }

    .ant-checkbox {
      @apply !shadow-none;
    }
  }
}

.nc-modal-wrapper.nc-ai-select-base-create-mode-modal {
  .ant-modal-content {
    @apply !rounded-[24px];
  }
}
</style>
