<template>
  <v-container v-if="newEditor || !modal || selectedId === null " class="py-0">
    <div class="d-flex">
      <v-navigation-drawer height="calc(100vh - 40px)">
        <categories
          ref="cat"
          v-model="category"
          :counter.sync="counter"
          @input="newEditor=false"
          @showTemplateEditor="newEditor = true"
        />
      </v-navigation-drawer>
      <template-editor v-if="newEditor" style="width:100%" @saved="onSaved" />
      <v-container v-else fluid style="height: calc(100vh - 40px); overflow: auto">
        <v-row
          v-if="templateList && templateList.length"
          class="align-stretch"
        >
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
              height="100%"
              class="mx-auto"
            >
              <v-img
                :src="template.image_url || `https://picsum.photos/200/300?${template.id}`"
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
          <v-alert class="flex-shrink-1" type="info" outlined dense>
            No templates found
          </v-alert>
        </div>
      </v-container>
    </div>
  </v-container>
  <project-template-detailed
    v-else
    :id="selectedId"
    :counter="counter"
    :modal="modal"
    :view-mode="counter < 5"
    @saved="onSaved"
    @load-category="v =>{ category = v; selectedId = null }"
    v-on="$listeners"
  />
</template>

<script>

// import templateList from './templates.list'
import ProjectTemplateDetailed from '~/components/templates/detailed'
import Categories from '~/components/templates/categories'
import TemplateEditor from '~/components/templates/editor'

export default {
  name: 'ProjectTemplates',
  components: { TemplateEditor, Categories, ProjectTemplateDetailed },
  props: {
    modal: Boolean
  },
  data: () => ({
    category: null,
    selectedId: null,
    templateListLoc: [],
    counter: 0,
    newEditor: false
  }),
  computed: {
    templateList() {
      return this.templateListLoc.filter(t => !this.category || t.category === this.category)
    }
  },
  created() {
    this.loadTemplates()
  },
  methods: {
    async loadTemplates() {
      try {
        const res = await this.$axios.get(`${process.env.NC_API_URL}/api/v1/nc/templates`)
        this.templateListLoc = res.data.data
      } catch (e) {
        console.log(e)
      }
    },
    getShortDescription(str) {
      if (str.length < 200) {
        return str
      }
      return `${str.slice(0, 200)}...`
    },
    openTemplate(id) {
      if (this.modal) {
        this.selectedId = id
      } else {
        this.$router.push(`/project/templates/${id}`)
      }
    },
    async onSaved() {
      await this.loadTemplates()
      if (this.$refs.cat) {
        await this.$refs.cat.loadCategories()
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
