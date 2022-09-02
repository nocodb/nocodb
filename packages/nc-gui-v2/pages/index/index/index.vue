<script lang="ts" setup>
import { Empty, Modal, message } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { Chrome } from '@ckpack/vue-color'
import tinycolor from 'tinycolor2'
import {
  computed,
  definePageMeta,
  extractSdkResponseErrorMsg,
  navigateTo,
  projectThemeColors,
  ref,
  useApi,
  useNuxtApp,
  useSidebar,
  useUIPermission,
} from '#imports'

definePageMeta({
  title: 'title.myProject',
})

const { $api, $e } = useNuxtApp()

const { api, isLoading } = useApi()

const { isUIAllowed } = useUIPermission()

useSidebar({ hasSidebar: true, isOpen: true })

const filterQuery = ref('')

const projects = ref<ProjectType[]>()

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

await loadProjects()

const themePrimaryColors = $ref(
  (() => {
    const colors: Record<string, any> = {}
    for (const project of projects?.value || []) {
      if (project?.id) {
        try {
          const projectMeta = typeof project.meta === 'string' ? JSON.parse(project.meta) : project.meta
          colors[project.id] = tinycolor(projectMeta?.theme?.primaryColor).isValid()
            ? projectMeta?.theme?.primaryColor
            : themeV2Colors['royal-blue'].DEFAULT
        } catch (e) {
          colors[project.id] = themeV2Colors['royal-blue'].DEFAULT
        }
      }
    }
    return colors
  })(),
)

const oldPrimaryColors = ref({ ...themePrimaryColors })

watch(themePrimaryColors, async (nextColors) => {
  for (const [projectId, nextColor] of Object.entries(nextColors)) {
    if (oldPrimaryColors.value[projectId] === nextColor) continue
    const hexColor = nextColor.hex8 ? nextColor.hex8 : nextColor
    const tcolor = tinycolor(hexColor)
    if (tcolor) {
      const complement = tcolor.complement()
      const project: ProjectType = await $api.project.read(projectId)
      const meta = project?.meta && typeof project.meta === 'string' ? JSON.parse(project.meta) : project.meta || {}
      await $api.project.update(projectId, {
        color: hexColor,
        meta: JSON.stringify({
          ...meta,
          theme: {
            primaryColor: hexColor,
            accentColor: complement.toHex8String(),
          },
        }),
      })
    }
  }
  oldPrimaryColors.value = { ...themePrimaryColors }
})
</script>

<template>
  <div class="bg-white relative flex flex-col justify-center gap-2 w-full p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)">
    <general-noco-icon class="color-transition hover:(ring ring-accent)" :class="[isLoading ? 'animated-bg-gradient' : '']" />

    <h1 class="flex items-center justify-center gap-2 leading-8 mb-8 mt-4">
      <!-- My Projects -->
      <span class="text-4xl nc-project-page-title">{{ $t('title.myProject') }}</span>

      <a-tooltip title="Reload projects">
        <span
          class="transition-all duration-200 h-full flex items-center group hover:ring active:(ring ring-accent) rounded-full mt-1"
          :class="isLoading ? 'animate-spin ring ring-gray-200' : ''"
        >
          <MdiRefresh
            v-t="['a:project:refresh']"
            class="text-xl text-gray-500 group-hover:text-accent cursor-pointer"
            :class="isLoading ? '!text-primary' : ''"
            @click="loadProjects"
          />
        </span>
      </a-tooltip>
    </h1>

    <div class="flex mb-6">
      <a-input-search
        v-model:value="filterQuery"
        class="max-w-[250px] nc-project-page-search rounded"
        :placeholder="$t('activity.searchProject')"
      />

      <div class="flex-1" />

      <a-dropdown v-if="isUIAllowed('projectCreate', true)" :trigger="['click']">
        <button class="nc-new-project-menu">
          <span class="flex items-center w-full">
            {{ $t('title.newProj') }}
            <MdiMenuDown class="menu-icon" />
          </span>
        </button>

        <template #overlay>
          <a-menu class="!py-0 rounded">
            <a-menu-item>
              <div
                v-t="['c:project:create:xcdb']"
                class="nc-project-menu-item group nc-create-xc-db-project"
                @click="navigateTo('/create')"
              >
                <MdiPlusOutline class="group-hover:text-accent" />

                <div>{{ $t('activity.createProject') }}</div>
              </div>
            </a-menu-item>

            <a-menu-item>
              <div
                v-t="['c:project:create:extdb']"
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

    <TransitionGroup name="layout" mode="out-in">
      <div v-if="isLoading">
        <a-skeleton />
      </div>

      <a-table
        v-else
        :custom-row="
          (record) => ({
            onClick: () => {
              $e('a:project:open')

              navigateTo(`/nc/${record.id}`)
            },
            class: ['group'],
          })
        "
        :data-source="filteredProjects"
        :pagination="{ position: ['bottomCenter'] }"
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
                            'background-color': themePrimaryColors[record.id].hex8 || themePrimaryColors[record.id],
                            'width': '8px',
                            'height': '100%',
                          }"
                        />
                      </template>

                      <template #expandIcon></template>

                      <GeneralColorPicker
                        v-model="themePrimaryColors[record.id]"
                        :colors="projectThemeColors"
                        :row-size="9"
                        :advanced="false"
                      />
                      <a-sub-menu key="pick-primary">
                        <template #title>
                          <div class="nc-project-menu-item group !py-0">
                            <ClarityColorPickerSolid class="group-hover:text-accent" />
                            Custom Color
                          </div>
                        </template>
                        <template #expandIcon></template>
                        <Chrome v-model="themePrimaryColors[record.id]" />
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
              <MdiEditOutline v-t="['c:project:edit:rename']" class="nc-action-btn" @click.stop="navigateTo(`/${text}`)" />

              <MdiDeleteOutline class="nc-action-btn" @click.stop="deleteProject(record)" />
            </div>
          </template>
        </a-table-column>
      </a-table>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.nc-action-btn {
  @apply text-gray-500 group-hover:text-accent active:(ring ring-accent) cursor-pointer p-2 w-[30px] h-[30px] hover:bg-gray-300/50 rounded-full;
}

.nc-new-project-menu {
  @apply cursor-pointer z-1 relative color-transition rounded-md px-3 py-2 text-white;

  &::after {
    @apply rounded-md absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary bg-opacity-100;
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
