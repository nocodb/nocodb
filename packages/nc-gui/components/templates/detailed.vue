<template>
  <v-container class="py-0">
    <div class="d-flex">
      <v-navigation-drawer permanent height="calc(100vh - 40px)">
        <categories
          ref="cat"
          :counter.sync="counter"
          @showTemplateEditor="$emit('showTemplateEditor')"
          @input="v => $emit('load-category', v)"
        />
      </v-navigation-drawer>
      <v-container v-if="templateData" fluid style="height: calc(100vh - 40px ); overflow: auto">
        <v-img
          :src="templateData.image_url"
          height="200px"
          :style="{ background: templateData.image_url }"
        />
        <div class="d-flex align-center mt-10">
          <h2 class="display-2 font-weight-bold my-0 flex-grow-1">
            {{ templateData.title }}
          </h2>
          <v-btn class="primary" x-large @click="useTemplate">
            Use template
          </v-btn>
        </div>
        <p class="caption mt-10">
          {{ templateData.description }}
        </p>

        <templat-editor
          :id="templateId"
          :view-mode="$store.state.templateE < 5 && viewMode"
          :template-data.sync="templateData"
          @saved="onSaved"
        />
      </v-container>
    </div>
  </v-container>
</template>

<script>
import TemplatEditor from '~/components/templates/editor'
import Categories from '~/components/templates/categories'

export default {
  name: 'ProjectTemplateDetailed',
  components: { Categories, TemplatEditor },
  props: {
    modal: Boolean,
    viewMode: Boolean,
    id: [String, Number]

  },
  data: () => ({ templateData: null, counter: 0 }),
  computed: {
    templateId() {
      return this.modal ? this.id : this.$route.params.id
    }
  },
  mounted() {
    this.loadTemplateData()
  },
  methods: {
    async loadTemplateData() {
      try {
        const res = await this.$axios.get(`${process.env.NC_API_URL}/api/v1/nc/templates/${this.templateId}`)
        const data = res.data
        this.templateData = JSON.parse(data.template)
      } catch (e) {
        console.log(e)
      }
    },
    useTemplate() {
      if (this.modal) {
        this.$emit('import', this.templateData)
      }
    },
    async onSaved() {
      await this.loadTemplateData()
      if (this.$refs.cat) {
        await this.$refs.cat.loadCategories()
      }
      this.$emit('saved')
    }
  }
}
</script>

<style scoped>
/deep/ .v-list-item {
  min-height: 30px;
}
</style>
