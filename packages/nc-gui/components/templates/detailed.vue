<template>
  <v-container class="py-0">
    <div class="d-flex">
      <v-navigation-drawer height="calc(100vh - 40px)">
        <categories @input="v => $emit('load-category', v)"/>
      </v-navigation-drawer>
      <v-container v-if="templateData" fluid style="height: calc(100vh - 40px ); overflow: auto">
        <v-img
          :src="templateData.thumbnail"
          height="200px"
        />
        <div class="d-flex align-center mt-10">
          <h2 class="display-2 font-weight-bold my-0 flex-grow-1">
            {{ templateData.title }}
          </h2>
          <v-btn class="primary" x-large @click="useTemplate">Use template</v-btn>
        </div>
        <p class="caption mt-10">
          {{ templateData.description }}
        </p>


        <templat-editor view-mode :templateData="templateData"></templat-editor>

      </v-container>
    </div>
  </v-container>
</template>

<script>
import categories from '~/components/templates/templates.categories'
import TemplatEditor from "~/components/templates/editor";
import Categories from "~/components/templates/categories";

export default {
  name: 'ProjectTemplateDetailed',
  components: {Categories, TemplatEditor},
  props: {
    modal: Boolean, id: [String, Number]
  },
  data: () => ({categories, templateData: null}),
  async mounted() {
    this.templateData = (await import(`./templates.${this.modal ? this.id : this.$route.params.id}`)).default
  }, methods: {
    useTemplate() {
      if (this.modal) {
        this.$emit('import', this.templateData)
      }
    }
  }

}
</script>

<style scoped>
/deep/ .v-list-item {
  min-height: 30px;
}
</style>
