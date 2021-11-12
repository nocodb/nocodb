<template>
  <v-tooltip bottom>
    <template #activator="{on}">
      <input ref="file" type="file" style="display: none" accept=".xlsx, .xls" @change="_change($event)">
      <v-btn
        small
        outlined
        v-on="on"
        @click="$refs.file.click()"
      >
        <v-icon small class="mr-1">
          mdi-file-excel-outline
        </v-icon>
        Import
      </v-btn>
    </template>
    <span class="caption">Create template from Excel</span>
  </v-tooltip>
</template>

<script>

import XLSX from 'xlsx'
export default {
  name: 'ExcelImport',
  methods: {
    _change(file) {
      const files = file.target.files
      if (files && files[0]) { this._file(files[0]) }
    },
    _file(file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const ab = e.target.result
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' })

        // const res = {}
        // iterate each sheet
        // each sheet repensents each table
        for (let i = 0; i < wb.SheetNames.length; i++) {
          const sheet = wb.SheetNames[i]
          const ws = wb.Sheets[sheet]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
          console.log(rows)
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }
}
</script>

<style scoped>

</style>
