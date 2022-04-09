<template>
  <div
    class=" nc-project-item elevation-0 d-flex align-center justify-center flex-column py-5"
  >
    <div
      class="nc-project-thumbnail pointer text-uppercase d-flex align-center justify-center"
      :style="{backgroundColor:getTextColor(index)}"
      @click="openProject(project)"
    >
      {{ project.title.split(' ').map(w => w[0]).slice(0, 2).join('') }}

      <v-icon class="nc-project-star-icon" small color="white" @click.stop>
        mdi-star-outline
      </v-icon>

      <v-menu bottom offset-y>
        <template #activator="{on}">
          <v-icon class="nc-project-option-menu-icon" color="white" v-on="on" @click.stop>
            mdi-menu-down
          </v-icon>
        </template>
        <v-list dense>
          <v-list-item @click="deleteProject(project)">
            <v-list-item-title>
              <v-icon small color="red">
                mdi-delete-outline
              </v-icon>
              Delete
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>
    <div class="text-center pa-2 nc-project-title body-2 font-weight-medium ">
      {{ project.title }}
    </div>

    <dlg-label-submit-cancel
      v-if="dialogShow"
      type="primary"
      :actions-mtd="confirmAction"
      :dialog-show="dialogShow"
      :heading="confirmMessage"
    />
  </div>
</template>

<script>
import colors from '~/mixins/colors'
import DlgLabelSubmitCancel from '~/components/utils/dlgLabelSubmitCancel'

export default {
  name: 'ProjectItem',
  components: { DlgLabelSubmitCancel },
  mixins: [colors],
  props: {
    project: Object,
    index: Number,
    count: Number
  },
  data: () => ({
    dialogShow: false,
    confirmAction: null,
    confirmMessage: ''
  }),
  methods: {
    async openProject(project) {
      await this.$router.push({
        path: `/nc/${project.id}`
      })
      this.$tele.emit(`project:open:${this.count}`)
    },
    async deleteProject(project) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to delete the project?'
      this.$tele.emit('project:delete:trigger')
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.$set(project, 'status', 'deleting')
          const projectId = project.id
          this.statusUpdatingProjectId = projectId
          this.projectStatusUpdating = true
          try {
            await this.$api.project.delete(projectId)
            this.$toast
              .success(`Project '${project.title}' deleted successfully`)
              .goAway(3000)
          } catch (e) {
            this.$toast
              .error(`Project '${project.title}' deleting failed`)
              .goAway(3000)
          }
          this.$emit('deleted')
          this.projectStatusUpdating = false

          this.dialogShow = false
          this.$tele.emit('project:delete:submit')
        }
      }
    }
  }
}
</script>

<style scoped>
.nc-project-option-menu-icon,.nc-project-star-icon {
  position: absolute;
  opacity: 0;
  transition: .3s opacity;
}
.nc-project-star-icon{
  top:8px;
  right: 10px;
}
.nc-project-option-menu-icon{
  bottom: 5px;
  right: 5px;
}
.nc-project-thumbnail:hover .nc-project-option-menu-icon,.nc-project-thumbnail:hover .nc-project-star-icon{
  opacity: 1;
}

/deep/ .nc-project-title.nc-add-project {
  font-size: 60px;
}
</style>
