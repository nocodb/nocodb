<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import { computed } from '@vue/reactivity'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const basesStore = useBases()
const { createProject: _createProject } = basesStore

const { refreshCommandPalette } = useCommandPalette()

const { navigateToProject } = useGlobal()

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
  meta: {
    iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
  },
})

const creating = ref(false)

const { t } = useI18n()

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
          class="w-full !mx-auto"
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
