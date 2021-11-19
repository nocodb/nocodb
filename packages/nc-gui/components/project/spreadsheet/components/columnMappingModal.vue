<template>
  <v-dialog v-model="visible" max-width="800px">
    <v-card>
      <v-card-actions>
        <v-card-title>
          Table : {{ meta._tn }}
        </v-card-title>
        <v-spacer />
        <v-btn color="primary" large @click="$emit('import',mappings)">
          <v-icon small class="mr-1">
            mdi-database-import-outline
          </v-icon>   Import
        </v-btn>
      </v-card-actions>
      <v-divider />
      <v-container fluid>
        <v-simple-table dense style="position:relative;">
          <thead>
            <tr>
              <th />
              <th style="width:45%" class="grey--text">
                Source column
              </th>
              <th style="width:45%" class="grey--text">
                Destination column
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r,i) in mappings" :key="i">
              <td>
                <v-checkbox v-model="r.enabled" class="mt-0" dense hide-details />
              </td><td class="caption" style="width:45%">
                <div :title="r.sourceCn" style="">
                  {{ r.sourceCn }}
                </div>
              </td><td style="width:45%">
                <v-select
                  v-model="r.destCn"
                  class="caption"
                  dense
                  hide-details
                  :items="meta.columns"
                  item-text="_cn"
                  item-value="_cn"
                >
                  <template #selection="{item}">
                    <v-icon small class="mr-1">
                      {{ getIcon(item.uidt) }}
                    </v-icon>
                    {{ item._cn }}
                  </template>
                  <template #item="{item}">
                    <v-icon small class="mr-1">
                      {{ getIcon(item.uidt) }}
                    </v-icon>
                    <span class="caption"> {{ item._cn }}</span>
                  </template>
                </v-select>
              </td>
            </tr>
          </tbody>
        </v-simple-table>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script>
import { getUIDTIcon } from '~/components/project/spreadsheet/helpers/uiTypes'

export default {
  name: 'ColumnMappingModal',
  props: {
    meta: Object,
    importDataColumns: Array,
    value: Boolean
  },
  data() {
    return {
      mappings: []
    }
  },
  computed: {
    visible: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    }
  },
  mounted() {
    this.mapDefaultColumns()
  },
  methods: {
    mapDefaultColumns() {
      this.mappings = []
      for (const col of this.importDataColumns) {
        const o = { sourceCn: col, enabled: true }
        const tableColumn = this.meta.columns.find(c => c._cn === col)
        if (tableColumn) {
          o.destCn = tableColumn._cn
        }
        this.mappings.push(o)
      }
    },
    getIcon(uidt) {
      return getUIDTIcon(uidt) || 'mdi-alpha-v-circle-outline'
    }
  }
}
</script>

<style scoped>

</style>
