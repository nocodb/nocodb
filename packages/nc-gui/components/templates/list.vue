<template>
  <v-container v-if="!modal || selectedId === null " class="py-0">
    <div class="d-flex">
      <v-navigation-drawer height="calc(100vh - 40px)">
       <categories v-model="category"></categories>
      </v-navigation-drawer>
      <v-container fluid style="height: calc(100vh - 40px ); overflow: auto">
        <v-row
          v-if="templateList && templateList.length">
          <v-col
            v-for="(template,i) in templateList"
            :key="i"
            sm="8"
            offset-sm="2"
            offset-md="0"
            md="6"
            lg="4"
            xl="3"
            @click="openTemplate(template.id)"
          >
            <v-card
              class="mx-auto"
            >
              <v-img
                :src="template.thumbnail"
                height="200px"
              />

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
        <div v-else class="d-flex justify-center mt-10 ">
        <v-alert  class="flex-shrink-1" type="info" outlined dense >
          No templates found
        </v-alert>
        </div>
      </v-container>
    </div>
  </v-container>
  <project-template-detailed v-else @load-category="v =>{ category = v; selectedId = null }" :id="selectedId" :modal="modal" v-on="$listeners" />
</template>

<script>

import templateList from './templates.list'
import ProjectTemplateDetailed from '~/components/templates/detailed'
import Categories from "~/components/templates/categories";

export default {
  name: 'ProjectTemplates',
  components: {Categories, ProjectTemplateDetailed },
  props: {
    modal: Boolean
  },
  data: () => ({
    category: null,
    selectedId: null
  }),
  computed: {
    templateList() {
      return templateList.filter(t => !this.category || t.category === this.category)
    }
  },
  methods: {
    getShortDescription(str) {
      if (str.length < 200) { return str }
      return `${str.slice(0, 200)}...`
    },
    openTemplate(id) {
      if (this.modal) {
        this.selectedId = id
      } else {
        this.$router.push(`/project/templates/${id}`)
      }
    }
  }
}
</script>

<style scoped>
/deep/ .v-list-item{
  min-height: 30px;
}
</style>
