<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { computed } from '@vue/reactivity'
import type { ComputedRef } from 'nuxt/dist/app/compat/capi'
import Fuse from 'fuse.js'
import type { ProjectType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import type { IdAndTitle } from '../dashboards/types'
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
const input: VNodeRef = ref<typeof Input>()

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

// const { $e } = useNuxtApp()

// const { loadProject } = useProject()

// const { refreshCommandPalette } = useCommandPalette()

const { api, isLoading } = useApi({ useGlobalInstance: true })

useSidebar('nc-left-sidebar', { hasSidebar: false })

const { loadWorkspaceList } = workspaceStore
const { projects } = storeToRefs(workspaceStore)
const availableDbProjects: ComputedRef<Array<IdAndTitle>> = computed(() => {
  return (
    projects.value
      ?.filter((project) => project.type === 'database')
      .map((project) => ({
        id: project.id!,
        title: project.title || 'unknown',
      })) || []
  )
})

type ToggableDBProject = Array<IdAndTitle & { isToggle: boolean }>

const dbProjectSearchTerm = ref('')
// const fuse = ref<ToggableDBProject | null>(null)
const fuse = ref<Fuse<{
  id: string
  title: string
  isToggle: boolean
}> | null>(null)

const dbProjectsWithToggleStatus = ref<ToggableDBProject>([])

watch(availableDbProjects, (projects) => {
  dbProjectsWithToggleStatus.value = projects.map((project) => ({
    ...project,
    isToggle: false,
  }))
  fuse.value = new Fuse(dbProjectsWithToggleStatus.value, {
    keys: ['title'],
    includeScore: true,
    threshold: 0.0,
  })
})

const filteredDbProjects = computed(() => {
  if (!dbProjectSearchTerm.value) {
    return dbProjectsWithToggleStatus.value
  }
  const results = fuse.value?.search(dbProjectSearchTerm.value)
  return results?.map((result) => result.item) || []
})

const createDashboardProject = async () => {
  await workspaceStore.loadProjects()
  creating.value = true
  try {
    debugger

    const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
    // const tcolor = tinycolor(color)
    // const complement = tcolor.complement()

    // const result = (await api.project.create({
    //   title: 'projectPayload.title',
    //   // @ts-expect-error todo: include in swagger
    //   fk_workspace_id: projectPayload.workspaceId,
    //   type: 'projectPayload.type ?? NcProjectType.DB',
    //   // color,
    //   // meta: JSON.stringify({
    //   //   theme: {
    //   //     primaryColor: color,
    //   //     accentColor: complement.toHex8String(),
    //   //   },
    //   //   ...(route.query.type === NcProjectType.COWRITER && {prompt_statement: ''}),
    //   // }),
    // })(
    // const result =
    const project = await api.project.create({
      title: formState.title,
      // fk_workspace_id: route.query.workspaceId,
      linked_db_project_ids: filteredDbProjects.value.filter((project) => project.isToggle).map((project) => project.id),
      // type: NcProjectType.DASHBOARD,
      color,
      // meta: JSON.stringify({
      //   theme: {
      //     primaryColor: color,
      //     accentColor: complement.toHex8String(),
      //   },
      //   ...(route.query.type === NcProjectType.COWRITER && { prompt_statement: '' }),
      // }),
    })
    //   ,
    // )) as Partial<ProjectType>

    // const project = await _createProject({
    //   type: NcProjectType.DASHBOARD,
    //   title: formState.title,
    //   workspaceId: workspaceStore.workspace!.id!,
    // })
    navigateTo(`/ws/${workspaceStore.workspace!.id!}/project/${project.id!}/layout`)

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    creating.value = false
  }
}

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return
  formState.title = await generateUniqueName()
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
})

// const createProject = async () => {
//   $e('a:project:create:xcdb')
//   try {
//     // pick a random color from array and assign to project
//     const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
//     const tcolor = tinycolor(color)

//     const complement = tcolor.complement()

//     creating.value = true

//     const result = (await api.project.create({
//       title: formState.title,
//       fk_workspace_id: route.query.workspaceId,
//       linked_db_project_ids: filteredDbProjects.value.filter((project) => project.isToggle).map((project) => project.id),
//       type: NcProjectType.DASHBOARD,
//       color,
//       meta: JSON.stringify({
//         theme: {
//           primaryColor: color,
//           accentColor: complement.toHex8String(),
//         },
//         ...(route.query.type === NcProjectType.COWRITER && { prompt_statement: '' }),
//       }),
//     })) as Partial<ProjectType>

//     refreshCommandPalette()

//     switch (route.query.type) {
//       case NcProjectType.DASHBOARD:
//         await loadProject(true, result.id)
//         await navigateTo(`/ws/${route.query.workspaceId}/nc/${result.id}/layout`)
//         break
//     }
//   } catch (e: any) {
//     message.error(await extractSdkResponseErrorMsg(e))
//   } finally {
//     creating.value = false
//   }
// }

onMounted(async () => {
  await loadWorkspaceList()
  formState.title = await generateUniqueName()
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
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
        @finish="createDashboardProject"
      >
        <h2 class="prose-2xl font-bold self-center my-4">{{ $t('dashboards.create_new_dashboard_project') }}</h2>
        <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="m-10">
          <a-input ref="input" v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
        </a-form-item>

        <div class="text-center">
          <a-form-item name="search" class="m-10">
            <a-input v-model:value="dbProjectSearchTerm" name="search" :placeholder="$t('labels.searchProjects')"></a-input>
          </a-form-item>
          <a-list item-layout="horizontal" :data-source="filteredDbProjects" class="nc-create-dashboard-project-modal-db-list">
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
        @click="createDashboardProject"
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

<style scoped lang="scss">
.nc-create-dashboard-project-modal-db-list {
  min-height: 180px;
}
</style>
