<template>
  <div>
    <span v-ripple class="caption font-weight-bold pointer" @click="templatesModal = true">Templates</span>
    <v-dialog v-if="templatesModal" v-model="templatesModal">
      <v-card height="90vh">
        <project-templates style="height:90vh" modal :loading="loading" @import="importTemplate" />
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import ProjectTemplates from '~/components/templates/list'

export default {
  name: 'TemplatesModal',
  components: { ProjectTemplates },
  data: () => ({
    templatesModal: false,
    loading: false
  }),
  methods: {
    async importTemplate(template) {
      try {
        const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          // todo: extract based on active
          dbAlias: 'db', // this.nodes.dbAlias,
          env: '_noco'
        }, 'xcModelsCreateFromTemplate', {
          template
        }])

        if (res && res.tables && res.tables.length) {
          this.$toast.success(`Imported ${res.tables.length} tables successfully`).goAway(3000)
        } else {
          this.$toast.success('Template imported successfully').goAway(3000)
        }
        this.templatesModal = false
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
