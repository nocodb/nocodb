<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { computed } from '@vue/reactivity'
import { NcProjectType, extractSdkResponseErrorMsg, projectTitleValidator, ref, useGlobal, useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
  type?: NcProjectType
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const projectType = computed(() => props.type ?? NcProjectType.DB)

const projectsStore = useProjects()
const { createProject: _createProject } = projectsStore

const { navigateToProject } = useGlobal()

const nameValidationRules = [
  {
    required: true,
    message: 'Database name is required',
  },
  projectTitleValidator,
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
})

const creating = ref(false)

const createProject = async () => {
  creating.value = true
  try {
    const project = await _createProject({
      type: projectType.value,
      title: formState.value.title,
    })

    navigateToProject({
      projectId: project.id!,
      type: projectType.value,
      workspaceId: 'nc',
    })
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const input: VNodeRef = ref<typeof Input>()

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return

  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: 'Untitled Database',
    }

    await nextTick()

    input.value?.$el?.focus()
    input.value?.$el?.select()
  }, 5)
})

const typeLabel = computed(() => {
  switch (projectType.value) {
    case NcProjectType.DB:
    default:
      return 'Database'
  }
})
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small">
    <template #header>
      <!-- Create A New Table -->
      <div class="flex flex-row items-center">
        <GeneralProjectIcon :type="projectType" class="mr-2.5 !text-lg !h-4" />
        Create {{ typeLabel }}
      </div>
    </template>
    <div class="mt-3">
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
        <a-form-item name="title" :rules="nameValidationRules" class="m-10">
          <a-input
            ref="input"
            v-model:value="formState.title"
            name="title"
            class="nc-metadb-project-name nc-input-md"
            placeholder="Title"
          />
        </a-form-item>
      </a-form>

      <div class="flex flex-row justify-end mt-7 gap-x-2">
        <NcButton type="secondary" @click="dialogShow = false">Cancel</NcButton>
        <NcButton
          data-testid="docs-create-proj-dlg-create-btn"
          :loading="creating"
          type="primary"
          :label="`Create ${typeLabel}`"
          :loading-label="`Creating ${typeLabel}`"
          @click="createProject"
        >
          {{ `Create ${typeLabel}` }}
          <template #loading>
            {{ `Creating ${typeLabel}` }}
          </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
:deep(.ant-modal-content) {
  @apply !p-0;
}
</style>
