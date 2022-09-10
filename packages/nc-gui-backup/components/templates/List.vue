<template>
  <v-container v-if="newEditor || !modal || selectedId === null" class="py-0">
    <div class="d-flex h-100">
      <v-navigation-drawer permanent height="100% ">
        <categories
          ref="cat"
          v-model="category"
          :counter.sync="counter"
          @input="newEditor = false"
          @showTemplateEditor="newEditor = true"
        />
      </v-navigation-drawer>
      <template-editor
        v-if="newEditor"
        :project-template.sync="projectTemplate"
        style="width: 100%; height: 100%"
        @saved="onSaved"
      />
      <v-container v-else fluid style="height: 100%; overflow: auto">
        <v-row v-if="templatesLoading">
          <v-col v-for="i in 10" :key="i" sm="8" offset-sm="2" offset-md="0" md="6" lg="4" xl="3">
            <v-skeleton-loader type="card" />
          </v-col>
        </v-row>

        <v-row v-else-if="templateList && templateList.length" class="align-stretch">
          <v-col v-for="(template, i) in templateList" :key="i" sm="8" offset-sm="2" offset-md="0" md="6" lg="4" xl="3">
            <v-card height="100%" class="mx-auto" @click="openTemplate(template.id)">
              <v-img :src="template.image_url" height="50px" :style="{ background: template.image_url }" />

              <v-card-title>
                {{ template.title }}
              </v-card-title>

              <v-card-subtitle>
                <span class="caption">
                  {{ getShortDescription(template.description) }}
                </span>
              </v-card-subtitle>
            </v-card>
          </v-col>
        </v-row>
        <div v-else class="d-flex justify-center mt-10">
          <v-alert class="flex-shrink-1" type="info" outlined dense> No templates found </v-alert>
        </div>
      </v-container>
    </div>
  </v-container>
  <project-template-detailed
    v-else
    :id="selectedId"
    :create-project="createProject"
    :loading="loading"
    :counter="counter"
    :modal="modal"
    :view-mode="counter < 5"
    @saved="onSaved"
    @load-category="
      v => {
        category = v;
        selectedId = null;
      }
    "
    v-on="$listeners"
    @showTemplateEditor="newEditor = true"
  />
</template>

<script>
// import templateList from './templates.list'
import ProjectTemplateDetailed from '~/components/templates/Detailed';
import Categories from '~/components/templates/Categories';
import TemplateEditor from '~/components/templates/Editor';

export default {
  name: 'ProjectTemplates',
  components: { TemplateEditor, Categories, ProjectTemplateDetailed },
  props: {
    modal: Boolean,
    loading: Boolean,
    createProject: Boolean,
  },
  data: () => ({
    templatesLoading: false,
    category: null,
    selectedId: null,
    templateListLoc: [],
    counter: 0,
    newEditor: false,
    projectTemplate: null,
  }),
  computed: {
    templateList() {
      return this.templateListLoc.filter(t => !this.category || t.category === this.category);
    },
  },
  created() {
    this.loadTemplates();
  },
  methods: {
    async loadTemplates() {
      this.templatesLoading = true;
      try {
        const res = await this.$axios.get(`${process.env.NC_API_URL}/api/v1/nc/templates`);
        this.templateListLoc = res.data.data;
      } catch (e) {
        console.log(e);
      }
      this.templatesLoading = false;
    },
    getShortDescription(str) {
      if (!str || str.length < 200) {
        return str;
      }
      return `${str.slice(0, 200)}...`;
    },
    openTemplate(id) {
      if (this.modal) {
        this.selectedId = id;
      } else {
        this.$router.push(`/project/templates/${id}`);
      }
    },
    async onSaved() {
      await this.loadTemplates();
      if (this.$refs.cat) {
        await this.$refs.cat.loadCategories();
      }
    },
  },
};
</script>

<style scoped>
/deep/ .v-list-item {
  min-height: 30px;
}
</style>
