<template>
  <div class="d-flex align-center">
    <span v-if="!hideLabel" v-ripple class="caption font-weight-bold pointer" @click="templatesModal = true"
      >Templates</span
    >
    <v-dialog v-if="templatesModal" v-model="templatesModal">
      <v-card height="90vh">
        <project-templates
          :create-project="createProject"
          style="height: 90vh"
          modal
          :loading="loading"
          :project-template.sync="templateData"
          @import="importTemplate"
        />
      </v-card>
    </v-dialog>

    <v-overlay :value="projectCreation" z-index="99999" opacity=".9">
      <div class="d-flex flex-column align-center">
        <v-progress-circular indeterminate size="100" width="15" class="mb-10" />
        <span class="title">{{ loaderMessages[loaderMessagesIndex] }}</span>
      </div>
    </v-overlay>
  </div>
</template>

<script>
import ProjectTemplates from '~/components/templates/List';

export default {
  name: 'TemplatesModal',
  components: { ProjectTemplates },
  props: {
    hideLabel: Boolean,
    value: Boolean,
    createProject: Boolean,
  },
  data: () => ({
    templateData: null,
    loading: false,
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
      'Please wait...',
    ],
  }),
  computed: {
    templatesModal: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
  },
  methods: {
    async importTemplate(template, projectType) {
      if (this.createProject) {
        this.projectCreation = true;
        try {
          const interv = setInterval(() => {
            this.loaderMessagesIndex =
              this.loaderMessagesIndex < this.loaderMessages.length - 1 ? this.loaderMessagesIndex + 1 : 6;
          }, 1000);

          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            null,
            'projectCreateByWebWithXCDB',
            {
              title: template.title,
              projectType,
              template,
            },
          ]);

          await this.$store.dispatch('project/ActLoadProjectInfo');

          clearInterval(interv);

          this.projectReloading = false;

          if (
            this.$store.state.project.appInfo.firstUser ||
            this.$store.state.project.appInfo.authType === 'masterKey'
          ) {
            return this.$router.push({
              path: '/user/authentication/signup',
            });
          }

          this.$router.push({
            path: `/nc/${result.id}`,
            query: {
              new: 1,
            },
          });
        } catch (e) {
          this.$toast.error(e.message).goAway(3000);
        }
        this.projectCreation = false;
      } else {
        try {
          const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            {
              // todo: extract based on active
              dbAlias: 'db', // this.nodes.dbAlias,
              env: '_noco',
            },
            'xcModelsCreateFromTemplate',
            {
              template,
            },
          ]);

          if (res && res.tables && res.tables.length) {
            this.$toast.success(`Imported ${res.tables.length} tables successfully`).goAway(3000);
          } else {
            this.$toast.success('Template imported successfully').goAway(3000);
          }
          this.templatesModal = false;
        } catch (e) {
          this.$toast.error(e.message).goAway(3000);
        }
      }
    },
  },
};
</script>

<style scoped></style>
