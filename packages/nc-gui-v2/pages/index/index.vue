<script lang="ts" setup>
import { Modal, message } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import {
  computed,
  extractSdkResponseErrorMsg,
  navigateTo,
  onMounted,
  ref,
  useApi,
  useNuxtApp,
  useSidebar,
  useUIPermission,
} from '#imports'

const { $e } = useNuxtApp()

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
        return projects.value?.splice(projects.value.indexOf(project), 1)
      } catch (e: any) {
        return message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <NuxtLayout>
    <div class="flex flex-col md:flex-row flex-wrap gap-6 py-6 px-12">
      <div class="hidden xl:(block)">
        <GeneralSponsors />
      </div>

      <div class="min-w-2/4 flex-auto">
        <a-card :loading="isLoading" class="!rounded-lg shadow">
          <h1 class="text-center text-4xl p-2 nc-project-page-title flex items-center justify-center gap-2 text-gray-600">
            <!-- My Projects -->
            <b>{{ $t('title.myProject') }}</b>

            <MdiRefresh
              v-t="['a:project:refresh']"
              class="text-sm text-gray-500 hover:text-primary mt-1 cursor-pointer"
              @click="loadProjects"
            />
          </h1>

          <div class="order-1 flex mb-6">
            <a-input-search
              v-model:value="filterQuery"
              class="max-w-[200px] nc-project-page-search"
              :placeholder="$t('activity.searchProject')"
            />

            <div class="flex-grow" />

            <a-dropdown v-if="isUIAllowed('projectCreate', true)" @click.stop>
              <a-button class="nc-new-project-menu !shadow">
                <div class="flex align-center">
                  {{ $t('title.newProj') }}
                  <MdiMenuDown class="menu-icon" />
                </div>
              </a-button>

              <template #overlay>
                <a-menu>
                  <div
                    v-t="['c:project:create:xcdb']"
                    class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2 nc-create-xc-db-project"
                    @click="navigateTo('/project/create')"
                  >
                    <MdiPlus class="col-span-2 mr-1 mt-[1px] text-primary text-lg" />

                    <div class="col-span-10 text-sm xl:text-md">{{ $t('activity.createProject') }}</div>
                  </div>

                  <div
                    v-t="['c:project:create:extdb']"
                    class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2 nc-create-external-db-project"
                    @click="navigateTo('/project/create-external')"
                  >
                    <MdiDatabaseOutline class="col-span-2 mr-1 mt-[1px] text-green-500 text-lg" />

                    <div class="col-span-10 text-sm xl:text-md" v-html="$t('activity.createProjectExtended.extDB')" />
                  </div>
                </a-menu>
              </template>
            </a-dropdown>
          </div>

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
              })
            "
            :data-source="filteredProjects"
            :pagination="{ position: ['bottomCenter'] }"
          >
            <!-- Title -->
            <a-table-column key="title" :title="$t('general.title')" data-index="title">
              <template #default="{ text }">
                <div
                  class="capitalize !w-[400px] overflow-hidden overflow-ellipsis whitespace-nowrap nc-project-row"
                  :title="text"
                >
                  {{ text }}
                </div>
              </template>
            </a-table-column>
            <!-- Actions -->
            <a-table-column key="id" :title="$t('labels.actions')" data-index="id">
              <template #default="{ text, record }">
                <div class="flex align-center">
                  <MdiEditOutline
                    v-t="['c:project:edit:rename']"
                    class="nc-action-btn"
                    @click.stop="navigateTo(`/project/${text}`)"
                  />
                  <MdiDeleteOutline class="nc-action-btn" @click.stop="deleteProject(record)" />
                </div>
              </template>
            </a-table-column>
          </a-table>
        </a-card>
      </div>

      <div class="flex gap-6 md:block">
        <GeneralSocialCard />

        <div class="block mt-0 md:(!mt-6) xl:hidden">
          <GeneralSponsors />
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.nc-action-btn {
  @apply text-gray-500 hover:text-primary mr-2 cursor-pointer p-2 w-[30px] h-[30px] hover:bg-gray-300/50 rounded-full;
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
</style>
