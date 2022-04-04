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
            :ripple="!isLocked"
            @click="!isLocked && $emit('expandForm', {row,rowIndex,rowMeta})"
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
                    v-show="showFields[col.alias|| col.title]"
                    :key="col.alias || col.title"
                    class="col-12 mt-1 mb-2 "
                  >
                    <label :for="`data-table-form-${col.title}`" class="body-2 text-capitalize caption grey--text">
                      <virtual-header-cell
                        v-if="isVirtualCol(col)"
                        :column="col"
                        :nodes="nodes"
                        :is-form="true"
                        :meta="meta"
                      />
                      <header-cell
                        v-else
                        :is-form="true"
                        :value="col.title"
                        :column="col"
                      />

                    </label>

                    <virtual-cell
                      v-if="isVirtualCol(col)"
                      ref="virtual"
                      :column="col"
                      :row="row"
                      :nodes="nodes"
                      :meta="meta"
                    />
                    <table-cell
                      v-else
                      :value="row[col.title]"
                      :column="col"
                      :sql-ui="sqlUi"
                      :is-locked="isLocked"
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
import { isVirtualCol } from 'nocodb-sdk'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import TableCell from '../components/cell'
export default {
  name: 'GalleryView',
  components: {
    TableCell,
    VirtualCell,
    HeaderCell,
    VirtualHeaderCell
  },
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
    'coverImageField',
    'viewId',
    'isLocked'
  ],
  data() {
    return {
      galleryView: {}
    }
  },
  computed: {
    attachmentColumn() {
      return this.coverImageField && this.meta && this.meta.columns && this.meta.columns.find(c => c.id === this.coverImageField)
    },
    fields() {
      if (this.availableColumns) {
        return this.availableColumns
      }

      const hideCols = ['created_at', 'updated_at']

      if (this.showSystemFields) {
        return this.meta.columns || []
      } else {
        return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.column_name) &&
          !((this.meta.v || []).some(v => v.bt && v.bt.column_name === c.column_name))
        ) || []
      }
    }
  },
  watch: {
    async coverImageField(v) {
      if (this.galleryView && v !== this.galleryView.fk_cover_image_col_id) {
        (await this.$api.dbView.galleryUpdate(this.viewId, {
          ...this.galleryView,
          fk_cover_image_col_id: v
        }))
      }
    }
  },
  created() {
    this.loadView()
  },
  methods: {
    isVirtualCol,
    async loadView() {
      this.galleryView = (await this.$api.dbView.galleryRead(this.viewId))
      this.$emit('update:coverImageField', this.galleryView.fk_cover_image_col_id)
    },
    getCovers(row) {
      if (this.attachmentColumn &&
        row[this.attachmentColumn.column_name] && row[this.attachmentColumn.column_name][0] &&
        row[this.attachmentColumn.column_name]) {
        try {
          return JSON.parse(row[this.attachmentColumn.column_name])
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
