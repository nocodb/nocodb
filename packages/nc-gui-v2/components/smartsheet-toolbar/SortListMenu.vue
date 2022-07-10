<script>
/* import { RelationTypes, UITypes } from 'nocodb-sdk'
import { getUIDTIcon } from '~/components/project/spreadsheet/helpers/uiTypes'
import FieldListAutoCompleteDropdown from '~/components/project/spreadsheet/components/FieldListAutoCompleteDropdown'

export default {
  name: 'SortListMenu',
  components: { FieldListAutoCompleteDropdown },
  props: {
    fieldList: Array,
    value: [Array, Object],
    isLocked: Boolean,
    meta: [Object],
    viewId: String,
    shared: Boolean,
  },
  data: () => ({
    sortList: [],
  }),
  computed: {
    columns() {
      if (!this.meta || !this.meta.columns) {
        return []
      }
      return this.meta.columns
        .filter((c) => !(c.uidt === UITypes.LinkToAnotherRecord && c.colOptions.type !== RelationTypes.BELONGS_TO))
        .map((c) => ({
          ...c,
          icon: getUIDTIcon(c.uidt),
        }))
    },
  },
  watch: {
    value(v) {
      this.sortList = v || []
    },
    async viewId(v) {
      if (v) {
        await this.loadSortList()
      }
    },
  },
  async created() {
    this.sortList = this.value || []
    this.loadSortList()
  },
  methods: {
    addSort() {
      this.sortList.push({
        fk_column_id: null,
        direction: 'asc',
      })
      this.sortList = this.sortList.slice()
      this.$e('a:sort:add', { length: this.sortList.length })
    },
    async loadSortList() {
      if (!this.shared) {
        // && !this._isUIAllowed('sortSync')) {
        let sortList = []

        if (this.viewId) {
          const data = await this.$api.dbTableSort.list(this.viewId)
          sortList = data.sorts.list
        }

        this.sortList = sortList
      }
    },
    async saveOrUpdate(sort, i) {
      if (!this.shared && this._isUIAllowed('sortSync')) {
        if (sort.id) {
          await this.$api.dbTableSort.update(sort.id, sort)
        } else {
          this.$set(this.sortList, i, await this.$api.dbTableSort.create(this.viewId, sort))
        }
      } else {
        this.$emit('input', this.sortList)
      }
      this.$emit('updated')

      this.$e('a:sort:dir', { direction: sort.direction })
    },
    async deleteSort(sort, i) {
      if (!this.shared && sort.id && this._isUIAllowed('sortSync')) {
        await this.$api.dbTableSort.delete(sort.id)
        await this.loadSortList()
      } else {
        this.sortList.splice(i, 1)
        this.$emit('input', this.sortList)
      }
      this.$emit('updated')
      this.$e('a:sort:delete')
    },
  },
} */
</script>

<template>
  <!--  <v-menu offset-y transition="slide-y-transition">
    <template #activator="{ on }">
      <v-badge :value="sortList && sortList.length" color="primary" dot overlap>
        <v-btn
          v-t="['c:sort']"
          class="nc-sort-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          small
          text
          outlined
          :class="{
            'primary lighten-5 grey&#45;&#45;text text&#45;&#45;darken-3': sortList && sortList.length,
          }"
          v-on="on"
        >
          <v-icon small class="mr-1" color="#777"> mdi-sort </v-icon>
          &lt;!&ndash; Sort &ndash;&gt;
          {{ $t('activity.sort') }}
          <v-icon small color="#777"> mdi-menu-down </v-icon>
        </v-btn>
      </v-badge>
    </template>
    <div class="backgroundColor pa-2 menu-filter-dropdown" style="min-width: 330px">
      <div class="sort-grid" @click.stop>
        <template v-for="(sort, i) in sortList || []" dense>
          <v-icon :key="`${i}icon`" class="nc-sort-item-remove-btn" small @click.stop="deleteSort(sort)"> mdi-close-box </v-icon>

          <FieldListAutoCompleteDropdown
            :key="`${i}sel1`"
            v-model="sort.fk_column_id"
            class="caption nc-sort-field-select"
            :columns="columns"
            @click.stop
            @change="saveOrUpdate(sort, i)"
          />
          <v-select
            :key="`${i}sel2`"
            v-model="sort.direction"
            class="flex-shrink-1 flex-grow-0 caption nc-sort-dir-select"
            :items="[
              { text: 'A -> Z', value: 'asc' },
              { text: 'Z -> A', value: 'desc' },
            ]"
            :label="$t('labels.operation')"
            solo
            flat
            dense
            hide-details
            @click.stop
            @change="saveOrUpdate(sort, i)"
          >
            <template #item="{ item }">
              <span class="caption font-weight-regular">{{ item.text }}</span>
            </template>
          </v-select>
        </template>
      </div>
      <v-btn small class="elevation-0 grey&#45;&#45;text my-3" @click.stop="addSort">
        <v-icon small color="grey"> mdi-plus </v-icon>
        &lt;!&ndash; Add Sort Option &ndash;&gt;
        {{ $t('activity.addSort') }}
      </v-btn>
    </div>
  </v-menu> -->
</template>

<style scoped>
/*.sort-grid {
  display: grid;
  grid-template-columns: 22px auto 100px;
  column-gap: 6px;
  row-gap: 6px;
}*/
</style>
