<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { Icon } from '@iconify/vue'
import { computed } from '@vue/reactivity'
import type { ComputedRef } from 'nuxt/dist/app/compat/capi'
import Fuse from 'fuse.js'
import type { IdAndTitle } from '../layouts/types'
import { NcProjectType, extractSdkResponseErrorMsg, projectTitleValidator, ref, useVModel, useWorkspace } from '#imports'
import { navigateTo } from '#app'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const projectsStore = useProjects()
const { loadProjects } = projectsStore

useSidebar('nc-left-sidebar', { hasSidebar: false })

const workspaceStore = useWorkspace()
const { loadWorkspaces } = workspaceStore
const { activeWorkspace } = storeToRefs(workspaceStore)
const { projects } = storeToRefs(useProjects())

const input: VNodeRef = ref<typeof Input>()

type TabKey = '1' | '2'

const { createProject: _createProject } = projectsStore

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
] as RuleObject[]

const availableDbProjects: ComputedRef<Array<IdAndTitle>> = computed(() => {
  return (
    Array.from(projects.value)
      ?.filter(([_, project]) => project.type === 'database')
      .map(([_, project]) => ({
        id: project.id!,
        title: project.title || 'unknown',
      })) || []
  )
})

type ToggableDBProject = Array<IdAndTitle & { isToggle: boolean }>

const selectedTab = ref<TabKey[]>(['1'])
const form = ref<typeof Form>()
const formState = reactive({
  title: '',
})

const createButtonClicked = ref(false)
const showAlertBox = ref(false)
const creating = ref(false)

const dbProjectSearchTerm = ref('')

const dbProjectsWithToggleStatus = ref<ToggableDBProject>([])

const selectedDbProjects = computed(() => {
  return dbProjectsWithToggleStatus.value.filter((p) => p.isToggle)
})

const numberOfSelectedDbProjects = computed(() => {
  return selectedDbProjects.value.length
})

watch(numberOfSelectedDbProjects, (n) => {
  if (n > 0) {
    showAlertBox.value = false
  }
})

const fuse = ref<Fuse<{
  id: string
  title: string
  isToggle: boolean
}> | null>(null)

watch(
  availableDbProjects,
  (projects) => {
    dbProjectsWithToggleStatus.value = projects.map((project) => ({
      ...project,
      isToggle: false,
    }))
    fuse.value = new Fuse(dbProjectsWithToggleStatus.value, {
      keys: ['title'],
      includeScore: true,
      threshold: 0.0,
    })
  },
  {
    immediate: true,
  },
)

const filteredDbProjects = computed(() => {
  if (!dbProjectSearchTerm.value) {
    return dbProjectsWithToggleStatus.value
  }
  const results = fuse.value?.search(dbProjectSearchTerm.value)
  return results?.map((result) => result.item) || []
})

const resetState = () => {
  creating.value = false
  selectedTab.value = ['1']
  showAlertBox.value = false
}

const createDashboardProject = async () => {
  createButtonClicked.value = true
  if (numberOfSelectedDbProjects.value === 0 && !showAlertBox.value) {
    showAlertBox.value = true
    return
  }
  creating.value = true
  try {
    const project = await _createProject({
      type: NcProjectType.DASHBOARD,
      title: formState.title,
      workspaceId: activeWorkspace.value!.id!,
      linkedDbProjectIds: selectedDbProjects.value.map((p) => p.id),
    })
    await loadProjects()

    navigateTo(`/ws/${activeWorkspace.value!.id!}/project/${project.id!}/layout`)

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const gotoStepTwo = () => {
  selectedTab.value = ['2']
}

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return
  formState.title = await generateUniqueName()
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
  if (!n && o) {
    resetState()
  }
})

onMounted(async () => {
  formState.title = await generateUniqueName()
  await loadWorkspaces()
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
})

const showSearchIcon = computed(() => {
  return dbProjectSearchTerm.value === ''
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
    <div>
      <a-form
        ref="form"
        :model="formState"
        name="basic"
        layout="vertical"
        class="w-full !mx-auto"
        no-style
        autocomplete="off"
        @finish="createDashboardProject"
      >
        <div class="flex items-center mb-8">
          <img src="~/assets/nc-icons/dashboard.svg" class="text-[#DDB00F] text-lg p-2px rounded bg-opacity-5 mx-0.5 mr-2" />
          <h2 class="text-base font-medium self-center mb-0">{{ $t('dashboards.create_new_dashboard_project') }}</h2>
        </div>
        <a-menu v-model:selectedKeys="selectedTab" class="!mb-8" mode="horizontal">
          <a-menu-item key="1" class="custom-menu-item !-ml-4">1: Interfaces Name</a-menu-item>
          <a-menu-item key="2"
            >2: Data Sources
            <a-tag class="!border-none !bg-gray-50 !rounded-md">{{ numberOfSelectedDbProjects }} connected</a-tag>
          </a-menu-item>
        </a-menu>
        <div v-if="selectedTab.includes('1')">
          <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="m-10">
            <a-input
              ref="input"
              v-model:value="formState.title"
              name="title"
              class="nc-metadb-project-name !rounded-md !py-2"
              data-testid="create-layouts-page-title-input"
              @finish="gotoStepTwo"
            />
          </a-form-item>
        </div>
        <div v-if="selectedTab.includes('2')">
          <!-- <CreateDashboardProjectStepTwo /> -->
          <h2 class="text-base font-medium self-center mb-4">{{ $t('dashboards.connect_data_sources') }}</h2>
          <h3 class="mb-4 font-normal mb-6 text-gray-600">
            {{ $t('dashboards.select_database_projects_that_you_want_to_link_to_this_dashboard_projects') }}
          </h3>
          <div v-show="showAlertBox" class="flex border-1 border-orange-600 rounded-md mb-8 p-4 pt-0">
            <GeneralIcon icon="warning" class="text-orange-600 !text-3xl mt-2 mr-4" />
            <div class="pt-4">
              <h3>{{ $t('dashboards.alert') }}</h3>
              <h3 class="font-normal text-gray-600">
                {{ $t('dashboards.alert-message') }}
              </h3>
            </div>
          </div>
          <!-- TODO keep focus on the input field - right now it's losing it after one letter is entered -->
          <div class="text-center">
            <a-form-item name="search">
              <a-input
                v-model:value="dbProjectSearchTerm"
                class="!py-2 !rounded-lg"
                name="search"
                :placeholder="$t('labels.searchProjects')"
              >
                <template #prefix>
                  <Icon v-show="showSearchIcon" class="text-xl !text-gray-600" icon="material-symbols:search"></Icon>
                </template>
              </a-input>
            </a-form-item>
            <a-list
              item-layout="horizontal"
              :data-source="filteredDbProjects"
              class="nc-create-dashboard-project-modal-db-list max-h-52 overflow-y-auto"
            >
              <template #header>
                <div class="flex items-center justify-between text-gray-400">
                  <div class="text-left">{{ $t('dashboards.project_name') }}</div>
                  <div class="text-right">{{ $t('dashboards.connect') }}</div>
                </div>
              </template>
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
        </div>
      </a-form>
    </div>
    <template #footer>
      <a-button
        v-show="selectedTab.includes('1')"
        key="submit"
        :disabled="creating"
        size="large"
        type="primary"
        class="!rounded-md"
        @click="gotoStepTwo"
        >{{ $t('dashboards.connect_data_sources') }}
      </a-button>
      <a-button
        v-show="selectedTab.includes('2') && !showAlertBox"
        key="submit"
        class="!rounded-md"
        data-testid="docs-create-proj-dlg-create-btn"
        :disabled="creating"
        size="large"
        type="primary"
        @click="createDashboardProject"
        >{{ $t('general.create') }}
      </a-button>
      <a-button
        v-show="selectedTab.includes('2') && showAlertBox"
        key="submit"
        class="!rounded-md"
        data-testid="docs-create-proj-dlg-skip-btn"
        :disabled="creating"
        size="large"
        @click="createDashboardProject"
        >{{ $t('general.skip') }}
      </a-button>
    </template>
  </a-modal>
</template>

<style scoped lang="scss">
.nc-create-dashboard-project-modal-db-list {
  min-height: 180px;
}
</style>
