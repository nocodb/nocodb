<script lang="ts" setup>
import { customAlphabet } from 'nanoid'
import type { Form, Input } from 'ant-design-vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import type { VNodeRef } from '@vue/runtime-core'
import type { ProjectType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import type { ComputedRef } from 'nuxt/dist/app/compat/capi'
import Fuse from 'fuse.js'
import type { IdAndTitle } from './types'
import {
  extractSdkResponseErrorMsg,
  generateUniqueName,
  iconMap,
  message,
  navigateTo,
  nextTick,
  onMounted,
  projectTitleValidator,
  reactive,
  ref,
  useApi,
  useCommandPalette,
  useNuxtApp,
  useProject,
  useRoute,
  useSidebar,
  useTable,
} from '#imports'
import { NcProjectType } from '~/utils'

const { $e } = useNuxtApp()

const { loadTables, loadProject } = useProject()

const { table, createTable } = useTable(async (_) => {
  await loadTables()
})

const { refreshCommandPalette } = useCommandPalette()

const { api, isLoading } = useApi({ useGlobalInstance: true })

useSidebar('nc-left-sidebar', { hasSidebar: false })

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
] as RuleObject[]

const form = ref<typeof Form>()

const workspaceStore = useWorkspace()
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

const formState = reactive({
  title: '',
})

const route = useRoute()
const creating = ref(false)

const createProject = async () => {
  $e('a:project:create:xcdb')
  try {
    // pick a random color from array and assign to project
    const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
    const tcolor = tinycolor(color)

    const complement = tcolor.complement()

    // todo: provide proper project type
    creating.value = true

    const result = (await api.project.create({
      title: formState.title,
      fk_workspace_id: route.query.workspaceId,
      linked_db_project_ids: filteredDbProjects.value.filter((project) => project.isToggle).map((project) => project.id),
      type: route.query.type ?? NcProjectType.DB,
      color,
      meta: JSON.stringify({
        theme: {
          primaryColor: color,
          accentColor: complement.toHex8String(),
        },
        ...(route.query.type === NcProjectType.COWRITER && { prompt_statement: '' }),
      }),
    })) as Partial<ProjectType>

    refreshCommandPalette()

    switch (route.query.type) {
      case NcProjectType.DOCS:
        await loadProject(true, result.id)
        await navigateTo(`/ws/${route.query.workspaceId}/nc/${result.id}/doc`)
        break
      case NcProjectType.COWRITER: {
        // force load project so that baseId is available in useTable
        await loadProject(true, result.id)
        // Create a table for the COWRITER form
        const nanoidV2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14)
        table.table_name = `nc_cowriter_${nanoidV2()}`
        // exclude title
        table.columns = ['id', 'created_at', 'updated_at']
        await createTable()

        await navigateTo(`/nc/cowriter/${result.id}`)
        break
      }
      default:
        await navigateTo(`/ws/${route.query.workspaceId}/nc/${result.id}`)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    creating.value = false
  }
}

const input: VNodeRef = ref<typeof Input>()

// computed(() => {
//   return availableDbProjects.value.map((project) => ({
//     ...project,
//     isToggle: false,
//   }))
// })

onMounted(async () => {
  await loadWorkspaceList()
  formState.title = await generateUniqueName()
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
})
</script>

<template>
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
    <h2 class="prose-2xl font-bold self-center my-4">New Dashboard Project</h2>
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
      <button v-else class="scaling-btn bg-opacity-100" type="submit">
        <span class="flex items-center gap-2">
          <MaterialSymbolsRocketLaunchOutline />
          {{ $t('general.create') }}
        </span>
      </button>
    </div>
  </a-form>
</template>
