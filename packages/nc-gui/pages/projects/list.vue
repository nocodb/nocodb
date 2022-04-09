<template>
  <div
    class="d-flex "
    style="height:calc(100vh - 52px)"
  >
    <div
      style="width: 300px"
      class="h-100"
    >
      <project-list-nav-drawer :active-page.sync="activePage" />
    </div>
    <v-container fluid class="flex-grow-1 py-9 px-15 h-100" style="overflow-y: auto">
      <div class="d-flex">
        <h2 class="display-1 ml-5 mb-7 font-weight-medium textColor--text text--lighten-2 flex-grow-1">
          {{ activePage }}
        </h2>

        <div class="">
          <create-new-project-btn />
        </div>
      </div>
      <v-divider class="mb-3" />
      <project-item-list v-if="projectList && projectList.length" :count="count" :project-list="projectList" @deleted="loadProjectList" />
      <empty-project-list-placeholder v-else />
    </v-container>
  </div>
</template>

<script>

import CreateNewProjectBtn from '~/components/projectList/createNewProjectBtn'
import ProjectItemList from '~/components/projectList/projectItemList'
import ProjectListNavDrawer from '~/components/projectList/projectListNavDrawer'
import EmptyProjectListPlaceholder from '~/components/projectList/emptyProjectListPlaceholder'

export default {
  name: 'List',
  components: { EmptyProjectListPlaceholder, ProjectListNavDrawer, ProjectItemList, CreateNewProjectBtn },
  data: () => ({
    projectList: null,
    activePage: null,
    count: null,
    query: ''
  }),
  mounted() {
    this.loadProjectList()
  },
  created() {
    this.$nuxt.$on('projectFilter', (v) => { this.query = v })
  },
  beforeDestroy() {
    this.$nuxt.$off('projectFilter')
  },
  methods: {
    async loadProjectList() {
      const { list, pageInfo } = await this.$api.project.list({
        query: this.query,
        limit: 25
      })
      this.projectList = list
      this.count = pageInfo.totalRows
    }
  }
}
</script>

<style scoped>

</style>
