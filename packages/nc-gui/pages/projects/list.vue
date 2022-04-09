<template>
  <div
    class="d-flex "
    style="height:calc(100vh - 52px)"
  >
    <div
      style="width: 300px"
      class="h-100"
    >
      <project-list-nav-drawer :active-page.sync="activePage" @update:activePage="loadProjectList(true)" />
    </div>
    <v-container fluid class="flex-grow-1 py-9 px-15 h-100" style="overflow-y: auto">
      <div class="d-flex">
        <h2 class="display-1 ml-5 mb-7 font-weight-medium textColor--text text--lighten-2 flex-grow-1">
          {{ activePage.title }}
        </h2>

        <div class="">
          <create-new-project-btn />
        </div>
      </div>
      <v-divider class="mb-3" />
      <template v-if="projectList && projectList.length">
        <project-item-list :count="count" :project-list="projectList" style="height:calc(100% - 120px); overflow-y: auto" @deleted="loadProjectList()" />

        <pagination
          v-if="count && count > limit"
          v-model="page"
          :count="count"
          :size="limit"
          @input="loadProjectList()"
        />
      </template>
      <empty-project-list-placeholder v-else />
    </v-container>
  </div>
</template>

<script>

import CreateNewProjectBtn from '~/components/projectList/createNewProjectBtn'
import ProjectItemList from '~/components/projectList/projectItemList'
import ProjectListNavDrawer from '~/components/projectList/projectListNavDrawer'
import EmptyProjectListPlaceholder from '~/components/projectList/emptyProjectListPlaceholder'
import Pagination from '~/components/project/spreadsheet/components/pagination'

export default {
  name: 'List',
  components: { Pagination, EmptyProjectListPlaceholder, ProjectListNavDrawer, ProjectItemList, CreateNewProjectBtn },
  data: () => ({
    projectList: null,
    activePage: {},
    count: 25,
    query: '',
    page: 1,
    limit: 25
  }),
  mounted() {
    this.loadProjectList()
  },
  created() {
    this.$nuxt.$on('projectFilter', (v) => {
      this.query = v
      this.loadProjectList(true)
    })
  },
  beforeDestroy() {
    this.$nuxt.$off('projectFilter')
  },
  methods: {
    async loadProjectList(reset = false) {
      if (reset) {
        this.page = 1
      }
      const query = {
        query: this.query,
        limit: this.limit,
        offset: this.limit * (this.page - 1)
      }

      if (this.activePage && this.activePage.queryParam) {
        query[this.activePage.queryParam] = true
      }

      const { list, pageInfo } = await this.$api.project.list(query)
      this.projectList = list
      this.count = pageInfo.totalRows
    }
  }
}
</script>

<style scoped>

</style>
