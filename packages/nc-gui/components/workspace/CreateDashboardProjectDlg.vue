<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { computed } from '@vue/reactivity'
import { NcProjectType, extractSdkResponseErrorMsg } from '~/utils'
import { ref, useVModel } from '#imports'
import { useWorkspace } from '~/store/workspace'
import { navigateTo } from '#app'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const projectsStore = useProjects()

const workspaceStore = useWorkspace()

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

const route = useRoute()
const creating = ref(false)

const createProject = async () => {
  creating.value = true
  try {
    const project = await _createProject({
      type: props.type,
      title: formState.title,
      workspaceId: workspaceStore.workspace!.id!,
    })

    await workspaceStore.loadProjects()
    navigateToProject({
      projectId: project.id!,
      workspaceId: workspaceStore.workspace!.id!,
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
  formState.title = await generateUniqueName()
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
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-project-create"
    @keydown.esc="dialogShow = false"
  >
    <div class="pl-10 pr-10 pt-5">
      <!-- Create A New Table -->
      <!-- <div class="prose-xl font-bold self-center my-4">FFCreate {{ typeLabel }} Project</div> -->

      <a-form
        ref="form"
        :model="formState"
        name="basic"
        layout="vertical"
        class="lg:max-w-3/4 w-full !mx-auto"
        no-style
        autocomplete="off"
        @finish="createProject"
      >
        <h2 class="prose-2xl font-bold self-center my-4">{{ $t('dashboards.create_new_dashboard_project') }}</h2>
        <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="m-10">
          <a-input ref="input" v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
        </a-form-item>

        <div class="text-center">
          <a-form-item name="search" class="m-10">
            <a-input v-model:value="dbProjectSearchTerm" name="search" :placeholder="$t('labels.searchProjects')"></a-input>
          </a-form-item>
          <a-list item-layout="horizontal" :data-source="filteredDbProjects">
            <template #renderItem="{ item }">
              <a-list-item>
                <template #actions>
                  <a-switch :key="item.id" v-model:checked="item.isToggle" />
                </template>
                {{ item.title }}
              </a-list-item>
            </template>
          </a-list>

          <a-spin v-if="creating" spinning />
        </div>
      </a-form>
    </div>
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button
        key="submit"
        data-testid="docs-create-proj-dlg-create-btn"
        :disabled="creating"
        size="large"
        type="primary"
        @click="createProject"
        >{{ $t('general.create') }}
      </a-button>

      <!-- <button class="scaling-btn bg-opacity-100" type="submit">
        <span class="flex items-center gap-2">
          <MaterialSymbolsRocketLaunchOutline />
          {{ $t('general.create') }}
        </span>
      </button> -->
    </template>
  </a-modal>
</template>

<style scoped lang="scss"></style>
