<template>
  <div v-if="projectList &&projectList.length" class="nc-project-item-container d-flex d-100">
    <project-item
      v-for="(project,i) in projectList"
      :key="project.id"
      :index="i"
      :project="project"
      :count="count"
      @deleted="$emit('deleted', project)"
    />

    <div class="pointer nc-project-item nc-project-item elevation-0 d-flex align-center justify-center flex-column">
      <create-new-project-btn>
        <template #default="{on}">
          <div
            class="nc-project-thumbnail nc-add-project text-uppercase d-flex align-center justify-center grey lighten-2 "
            v-on="on"
          >
            +
          </div>
        </template>
      </create-new-project-btn>
      <div class="text-center pa-2 nc-project-title body-2 font-weight-medium ">
        Add project
      </div>
    </div>
  </div>
</template>

<script>
import CreateNewProjectBtn from '~/components/projectList/createNewProjectBtn'
import ProjectItem from '~/components/projectList/projectItem'

export default {
  name: 'ProjectItemList',
  components: { ProjectItem, CreateNewProjectBtn },
  props: { projectList: Array, count: Number }
}
</script>

<style scoped>
.nc-project-item-container {
  flex-wrap: wrap;
  position: relative;
}
/deep/ .nc-project-item {
  width: 150px;
  align-items: center;
}

/deep/ .nc-project-thumbnail {
  height: 100px;
  width: 100px;
  font-size: 50px;
  color: white;
  font-weight: bold;
  border-radius: 4px;
  margin-inside: auto;
  position: relative;
}

/deep/ .nc-project-thumbnail:hover {
  background-image: linear-gradient(#0002, #0002);
}

</style>
