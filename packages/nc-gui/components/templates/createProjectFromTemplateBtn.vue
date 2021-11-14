<template>
  <div>
    <v-menu bottom offset-y>
      <template #activator="{on}">
        <v-btn
          :loading="projectCreation"
          :disabled="projectCreation"
          class="primary"
          x-large
          v-on="on"
        >
          Use template
          <v-icon>mdi-menu-down</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item dense class="py-2" @click="useTemplate('rest')">
          <v-list-item-title>
            <v-icon class="mr-1" :color="textColors[7]">
              mdi-code-json
            </v-icon>
            Create REST Project
          </v-list-item-title>
        </v-list-item>
        <v-list-item dense class="py-2" @click="useTemplate('graphql')">
          <v-list-item-title>
            <v-icon class="mr-1" :color="textColors[3]">
              mdi-graphql
            </v-icon>
            Create GQL Project
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import colors from '~/mixins/colors'

export default {
  name: 'CreateProjectFromTemplateBtn',
  mixins: [colors],
  props: {
    loading: Boolean,
    templateData: Object,
    importData: Object,
    loaderMessage: String,
    progress: Number
  },
  data() {
    return {
      projectCreation: false,
      loaderMessagesIndex: 0,
      loaderMessages: [
        'Setting up new database configs',
        'Inferring database schema',
        'Generating APIs.',
        'Generating APIs..',
        'Generating APIs...',
        'Generating APIs....',
        'Please wait',
        'Please wait.',
        'Please wait..',
        'Please wait...',
        'Please wait..',
        'Please wait.',
        'Please wait',
        'Please wait.',
        'Please wait..',
        'Please wait...',
        'Please wait..',
        'Please wait.',
        'Please wait..',
        'Please wait...'
      ]
    }
  },
  methods: {
    async useTemplate(projectType) {
      // this.$emit('useTemplate', type)

      this.projectCreation = true
      try {
        const interv = setInterval(() => {
          this.loaderMessagesIndex = this.loaderMessagesIndex < this.loaderMessages.length - 1 ? this.loaderMessagesIndex + 1 : 6
          this.$emit('update:loaderMessage', this.loaderMessages[this.loaderMessagesIndex])
        }, 1000)

        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectCreateByWebWithXCDB', {
          title: this.templateData.title,
          projectType,
          template: this.templateData
        }])

        await this.$store.dispatch('project/ActLoadProjectInfo')

        clearInterval(interv)
        if (this.importData) {
          this.$emit('update:loaderMessage', 'Importing excel data to project')
          await this.importDataToProject({ projectId: result.id, projectType, prefix: result.prefix })
        }

        this.$emit('update:loaderMessage', null)

        this.projectReloading = false

        this.$router.push({
          path: `/nc/${result.id}`,
          query: {
            new: 1
          }
        })
      } catch (e) {
        console.log(e)
        this.$toast.error(e.message).goAway(3000)
      }
      this.projectCreation = false
    },
    async importDataToProject({ projectId, projectType, prefix = '' }) {
      // this.$store.commit('project/MutProjectId', projectId)
      this.$ncApis.setProjectId(projectId)

      let total = 0; let progress = 0
      await Promise.all(Object.entries(this.importData).map(async([table, data]) => {
        await this.$store.dispatch('meta/ActLoadMeta', {
          tn: `${prefix}${table}`, project_id: projectId
        })

        // todo: get table name properly
        const api = this.$ncApis.get({
          table: `${prefix}${table}`,
          type: projectType
        })
        total += data.length
        for (let i = 0; i < data.length; i += 500) {
          this.$emit('update:loaderMessage', `Importing data : ${progress}/${total}`)
          this.$emit('update:progress', Math.round(progress && 100 * progress / total))
          const batchData = data.slice(i, i + 500)
          await api.insertBulk(batchData)
          progress += batchData.length
        }

        this.$emit('update:progress', null)
      }))
    }
  }

}
</script>

<style scoped>

</style>
