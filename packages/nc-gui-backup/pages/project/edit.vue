<template>
  <div class="main justify-center d-flex" style="min-height: 600px; overflow: auto">
    <v-form ref="form" v-model="valid" @submit.prevent="renameProject">
      <v-card style="width: 530px; margin-top: 100px" class="mx-auto">
        <div
          style="
            position: absolute;
            top: -33px;
            left: -moz-calc(50% - 33px);
            left: -webkit-calc(50% - 33px);
            left: calc(50% - 33px);
            border-radius: 15px;
          "
          class="primary"
        >
          <v-img class="mx-auto" width="66" height="66" :src="require('~/assets/img/icons/512x512-trans.png')" />
        </div>

        <v-container fluid class="pb-10 px-12" style="padding-top: 43px !important">
          <!-- Edit Project -->
          <h1 class="mt-4 mb-4 text-center">
            {{ $t('activity.editProject') }}
          </h1>
          <div class="mx-auto" style="width: 350px">
            <!-- label="Enter Project Name" -->
            <!-- rule text: Required -->
            <v-text-field
              ref="projectTitleInput"
              v-model="projectTitle"
              autofocus
              :full-width="false"
              class="nc-metadb-project-name"
              :label="$t('placeholder.projName')"
              :rules="form.titleValidationRule"
            />
          </div>
          <div class="text-center">
            <v-btn
              v-t="['a:project:edit:rename']"
              class="mt-3"
              large
              :loading="loading"
              color="primary"
              @click="renameProject"
            >
              <v-icon class="mr-1 mt-n1"> mdi-rocket-launch-outline </v-icon>
              <!-- Edit -->
              <span class="mr-1">{{ $t('general.edit') }}</span>
            </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-form>
  </div>
</template>

<script>
import colors from '@/mixins/colors';

export default {
  name: 'EditProject',
  mixins: [colors],
  data: () => ({
    valid: null,
    projectTitle: '',
    loading: false,
    projectType: 'rest',
    form: {
      titleValidationRule: [
        v => !!v || 'Title is required',
        v => (v && v.length <= 50) || 'Project name exceeds 50 characters',
      ],
    },
  }),
  computed: {
    pid() {
      return this.$route.query.projectId;
    },
  },
  async mounted() {
    setTimeout(() => {
      this.$refs.projectTitleInput.$el.querySelector('input').focus();
    }, 100);
    await this.getProject(this.pid);
  },
  methods: {
    async getProject() {
      try {
        const result = await this.$api.project.read(this.pid);
        this.$nextTick(() => {
          this.projectTitle = result.title;
        });
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
      }
    },
    async renameProject() {
      if (this.$refs.form.validate()) {
        this.loading = true;
        try {
          await this.$api.project.update(this.pid, {
            title: this.projectTitle,
          });

          await this.$store.dispatch('project/ActLoadProjectInfo');

          this.projectReloading = false;

          this.$router.push({
            path: `/nc/${this.pid}`,
            query: {
              new: 1,
            },
          });
        } catch (e) {
          this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
        }
        this.loading = false;
      } else {
        this.$toast.error('Invalid Form');
      }
    },
  },
};
</script>

<style scoped>
/deep/ label {
  font-size: 0.75rem;
}

.wrapper {
  border: 2px solid var(--v-backgroundColor-base);
  border-radius: 4px;
}

.main {
  height: calc(100vh - 48px);
}
</style>
