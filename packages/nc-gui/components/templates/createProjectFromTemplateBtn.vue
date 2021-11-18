<template>
  <div>
    <v-menu bottom offset-y>
      <template #activator="{on}">
        <v-btn
          :loading="projectCreation"
          :disabled="projectCreation"
          class="primary nc-btn-use-template"
          x-large
          v-on="on"
        >
          <slot>Use template</slot>
          <v-icon>mdi-menu-down</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item dense class="py-2" @click="useTemplate('rest')">
          <v-list-item-title>
            <v-icon class="mr-1" :color="textColors[7]">
              mdi-code-json
            </v-icon>
            {{ createRestText }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item dense class="py-2" @click="useTemplate('graphql')">
          <v-list-item-title>
            <v-icon class="mr-1" :color="textColors[3]">
              mdi-graphql
            </v-icon>
            {{ createGqlText }}
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
    templateData: [Array, Object],
    importData: [Array, Object],
    valid: {
      default: true,
      type: Boolean
    },
    validationErrorMsg: {
      default: 'Please fill all the required values',
      type: String
    },
    createGqlText: {
      default: 'Create GQL Project',
      type: String
    },
    createRestText: {
      default: 'Create REST Project',
      type: String
    }
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
      if (!this.valid) {
        return this.$toast.error(this.validationErrorMsg).goAway(3000)
      }

      // this.$emit('useTemplate', type)

      this.projectCreation = true
      try {
        const interv = setInterval(() => {
          this.loaderMessagesIndex = this.loaderMessagesIndex < this.loaderMessages.length - 1 ? this.loaderMessagesIndex + 1 : 6
          this.$store.commit('loader/MutMessage', this.loaderMessages[this.loaderMessagesIndex])
        }, 1000)

        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectCreateByWebWithXCDB', {
          title: this.templateData.title,
          projectType,
          template: this.templateData
        }])

        await this.$store.dispatch('project/ActLoadProjectInfo')

        clearInterval(interv)
        if (this.importData) {
          this.$store.commit('loader/MutMessage', 'Importing excel data to project')
          await this.importDataToProject({ projectId: result.id, projectType, prefix: result.prefix })
        }
        this.$store.commit('loader/MutMessage', null)

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

      let total = 0
      let progress = 0

      await Promise.all(Object.entries(this.importData).map(v => (async([table, data]) => {
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
          this.$store.commit('loader/MutMessage', `Importing data : ${progress}/${total}`)
          this.$store.commit('loader/MutProgress', Math.round(progress && 100 * progress / total))
          const batchData = data.slice(i, i + 500)
          await api.insertBulk(batchData)
          progress += batchData.length
        }
        this.$store.commit('loader/MutClear')
      })(v)))
    }
  }

}
</script>

<style scoped>

</style>
