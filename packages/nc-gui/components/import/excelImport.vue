<template>
  <div class="pt-10">
    <v-dialog v-model="dropOrUpload" max-width="600">
      <v-card max-width="600">
        <v-tabs height="30">
          <v-tab>
            <v-icon small class="mr-1">
              mdi-file-upload-outline
            </v-icon>
            <span class="caption text-capitalize">Upload</span>
          </v-tab>
          <v-tab>
            <v-icon small class="mr-1">
              mdi-link-variant
            </v-icon>
            <span class="caption text-capitalize">URL</span>
          </v-tab>

          <v-tab-item>
            <div class="nc-excel-import-tab-item ">
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
                <x-icon :color="['primary','grey']" size="50">
                  mdi-file-plus-outline
                </x-icon>
                <p class="title  mb-1 mt-2">
                  Select File to Upload
                </p>
                <p class="grey--text mb-1">
                  or drag and drop file
                </p>

                <p class="caption grey--text">
                  Supported: .xls, .xlsx, .xlsm
                </p>
              </div>
            </div>
          </v-tab-item>
          <v-tab-item>
            <div class="nc-excel-import-tab-item align-center">
              <div class="pa-4 d-100 h-100">
                <v-form ref="form" v-model="valid">
                  <div class="d-flex">
                    <v-text-field
                      v-model="url"
                      hide-details="auto"
                      type="url"
                      label="Enter excel file url"
                      class="caption"
                      outlined
                      dense
                      :rules="[v => !!v || 'Required']"
                    />
                    <v-btn class="ml-3" color="primary" @click="loadUrl">
                      Load
                    </v-btn>
                  </div>
                </v-form>
              </div>
            </div>
          </v-tab-item>
        </v-tabs>

        <div class="px-4 pb-2">
          <div class="d-flex">
            <v-spacer />
            <span class="caption pointer grey--text" @click="showMore = !showMore">{{ showMore ? 'Hide' : 'Show' }} more
              <v-icon small>mdi-menu-{{ showMore ? 'up':'down' }}</v-icon>
            </span>
          </div>
          <div class="mb-2 pt-2 nc-excel-import-options" :style="{ maxHeight: showMore ? '100px' : '0'}">
            <p />

            <v-text-field
              v-model="parserConfig.maxRowsToParse"
              style="max-width: 250px"
              class="caption mx-auto"
              dense
              persistent-hint
              hint="# of rows to parse to infer data type"
              outlined
              type="number"
            />
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
          accept=".xlsx, .xls, .xlsm"
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
        <template-editor :project-template.sync="templateData">
          <template #toolbar>
            <v-spacer />
            <create-project-from-template-btn
              :template-data="templateData"
              :import-data="importData"
            />
          </template>
        </template-editor>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>

// import XLSX from 'xlsx'
import TemplateEditor from '~/components/templates/editor'
import CreateProjectFromTemplateBtn from '~/components/templates/createProjectFromTemplateBtn'
import ExcelUrlTemplateAdapter from '~/components/import/templateParsers/ExcelUrlTemplateAdapter'
import ExcelTemplateAdapter from '~/components/import/templateParsers/ExcelTemplateAdapter'

export default {
  name: 'ExcelImport',
  components: { CreateProjectFromTemplateBtn, TemplateEditor },
  props: {
    hideLabel: Boolean,
    value: Boolean
  },
  data() {
    return {
      valid: null,
      templateData: null,
      importData: null,
      dragOver: false,
      url: '',
      showMore: false,
      parserConfig: {
        maxRowsToParse: 500
      }
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
      this.$store.commit('loader/MutMessage', 'Loading excel file')
      let i = 0
      const int = setInterval(() => {
        this.$store.commit('loader/MutMessage', `Loading excel file${'.'.repeat(++i % 4)}`)
      }, 1000)

      this.dropOrUpload = false
      const reader = new FileReader()

      reader.onload = async(e) => {
        const ab = e.target.result
        await this.parseAndExtractData('file', ab, file.name)
        this.$store.commit('loader/MutMessage', null)

        clearInterval(int)
      }

      const handleEvent = (event) => {
        this.$store.commit('loader/MutMessage', `${event.type}: ${event.loaded} bytes transferred`)
      }

      reader.addEventListener('progress', handleEvent)
      reader.onerror = () => {
        this.$store.commit('loader/MutClear')
      }
      reader.readAsArrayBuffer(file)
    },

    async parseAndExtractData(type, val, name) {
      let templateGenerator
      switch (type) {
        case 'file':
          templateGenerator = new ExcelTemplateAdapter(name, val, this.parserConfig)
          break
        case 'url':
          templateGenerator = new ExcelUrlTemplateAdapter(val, this.$store, this.parserConfig)
          break
      }
      await templateGenerator.init()
      templateGenerator.parse()
      this.templateData = templateGenerator.getTemplate()
      this.importData = templateGenerator.getData()
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
    },

    async loadUrl() {
      if (!this.$refs.form.validate()) {
        return
      }

      this.$store.commit('loader/MutMessage', 'Loading excel file from url')

      let i = 0
      const int = setInterval(() => {
        this.$store.commit('loader/MutMessage', `Loading excel file${'.'.repeat(++i % 4)}`)
      }, 1000)

      this.dropOrUpload = false

      await this.parseAndExtractData('url', this.url, '')
      clearInterval(int)
      this.$store.commit('loader/MutClear')
    }

  }
}
</script>

<style scoped>
.nc-droppable {
  width: 100%;
  min-height: 200px;
  border-radius: 4px;
  border: 2px dashed #ddd;
}

.nc-excel-import-tab-item {
  min-height: 400px;
  padding: 20px;
  display: flex;
  align-items: stretch;
  width: 100%;
}

.nc-excel-import-options{
  transition:.4s max-height;
  overflow: hidden;
}
</style>
