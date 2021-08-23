<template>
  <v-container fluid>
    <v-row class="align-stretch">
      <v-col
        v-for="({row, rowMeta},rowIndex) in data"
        :key="rowIndex"
        class="col-md-4 col-lg-3 col-sm-6 col-12"
      >
        <v-hover v-slot="{hover}">
          <v-card
            class="h-100"
            :elevation="hover ? 4 : 1"
            @click="$emit('expandForm', {row,rowIndex,rowMeta})"
          >
            <v-carousel
              v-if="attachmentColumn"
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

            <!--            <v-card-title-->
            <!--              class="text-capitalize"-->
            <!--              v-text="row[primaryValueColumn]"-->
            <!--            />-->
            <v-card-text>
              <v-container>
                <v-row class="">
                  <v-col
                    v-for="(col) in fields"
                    v-show="showFields[col.alias|| col._cn]"
                    :key="col.alias || col._cn"
                    class="col-12 mt-1 mb-2 "
                  >
                    <label :for="`data-table-form-${col._cn}`" class="body-2 text-capitalize caption grey--text">
                      <virtual-header-cell
                        v-if="col.virtual"
                        :column="col"
                        :nodes="nodes"
                        :is-form="true"
                        :meta="meta"
                      />
                      <header-cell
                        v-else
                        :is-form="true"
                        :value="col._cn"
                        :column="col"
                      />

                    </label>

                    <virtual-cell
                      v-if="col.virtual"
                      ref="virtual"
                      :column="col"
                      :row="row"
                      :nodes="nodes"
                      :meta="meta"
                    />
                    <table-cell
                      v-else
                      :value="row[col._cn]"
                      :column="col"
                      :sql-ui="sqlUi"
                      class="xc-input body-2"
                      :meta="meta"
                    />
                  </v-col>
                </v-row>
              </v-container>
            </v-card-text>
          </v-card>
        </v-hover>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import TableCell from '../components/cell'
export default {
  name: 'GalleryView',
  components: { TableCell, VirtualCell, HeaderCell, VirtualHeaderCell },
  props: [
    'nodes',
    'table',
    'showFields',
    'availableColumns',
    'meta',
    'data',
    'primaryValueColumn',
    'showSystemFields',
    'sqlUi',
    'coverImageField'
  ],
  computed: {
    attachmentColumn() {
      return this.coverImageField && this.meta && this.meta.columns && this.meta.columns.find(c => c._cn === this.coverImageField)
    },
    fields() {
      if (this.availableColumns) {
        return this.availableColumns
      }

      const hideCols = ['created_at', 'updated_at']

      if (this.showSystemFields) {
        return this.meta.columns || []
      } else {
        return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn) &&
          !((this.meta.v || []).some(v => v.bt && v.bt.cn === c.cn))
        ) || []
      }
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
