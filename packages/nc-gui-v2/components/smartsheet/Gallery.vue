<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import { inject, provide, useViewData } from '#imports'
import { ActiveViewInj, ChangePageInj, IsFormInj, IsGridInj, MetaInj, PaginationDataInj, ReadonlyInj } from '~/context'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)

// todo: get from parent ( inject or use prop )
const isPublicView = false

const selected = reactive<{ row?: number | null; col?: number | null }>({})
const editEnabled = ref(false)

const { loadData, paginationData, formattedData: data, updateRowProperty, changePage } = useViewData(meta, view as any)

provide(IsFormInj, false)
provide(IsGridInj, false)
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)
provide(ReadonlyInj, true)

watch(
  [meta, view],
  async () => {
    if (meta?.value && view?.value) {
      await loadData()
    }
  },
  { immediate: true },
)
</script>

<template>
  <v-container fluid class="nc-gallery-container">
    <!--    <v-row class="align-stretch">
      <v-col v-for="({ row }, rowIndex) in data" :key="rowIndex"
             md="4"
             lg="3"
             sm="6"
             xs="12"> -->

    <!--        <v-hover v-slot="{hover}"> -->

    <div class="flex flex-wrap gap-4 justify-center">
      <div v-for="({ row }, rowIndex) in data" :key="rowIndex" class="md:w-[300px] lg:w-[400px] xl:w-[500px]">
        <v-card class="h-100">
          <!--     :elevation="hover ? 4 : 1"
                 :ripple="!isLocked"
                 @click="!isLocked && $emit('expandForm', {row,rowIndex,rowMeta})"
               > -->
          <!--          <v-carousel
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
              </v-carousel> -->

          <!--            <v-card-title -->
          <!--              class="text-capitalize" -->
          <!--              v-text="row[primaryValueColumn]" -->
          <!--            /> -->
          <v-card-text>
            <v-container fluid>
              <!--              <v-row class="">
                    <v-col v-for="col in meta.columns" :key="col.title"
                           class="col-12"> -->
              <div v-for="col in meta.columns" :key="col.title" class="my-8">
                <!--                <v-col v-for="col in fields" v-show="showFields[col.title]" :key="col.title" class="col-12 mt-1 mb-2"> -->
                <!--
    todo:header cell
    -->
                <label :for="`data-table-form-${col.title}`" class="body-2 text-capitalize caption grey--text">
                  <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />
                  <SmartsheetHeaderCell v-else :column="col" />
                  <!--                    <virtual-header-cell
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
                        /> -->
                </label>
                <div class="mt-2">
                  <SmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row[col.title]" :edit-enabled="false" :column="col" />

                  <SmartsheetCell
                    v-else
                    v-model="row[col.title]"
                    :edit-enabled="false"
                    :column="col"
                    @update:model-value="updateRowProperty(row, col.title)"
                  />
                </div>
                <!--                  <virtual-cell
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
                      /> -->
                <!--                </v-col> -->
                <!--              </v-row> -->
              </div>
            </v-container>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!--        </v-hover> -->
    <!--      </v-col>
    </v-row> -->
  </v-container>
</template>

<!--
<script>
import { isVirtualCol } from "nocodb-sdk";
import VirtualHeaderCell from "../components/VirtualHeaderCell";
import HeaderCell from "../components/HeaderCell";
import VirtualCell from "../components/VirtualCell";
import TableCell from "../components/Cell";

export default {
  name: "GalleryView",
  components: {
    TableCell,
    VirtualCell,
    HeaderCell,
    VirtualHeaderCell
  },
  props: [
    "nodes",
    "table",
    "showFields",
    "availableColumns",
    "meta",
    "data",
    "primaryValueColumn",
    "showSystemFields",
    "sqlUi",
    "coverImageField",
    "viewId",
    "isLocked"
  ],
  data() {
    return {
      galleryView: {}
    };
  },
  computed: {
    attachmentColumn() {
      return this.coverImageField && this.meta && this.meta.columns && this.meta.columns.find(c => c.id === this.coverImageField);
    },
    fields() {
      if (this.availableColumns) {
        return this.availableColumns;
      }

      const hideCols = ["created_at", "updated_at"];

      if (this.showSystemFields) {
        return this.meta.columns || [];
      } else {
        return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.title) &&
          !((this.meta.v || []).some(v => v.bt && v.bt.title === c.title))
        ) || [];
      }
    }
  },
  watch: {
    async coverImageField(v) {
      if (this.galleryView && v !== this.galleryView.fk_cover_image_col_id) {
        (await this.$api.dbView.galleryUpdate(this.viewId, {
          ...this.galleryView,
          fk_cover_image_col_id: v
        }));
      }
    }
  },
  created() {
    this.loadView();
  },
  methods: {
    isVirtualCol,
    async loadView() {
      this.galleryView = (await this.$api.dbView.galleryRead(this.viewId));
      this.$emit("update:coverImageField", this.galleryView.fk_cover_image_col_id);
    },
    getCovers(row) {
      if (this.attachmentColumn &&
        row[this.attachmentColumn.title] && row[this.attachmentColumn.title][0] &&
        row[this.attachmentColumn.title]) {
        try {
          return JSON.parse(row[this.attachmentColumn.title]);
        } catch (e) {

        }
      }
      return [{ url: "https://via.placeholder.com/700?text=No%20image%20found" }];
    }
  }
};
</script>

<style scoped>

</style>
-->
<style scoped>
.nc-gallery-container {
  height: calc(100vh - 160px);
  overflow: auto;
}
</style>
