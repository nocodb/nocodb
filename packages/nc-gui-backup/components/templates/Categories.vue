<template>
  <div class="">
    <div v-if="loading" class="pr-4">
      <v-skeleton-loader type="text" class="mx-2 mt-4 mr-14" />
      <v-skeleton-loader type="text@10" class="mx-2 mt-4" />
      <v-skeleton-loader type="text@2" class="mx-2 mt-4 mr-14" />
    </div>
    <template v-else>
      <v-list dense>
        <v-list-item dense>
          <v-list-item-subtitle>
            <span class="caption" @dblclick="counterLoc++">Categories</span>
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item-group v-model="category">
          <v-list-item v-for="c in categories" :key="c.category" :value="c.category" dense>
            <v-list-item-title>
              <span :class="{ 'font-weight-black': category === c.category }" class="body-1">
                {{ c.category }}
              </span>
              <span class="grey--text">({{ c.count }})</span>
            </v-list-item-title>
          </v-list-item>
        </v-list-item-group>
      </v-list>
      <!--      v-if="counter > 4"-->
      <v-btn class="ml-4" color="grey" small outlined @click="showTemplateEditor">
        <v-icon class="mr-1" small> mdi-plus </v-icon> New template
      </v-btn>

      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            class="ml-4 mt-4"
            color="grey"
            small
            outlined
            v-on="on"
            @click="$toast.info('Happy hacking!').goAway(3000)"
          >
            <v-icon small class="mr-1"> mdi-file-excel-outline </v-icon>
            Import
          </v-btn>
        </template>
        <span class="caption">Create templates from multiple Excel files</span>
      </v-tooltip>

      <v-text-field
        v-if="$store.state.templateE > 3"
        v-model="t"
        autocomplete="new-password"
        name="nc"
        outlined
        dense
        :full-width="false"
        style="width: 135px"
        type="password"
        class="caption mt-4 ml-1 mr-3 ml-4"
        hide-details
      />
    </template>
  </div>
</template>

<script>
// import categories from './templates.categories'
export default {
  name: 'Categories',
  props: { value: String, counter: Number },
  data: () => ({
    categories: [],
    loading: false,
  }),
  computed: {
    counterLoc: {
      get() {
        return this.$store.state.templateE;
      },
      set(c) {
        this.$store.commit('mutTemplateE', c);
      },
    },
    category: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
    t: {
      get() {
        return this.$store.state.template;
      },
      set(t) {
        this.$store.commit('mutTemplate', t);
      },
    },
  },
  created() {
    this.loadCategories();
  },
  methods: {
    async loadCategories() {
      this.loading = true;
      try {
        const res = await this.$axios.get(`${process.env.NC_API_URL}/api/v1/nc/templates/categories`);
        this.categories = res.data;
      } catch (e) {
        console.log(e);
      }
      this.loading = false;
    },
    showTemplateEditor() {
      this.$emit('showTemplateEditor');
    },
  },
};
</script>

<style scoped></style>
