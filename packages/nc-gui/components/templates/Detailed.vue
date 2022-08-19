<template>
  <v-container class="py-0">
    <div class="d-flex h-100">
      <v-navigation-drawer permanent height="100%">
        <categories
          ref="cat"
          :counter.sync="counter"
          @showTemplateEditor="$emit('showTemplateEditor')"
          @input="v => $emit('load-category', v)"
        />
      </v-navigation-drawer>
      <v-container fluid style="height: 100%; overflow: auto">
        <template v-if="loadingTemplate">
          <v-skeleton-loader type="image" />
          <div class="d-flex mt-2 align-center">
            <v-skeleton-loader style="width: 200px" type="card-heading" />
            <v-spacer />
            <v-skeleton-loader type="button" />
          </div>
          <v-skeleton-loader type="paragraph" class="mt-2" />
          <v-skeleton-loader type="table" class="mt-2" />
        </template>
        <template v-else-if="templateData">
          <v-img :src="templateData.image_url" height="200px" :style="{ background: templateData.image_url }" />
          <div class="d-flex align-center mt-10">
            <h2 class="display-2 font-weight-bold my-0 flex-grow-1">
              {{ templateData.title }}
            </h2>
            <v-menu v-if="createProject" bottom offset-y>
              <template #activator="{ on }">
                <v-btn :loading="loading" :disabled="loading" class="primary" x-large v-on="on">
                  Use template
                  <v-icon>mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item dense class="py-2" @click="useTemplate('rest')">
                  <v-list-item-title>
                    <v-icon class="mr-1" :color="textColors[7]"> mdi-code-json </v-icon>
                    Create REST Project
                  </v-list-item-title>
                </v-list-item>
                <v-list-item dense class="py-2" @click="useTemplate('graphql')">
                  <v-list-item-title>
                    <v-icon class="mr-1" :color="textColors[3]"> mdi-graphql </v-icon>
                    Create GQL Project
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
            <v-btn v-else :loading="loading" :disabled="loading" class="primary" x-large @click="useTemplate">
              Use template
            </v-btn>
          </div>
          <p class="caption mt-10">
            {{ templateData.description }}
          </p>

          <templat-editor
            :id="templateId"
            ref="editor"
            :view-mode="$store.state.templateE < 4 && viewMode"
            :project-template.sync="templateData"
            @saved="onSaved"
          />
        </template>
      </v-container>
    </div>
  </v-container>
</template>

<script>
import TemplatEditor from '~/components/templates/Editor';
import Categories from '~/components/templates/Categories';
import colors from '~/mixins/colors';

export default {
  name: 'ProjectTemplateDetailed',
  components: { Categories, TemplatEditor },
  mixins: [colors],
  props: {
    loading: Boolean,
    modal: Boolean,
    viewMode: Boolean,
    id: [String, Number],
    createProject: Boolean,
  },
  data: () => ({ templateData: null, counter: 0, loadingTemplate: false }),
  computed: {
    templateId() {
      return this.modal ? this.id : this.$route.params.id;
    },
  },
  mounted() {
    this.loadTemplateData();
  },
  methods: {
    async loadTemplateData() {
      this.loadingTemplate = true;
      try {
        const res = await this.$axios.get(`${process.env.NC_API_URL}/api/v1/nc/templates/${this.templateId}`);
        const data = res.data;
        this.templateData = JSON.parse(data.template);
        await this.$nextTick();
        if (this.$refs.editor) {
          this.$refs.editor.parseAndLoadTemplate();
        }
      } catch (e) {
        console.log(e);
      }
      this.loadingTemplate = false;
    },
    useTemplate(apiType) {
      if (this.modal) {
        this.$emit('import', this.templateData, apiType);
      }
    },
    async onSaved() {
      await this.loadTemplateData();
      if (this.$refs.cat) {
        await this.$refs.cat.loadCategories();
      }
      this.$emit('saved');
    },
  },
};
</script>

<style scoped>
/deep/ .v-list-item {
  min-height: 30px;
}
</style>
