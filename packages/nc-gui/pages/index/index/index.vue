<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { breakpointsTailwind } from '@vueuse/core'
import {
  Empty,
  Modal,
  computed,
  definePageMeta,
  extractSdkResponseErrorMsg,
  message,
  navigateTo,
  onBeforeMount,
  projectThemeColors,
  ref,
  themeV2Colors,
  useApi,
  useBreakpoints,
  useCopy,
  useGlobal,
  useNuxtApp,
  useUIPermission,
} from '#imports'

definePageMeta({
  title: 'title.myProject',
})

const { $api, $e } = useNuxtApp()

const { api, isLoading } = useApi()

const { isUIAllowed } = useUIPermission()

const { md } = useBreakpoints(breakpointsTailwind)

const filterQuery = ref('')

const projects = ref<ProjectType[]>()

const { appInfo } = useGlobal()

const loadProjects = async () => {
  const response = await api.project.list({})
  projects.value = response.list
}

const filteredProjects = computed(
  () =>
    projects.value?.filter(
      (project) => !filterQuery.value || project.title?.toLowerCase?.().includes(filterQuery.value.toLowerCase()),
    ) ?? [],
)

const deleteProject = (project: ProjectType) => {
  $e('c:project:delete')

  Modal.confirm({
    title: `Do you want to delete '${project.title}' project?`,
    wrapClassName: 'nc-modal-project-delete',
    okText: 'Yes',
    okType: 'danger',
    cancelText: 'No',
    async onOk() {
      try {
        await api.project.delete(project.id as string)

        $e('a:project:delete')

        projects.value?.splice(projects.value?.indexOf(project), 1)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const handleProjectColor = async (projectId: string, color: string) => {
  const tcolor = tinycolor(color)

  if (tcolor.isValid()) {
    const complement = tcolor.complement()

    const project: ProjectType = await $api.project.read(projectId)

    const meta = project?.meta && typeof project.meta === 'string' ? JSON.parse(project.meta) : project.meta || {}

    await $api.project.update(projectId, {
      color,
      meta: JSON.stringify({
        ...meta,
        theme: {
          primaryColor: color,
          accentColor: complement.toHex8String(),
        },
      }),
    })

    // Update local project
    const localProject = projects.value?.find((p) => p.id === projectId)

    if (localProject) {
      localProject.color = color

      localProject.meta = JSON.stringify({
        ...meta,
        theme: {
          primaryColor: color,
          accentColor: complement.toHex8String(),
        },
      })
    }
  }
}

const getProjectPrimary = (project: ProjectType) => {
  if (!project) return

  const meta = project.meta && typeof project.meta === 'string' ? JSON.parse(project.meta) : project.meta || {}

  return meta.theme?.primaryColor || themeV2Colors['royal-blue'].DEFAULT
}

const customRow = (record: ProjectType) => ({
  onClick: async () => {
    await navigateTo(`/nc/${record.id}`)

    $e('a:project:open')
  },
  class: ['group'],
})

onBeforeMount(loadProjects)

const { copy } = useCopy()

const copyProjectMeta = async () => {
  const aggregatedMetaInfo = await $api.utils.aggregatedMetaInfo()
  copy(JSON.stringify(aggregatedMetaInfo))
  message.info('Copied aggregated project meta to clipboard')
}
</script>

<template>
  <div
    class="relative flex flex-col justify-center gap-2 w-full p-8 md:(bg-white rounded-lg border-1 border-gray-200 shadow)"
    data-testid="projects-container"
  >
    <h1 class="flex items-center justify-center gap-2 leading-8 mb-8 mt-4">
      <span class="text-4xl nc-project-page-title" @dblclick="copyProjectMeta">{{ $t('title.myProject') }}</span>
    </h1>

    <div class="flex flex-wrap gap-2 mb-6">
      <a-input-search
        v-model:value="filterQuery"
        class="max-w-[250px] nc-project-page-search rounded"
        :placeholder="$t('activity.searchProject')"
      />

      <a-tooltip title="Reload projects">
        <div
          class="transition-all duration-200 h-full flex-0 flex items-center group hover:ring active:(ring ring-accent) rounded-full mt-1"
          :class="isLoading ? 'animate-spin ring ring-gray-200' : ''"
        >
          <MdiRefresh
            v-e="['a:project:refresh']"
            class="text-xl text-gray-500 group-hover:text-accent cursor-pointer"
            :class="isLoading ? '!text-primary' : ''"
            data-testid="projects-reload-button"
            @click="loadProjects"
          />
        </div>
      </a-tooltip>

      <div class="flex-1" />

      <a-dropdown v-if="isUIAllowed('projectCreate', true)" :trigger="['click']" overlay-class-name="nc-dropdown-create-project">
        <button class="nc-new-project-menu mt-4 md:mt-0">
          <span class="flex items-center w-full">
            {{ $t('title.newProj') }}
            <MdiMenuDown class="menu-icon" />
          </span>
        </button>

        <template #overlay>
          <a-menu class="!py-0 rounded">
            <a-menu-item>
              <div
                v-e="['c:project:create:xcdb']"
                class="nc-project-menu-item group nc-create-xc-db-project"
                @click="navigateTo('/create')"
              >
                <MdiPlusOutline class="group-hover:text-accent" />

                <div>{{ $t('activity.createProject') }}</div>
              </div>
            </a-menu-item>

            <a-menu-item v-if="appInfo.connectToExternalDB">
              <div
                v-e="['c:project:create:extdb']"
                class="nc-project-menu-item group nc-create-external-db-project"
                @click="navigateTo('/create-external')"
              >
                <MdiDatabaseOutline class="group-hover:text-accent" />

                <div v-html="$t('activity.createProjectExtended.extDB')" />
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <Transition name="layout" mode="out-in">
      <div v-if="isLoading">
        <a-skeleton />
      </div>

      <a-table
        v-else
        :custom-row="customRow"
        :data-source="filteredProjects"
        :pagination="{ position: ['bottomCenter'] }"
        :table-layout="md ? 'auto' : 'fixed'"
      >
        <template #emptyText>
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </template>

        <!-- Title -->
        <a-table-column key="title" :title="$t('general.title')" data-index="title">
          <template #default="{ text, record }">
            <div class="flex items-center">
              <div @click.stop>
                <a-menu class="!border-0 !m-0 !p-0" trigger-sub-menu-action="click">
                  <template v-if="isUIAllowed('projectTheme')">
                    <a-sub-menu key="theme" popup-class-name="custom-color">
                      <template #title>
                        <div
                          class="color-selector"
                          :style="{
                            'background-color': getProjectPrimary(record),
                            'width': '8px',
                            'height': '100%',
                          }"
                        />
                      </template>

                      <template #expandIcon></template>

                      <LazyGeneralColorPicker
                        :model-value="getProjectPrimary(record)"
                        :colors="projectThemeColors"
                        :row-size="9"
                        :advanced="false"
                        @input="handleProjectColor(record.id, $event)"
                      />

                      <a-sub-menu key="pick-primary">
                        <template #title>
                          <div class="nc-project-menu-item group !py-0">
                            <ClarityColorPickerSolid class="group-hover:text-accent" />
                            Custom Color
                          </div>
                        </template>

                        <template #expandIcon></template>

                        <LazyGeneralChromeWrapper @input="handleProjectColor(record.id, $event)" />
                      </a-sub-menu>
                    </a-sub-menu>
                  </template>
                </a-menu>
              </div>
              <div
                class="capitalize color-transition group-hover:text-primary !w-[400px] h-full overflow-hidden overflow-ellipsis whitespace-nowrap pl-2"
              >
                {{ text }}
              </div>
            </div>
          </template>
        </a-table-column>
        <!-- Actions -->

        <a-table-column key="id" :title="$t('labels.actions')" data-index="id">
          <template #default="{ text, record }">
            <div class="flex items-center gap-2">
              <MdiEditOutline v-e="['c:project:edit:rename']" class="nc-action-btn" @click.stop="navigateTo(`/${text}`)" />

              <MdiDeleteOutline
                class="nc-action-btn"
                :data-testid="`delete-project-${record.title}`"
                @click.stop="deleteProject(record)"
              />
            </div>
          </template>
        </a-table-column>
      </a-table>
    </Transition>
  </div>
</template>

<style scoped>
.nc-action-btn {
  @apply text-gray-500 group-hover:text-accent active:(ring ring-accent ring-opacity-100) cursor-pointer p-2 w-[30px] h-[30px] hover:bg-gray-300/50 rounded-full;
}

.nc-new-project-menu {
  @apply cursor-pointer z-1 relative color-transition rounded-md px-3 py-2 text-white;

  &::after {
    @apply ring-opacity-100 rounded-md absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary bg-opacity-100;
    content: '';
    z-index: -1;
  }

  &:hover::after {
    @apply transform scale-110 ring ring-accent;
  }

  &:active::after {
    @apply ring ring-accent;
  }
}

:deep(.ant-table-cell) {
  @apply py-1;
}

:deep(.ant-table-row) {
  @apply cursor-pointer;
}

:deep(.ant-table) {
  @apply min-h-[428px];
}

:deep(.ant-menu-submenu-title) {
  @apply !p-0 !mr-1 !my-0 !h-5;
}

.color-selector:hover {
  filter: brightness(1.5);
}
</style>

<style>
.custom-color .ant-menu-submenu-title {
  height: auto !important;
}
</style>
