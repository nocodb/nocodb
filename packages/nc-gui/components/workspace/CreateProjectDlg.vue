<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { computed } from '@vue/reactivity'
import { NcProjectType, extractSdkResponseErrorMsg } from '~/utils'
import { projectTitleValidator, ref, useVModel } from '#imports'
import { useWorkspace } from '~/store/workspace'
import { navigateTo } from '#app'

const props = defineProps<{
  modelValue: boolean
  type: NcProjectType
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const projectsStore = useProjects()

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)
const { loadProjects } = useProjects()
const { createProject: _createProject } = projectsStore

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
] as RuleObject[]

const form = ref<typeof Form>()

const formState = reactive({
  title: '',
})

const creating = ref(false)

const createProject = async () => {
  creating.value = true
  try {
    const project = await _createProject({
      type: props.type,
      title: formState.title,
      workspaceId: activeWorkspace.value!.id!,
    })

    await loadProjects()
    navigateToProject({
      projectId: project.id!,
      workspaceId: activeWorkspace.value!.id!,
      type: props.type,
    })
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    creating.value = false
  }
}

// todo: move to utils
function navigateToProject(param: { projectId: string; workspaceId: string; type: NcProjectType }) {
  switch (param.type) {
    case NcProjectType.DOCS:
      navigateTo(`/ws/${param.workspaceId}/nc/${param.projectId}/doc`)
      break
    default:
      navigateTo(`/ws/${param.workspaceId}/project/${param.projectId}`)
      break
  }
}

const input: VNodeRef = ref<typeof Input>()

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return
  formState.title = 'Untitled'
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
})

const typeLabel = computed(() => {
  switch (props.type) {
    case NcProjectType.DOCS:
      return 'Book'
    case NcProjectType.DB:
      return 'Database'
    default:
      return ''
  }
})
</script>

<template>
  <general-modal v-model:visible="dialogShow" width="32rem">
    <div class="px-8 py-5.5">
      <!-- Create A New Table -->
      <div class="flex flex-row prose-lg font-medium items-center mb-7">
        <GeneralProjectIcon :type="props.type" class="mr-2.5 !text-lg !h-4" />
        Create {{ typeLabel }}
      </div>

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
            class="nc-metadb-project-name !rounded !py-1"
            placeholder="Title"
          />
        </a-form-item>
      </a-form>

      <div class="flex flex-row justify-end mt-8">
        <a-button
          key="submit"
          class="!rounded-md"
          data-testid="docs-create-proj-dlg-create-btn"
          :disabled="creating"
          type="primary"
          @click="createProject"
          >{{ $t('general.create') }} {{ $t('objects.project') }}
        </a-button>
      </div>
    </div>
  </general-modal>
</template>

<style scoped lang="scss">
:deep(.ant-modal-content) {
  @apply !p-0;
}
</style>
