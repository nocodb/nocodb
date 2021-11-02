<template>
  <div>
    <span class="caption font-weight-bold" @click="templatesModal = true">Templates</span>
    <v-dialog v-model="templatesModal" v-if="templatesModal">
      <v-card>
        <project-templates modal @import="importTemplate" />
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
    templatesModal: false
  }),
  methods: {
    importTemplate(template) {
      try {
        this.$store.dispatch('sqlMgr/ActSqlOp', [{
          // todo: extract based on active
          dbAlias: 'db', // this.nodes.dbAlias,
          env: '_noco'
        }, 'xcModelsCreateFromTemplate', {
          template
        }])
        this.$toast.success('Template imported successfully').goAway(3000);
        this.templatesModal = false;
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
