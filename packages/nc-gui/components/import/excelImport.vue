<template>
  <div class="pt-10">
    <v-dialog v-model="dropOrUpload" max-width="600">
      <v-card max-width="600">
        <div class="pa-4">
          <div
            class="nc-droppable d-flex align-center justify-center flex-column"
            :style="{
              background : dragOver ? '#7774' : ''
            }"
            @click="$refs.file.click()"
            @drop.prevent="dropHandler"
            @dragover.prevent="dragOver = true"
            @dragenter.prevent="dragOver = true"
            @dragexit="dragOver = false"
            @dragleave="dragOver = false"
            @dragend="dragOver = false"
          >
            <v-icon size="50" color="grey">
              mdi-file-plus-outline
            </v-icon>
            <p class="title grey--text mb-1 mt-2">
              Select Files to Upload
            </p>
            <p class="grey--text ">
              or drag and drop files
            </p>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <v-tooltip bottom>
      <template #activator="{on}">
        <input
          ref="file"
          class="nc-excel-import-input"
          type="file"
          style="display: none"
          accept=".xlsx, .xls"
          @change="_change($event)"
        >
        <v-btn

          v-if="!hideLabel"
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

    <v-dialog v-if="templateData" :value="true">
      <v-card>
        <template-editor :template-data.sync="templateData">
          <template #toolbar>
            <v-spacer />
            <create-project-from-template-btn
              :loader-message.sync="loaderMessage"
              :progress.sync="progress"
              :template-data="templateData"
              :import-data="importData"
            />
          </template>
        </template-editor>
      </v-card>
    </v-dialog>

    <v-overlay :value="loaderMessage" z-index="99999" opacity=".9">
      <div class="d-flex flex-column align-center">
        <v-progress-circular
          v-if="progress !== null "
          :rotate="360"
          :size="100"
          :width="15"
          :value="progress"
        >
          {{ progress }}%
        </v-progress-circular>

        <v-progress-circular v-else indeterminate size="100" width="15" class="mb-10" />
        <span class="title">{{ loaderMessage }}</span>
      </div>
    </v-overlay>
  </div>
</template>

<script>

// import XLSX from 'xlsx'
import ExcelTemplateAdapter from '~/components/import/ExcelTemplateAdapter'
import TemplateEditor from '~/components/templates/editor'
import CreateProjectFromTemplateBtn from '~/components/templates/createProjectFromTemplateBtn'

export default {
  name: 'ExcelImport',
  components: { CreateProjectFromTemplateBtn, TemplateEditor },
  props: {
    hideLabel: Boolean,
    value: Boolean
  },
  data() {
    return {
      templateData: null,
      importData: null,
      dragOver: false,
      loaderMessage: null,
      progress: null
    }
  },
  computed: {
    dropOrUpload: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      }
    }
  },
  mounted() {
  },
  methods: {

    selectFile() {
      this.$refs.file.files = null
      this.$refs.file.click()
    },

    _change(file) {
      const files = file.target.files
      if (files && files[0]) {
        this._file(files[0])
      }
    },
    async _file(file) {
      this.loaderMessage = 'Loading excel file'
      let i = 0
      const int = setInterval(() => {
        this.loaderMessage = `Loading excel file${'.'.repeat(++i % 4)}`
      }, 1000)

      this.dropOrUpload = false
      const reader = new FileReader()

      reader.onload = (e) => {
        const ab = e.target.result
        const templateGenerator = new ExcelTemplateAdapter(file.name, ab)
        templateGenerator.parse()
        this.templateData = templateGenerator.getTemplate()
        this.importData = templateGenerator.getData()
        this.loaderMessage = null
        clearInterval(int)
      }

      const handleEvent = (event) => {
        this.loaderMessage = `${event.type}: ${event.loaded} bytes transferred`
      }

      reader.addEventListener('progress', handleEvent)
      reader.onerror = () => {
        this.loaderMessage = null
      }
      reader.readAsArrayBuffer(file)
    },
    dropHandler(ev) {
      console.log('File(s) dropped')
      let file
      if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        if (ev.dataTransfer.items.length && ev.dataTransfer.items[0].kind === 'file') {
          file = ev.dataTransfer.items[0].getAsFile()
        }
      } else if (ev.dataTransfer.files.length) {
        file = ev.dataTransfer.files[0]
      }

      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && file.type !== 'application/vnd.ms-excel') {
        return this.$toast.error('Dropped file is not an accepted file type. The accepted file types are .xlsx,.xls!').goAway(3000)
      }
      if (file) {
        this._file(file)
      }
    },
    dragOverHandler(ev) {
      console.log('File(s) in drop zone')

      // Prevent default behavior (Prevent file from being opened)
      ev.preventDefault()
    }

  }
}
</script>

<style scoped>
.nc-droppable {
  width: 100%;
  min-height: 200px;
  border-radius: 4px;
  border: 2px dashed var(--v-textColor-lighten5);
}
</style>
