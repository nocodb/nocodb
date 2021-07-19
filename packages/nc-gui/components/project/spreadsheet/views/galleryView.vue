<template>
  <v-container fluid>
    <v-row>
      <v-col
        v-for="({row, rowMeta},rowIndex) in data"
        :key="rowIndex"
        class="col-md-4 col-lg-3 col-sm-6 col-12"
      >
        <v-hover v-slot="{hover}">
          <v-card
            :elevation="hover ? 4 : 1"
            @click="$emit('expandForm', {row,rowIndex,rowMeta})"
          >
            <v-carousel
              :continuous="false"
              :cycle="true"
              :show-arrows="false"
              hide-delimiter-background
              delimiter-icon="mdi-minus"
              height="200"
            >
              <v-carousel-item
                v-for="(cover, i) in getCovers(row)"
                :key="i"
              >
                <v-img
                  height="200"
                  :src="cover.url"
                  :alt="cover.title"
                />
              </v-carousel-item>
            </v-carousel>

            <v-card-title
              class="text-capitalize"
              v-text="row[primaryValueColumn]"
            />
          </v-card>
        </v-hover>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'GalleryView',
  props: [
    'nodes',
    'table',
    'showFields',
    'availableColumns',
    'meta',
    'data',
    'primaryValueColumn'
  ],
  computed: {
    attachmentColumn() {
      return this.meta && this.meta.columns && this.meta.columns.find(c => c.uidt === 'Attachment')
    }
  },
  methods: {
    getCovers(row) {
      if (this.attachmentColumn &&
        row[this.attachmentColumn.cn] && row[this.attachmentColumn.cn][0] &&
        row[this.attachmentColumn.cn]) {
        try {
          return JSON.parse(row[this.attachmentColumn.cn])
        } catch (e) {

        }
      }
      return [{ url: 'https://via.placeholder.com/700?text=No%20image%20found' }]
    }
  }
}
</script>

<style scoped>

</style>
