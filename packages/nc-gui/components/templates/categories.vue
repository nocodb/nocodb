<template>
  <div class="h-100">
    <v-list dense>
      <v-list-item dense>
        <v-list-item-subtitle>
          <span class="caption" @click="counterLoc++">Categories</span>
        </v-list-item-subtitle>
      </v-list-item>
      <v-list-item-group v-model="category">
        <v-list-item v-for="c in categories" :key="c.category" :value="c.category" dense>
          <v-list-item-title>
            <span
              :class="{'font-weight-black' : category === c.category } "
            >
              {{
                c.category
              }}
            </span> <span class="grey--text ">({{ c.count }})</span>
          </v-list-item-title>
        </v-list-item>
      </v-list-item-group>
    </v-list>
    <v-btn
      v-if="counter > 4"
      color="primary"
      outlined
      @click="showTemplateEditor"
    >
      Add new template
    </v-btn>
  </div>
</template>

<script>
// import categories from './templates.categories'
export default {
  name: 'Categories',
  props: { value: String, counter: Number },
  data: () => ({
    categories: []
  }),
  computed: {
    category: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    },
    counterLoc: {
      get() {
        return this.counter
      },
      set(v) {
        this.$emit('update:counter', v)
      }
    }
  },
  created() {
    this.loadCategories()
  },
  methods: {
    async loadCategories() {
      try {
        const res = await this.$axios.get(`${process.env.NC_API_URL}/api/v1/nc/templates/categories`)
        this.categories = res.data
      } catch (e) {
        console.log(e)
      }
    },
    showTemplateEditor() {
      this.$emit('showTemplateEditor')
    }
  }
}
</script>

<style scoped>

</style>
