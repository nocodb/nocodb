<template>
  <v-dialog v-model="visible" max-width="800px">
    <v-card>
      <v-card-actions>
        <v-card-title>
          Table : {{ meta.title }}
        </v-card-title>
        <v-spacer />
        <v-btn
          :disabled="
            !valid ||
              (typeof requiredColumnValidationError === 'string' || requiredColumnValidationError) ||
              (typeof noSelectedColumnError === 'string' || noSelectedColumnError)
          "
          color="primary"
          large
          @click="$emit('import',mappings)"
        >
          <v-icon small class="mr-1">
            mdi-database-import-outline
          </v-icon>
          Import
        </v-btn>
      </v-card-actions>
      <div v-if="requiredColumnValidationError" class="error--text caption pa-2 text-center">
        {{ requiredColumnValidationError }}
      </div>
      <div v-if="noSelectedColumnError" class="error--text caption pa-2 text-center">
        {{ noSelectedColumnError }}
      </div>
      <v-divider />
      <v-container fluid>
        <v-form ref="form" v-model="valid">
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
                  <v-checkbox v-model="r.enabled" class="mt-0" dense hide-details @change="$refs.form.validate()" />
                </td>
                <td class="caption" style="width:45%">
                  <div :title="r.sourceCn" style="">
                    {{ r.sourceCn }}
                  </div>
                </td>
                <td style="width:45%">
                  <v-select
                    v-model="r.destCn"
                    class="caption"
                    dense
                    hide-details="auto"
                    :items="meta.columns"
                    item-text="title"
                    :item-value="v => v && v.title"
                    :rules="[
                      v => validateField(v,r)
                    ]"
                    @change="$refs.form.validate()"
                  >
                    <template #selection="{item}">
                      <v-icon small class="mr-1">
                        {{ getIcon(item.uidt) }}
                      </v-icon>
                      {{ item.title }}
                    </template>
                    <template #item="{item}">
                      <v-icon small class="mr-1">
                        {{ getIcon(item.uidt) }}
                      </v-icon>
                      <span class="caption"> {{ item.title }}</span>
                    </template>
                  </v-select>
                </td>
              </tr>
            </tbody>
          </v-simple-table>
        </v-form>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script>
import { getUIDTIcon, UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'

export default {
  name: 'ColumnMappingModal',
  props: {
    meta: Object,
    importDataColumns: Array,
    value: Boolean,
    parsedCsv: Object
  },
  data() {
    return {
      mappings: [],
      valid: false
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
    },
    requiredColumnValidationError() {
      const missingRequiredColumns = this.meta.columns.filter(c => (c.pk ? !c.ai && !c.cdf : !c.cdf && c.rqd) &&
        !this.mappings.some(r => r.destCn === c.title))

      if (missingRequiredColumns.length) {
        return `Following columns are required : ${missingRequiredColumns.map(c => c.title).join(', ')}`
      }
      return false
    },
    noSelectedColumnError() {
      if ((this.mappings || []).filter(v => v.enabled === true).length == 0) {
        return 'At least one column has to be selected'
      }
      return false
    }
  },
  mounted() {
    this.mapDefaultColumns()
  },

  methods: {
    validateField(_cn, row) {
      if (!_cn) {
        return true
      }

      // if it is not selected, then pass validation
      if (!row.enabled) {
        return true
      }

      const v = this.meta && this.meta.columns.find(c => c.title === _cn)

      if ((this.mappings || []).filter(v => v.destCn === _cn).length > 1) { return 'Duplicate mapping found, please remove one of the mapping' }

      // check if the input contains null value for a required column
      if (v.pk ? !v.ai && !v.cdf : !v.cdf && v.rqd) {
        if (this.parsedCsv && this.parsedCsv.data && this.parsedCsv.data.slice(0, 500)
        .some(r => r[row.sourceCn] === null || r[row.sourceCn] === undefined || r[row.sourceCn] === "" )) {
          return `null value violates not-null constraint`
        }
      }

      switch (v.uidt) {
        case UITypes.Number:
          if (this.parsedCsv && this.parsedCsv.data && this.parsedCsv.data.slice(0, 500)
            .some(r => r[row.sourceCn] !== null && r[row.sourceCn] !== undefined && isNaN(+r[row.sourceCn]))) {
            return 'Source data contains some invalid numbers'
          }
          break
        case UITypes.Checkbox:
          if (
            this.parsedCsv && this.parsedCsv.data && this.parsedCsv.data.slice(0, 500)
              .some((r) => {
                if (r => r[row.sourceCn] !== null && r[row.sourceCn] !== undefined) {
                  let input = r[row.sourceCn]
                  if (typeof input === 'string') {
                    input = input.replace(/["']/g, '').toLowerCase().trim()
                    return !((
                      input == 'false' || input == 'no' || input == 'n' || input == '0' ||
                    input == 'true' || input == 'yes' || input == 'y' || input == '1'
                    ))
                  }
                  return input != 1 && input != 0 && input != true && input != false
                }
                return false
              })
          ) {
            return 'Source data contains some invalid boolean values'
          }
          break
      }
      return true
    },
    mapDefaultColumns() {
      this.mappings = []
      for (const col of this.importDataColumns) {
        const o = { sourceCn: col, enabled: true }
        const tableColumn = this.meta.columns.find(c => c.title === col)
        if (tableColumn) {
          o.destCn = tableColumn.title
        }
        this.mappings.push(o)
      }
      this.$nextTick(() => this.$refs.form.validate())
    },
    getIcon(uidt) {
      return getUIDTIcon(uidt) || 'mdi-alpha-v-circle-outline'
    }
  }
}
</script>

<style scoped>

</style>
