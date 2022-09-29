<template>
  <div :class="{ 'pt-10': !hideLabel }">
    <v-dialog v-model="dropOrUpload" max-width="600">
      <v-card max-width="600">
        <v-tabs height="30">
          <v-tab>
            <v-icon small class="mr-1"> mdi-file-upload-outline </v-icon>
            <span class="caption text-capitalize">Upload</span>
          </v-tab>
          <!--          <v-tab>-->
          <!--            <v-icon small class="mr-1">
              mdi-link-variant
            </v-icon>
            <span class="caption text-capitalize">URL</span>
          </v-tab>-->
          <v-tab>
            <v-icon small class="mr-1"> mdi-link-variant </v-icon>
            <span class="caption text-capitalize">String</span>
          </v-tab>

          <v-tab-item>
            <div class="nc-json-import-tab-item">
              <div
                class="nc-droppable d-flex align-center justify-center flex-column"
                :style="{
                  background: dragOver ? '#7772' : '',
                }"
                @click="$refs.file.click()"
                @drop.prevent="dropHandler"
                @dragover.prevent="dragOver = true"
                @dragenter.prevent="dragOver = true"
                @dragexit="dragOver = false"
                @dragleave="dragOver = false"
                @dragend="dragOver = false"
              >
                <x-icon :color="['primary', 'grey']" size="50"> mdi-file-plus-outline </x-icon>
                <p class="title mb-1 mt-2">
                  <!-- Select File to Upload-->
                  {{ $t('msg.info.upload') }}
                </p>
                <p class="grey--text mb-1">
                  <!-- or drag and drop file-->
                  {{ $t('msg.info.upload_sub') }}
                </p>

                <p v-if="quickImportType == 'excel'" class="caption grey--text">
                  <!-- Supported: .xls, .xlsx, .xlsm, .ods, .ots -->
                  {{ $t('msg.info.excelSupport') }}
                </p>
              </div>
            </div>
          </v-tab-item>
          <!--          <v-tab-item>
            <div class="nc-json-import-tab-item align-center">
              <div class="pa-4 d-100 h-100">
                <v-form ref="form" v-model="valid">
                  <div class="d-flex">
                    &lt;!&ndash; todo:  i18n label&ndash;&gt;
                    <v-text-field
                      v-model="url"
                      hide-details="auto"
                      type="url"
                      label="Enter JSON file url"
                      class="caption"
                      outlined
                      dense
                      :rules="
                        [
                          v => !!v || $t('general.required'),
                          v => !(/(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g).test(v) || errorMessages.ipBlockList
                        ]"
                    />
                    <v-btn v-t="['c:project:create:json:load-url']" class="ml-3" color="primary" @click="loadUrl">
                      &lt;!&ndash;Load&ndash;&gt;
                      {{ $t('general.load') }}
                    </v-btn>
                  </div>
                </v-form>
              </div>
            </div>
          </v-tab-item>-->
          <v-tab-item>
            <div class="nc-json-import-tab-item align-center">
              <div class="pa-4 d-100 h-100">
                <v-form ref="form" v-model="valid">
                  <div class="nc-json-editor-wrapper">
                    <v-btn small class="nc-json-format-btn" @click="formatJson"> Format </v-btn>

                    <!--label="Enter excel file url"-->
                    <monaco-json-editor ref="editor" v-model="jsonString" style="height: 320px" />
                    <div class="text-center mt-4">
                      <v-btn
                        v-t="['c:project:create:excel:load-url']"
                        class="ml-3"
                        color="primary"
                        @click="loadJsonString"
                      >
                        <!--Load-->
                        {{ $t('general.load') }}
                      </v-btn>
                    </div>
                  </div>
                </v-form>
              </div>
            </div>
          </v-tab-item>
        </v-tabs>

        <div class="px-4 pb-2">
          <div class="d-flex">
            <v-spacer />
            <span class="caption pointer grey--text" @click="showMore = !showMore">
              {{ showMore ? $t('general.hideAll') : $t('general.showMore') }}
              <v-icon small color="grey lighten-1">mdi-menu-{{ showMore ? 'up' : 'down' }}</v-icon>
            </span>
          </div>
          <div class="mb-2 pt-2 nc-json-import-options" :style="{ maxHeight: showMore ? '200px' : '0' }">
            <p />
            <!--hint="# of rows to parse to infer data type"-->
            <v-text-field
              v-model="parserConfig.maxRowsToParse"
              style="max-width: 250px"
              class="caption mx-auto"
              dense
              persistent-hint
              :hint="$t('msg.info.footMsg')"
              outlined
              type="number"
            />

            <v-checkbox
              v-model="parserConfig.normalizeNested"
              style="width: 250px"
              class="mx-auto mb-2"
              dense
              hide-details
            >
              <template #label>
                <span class="caption">Flatten nested</span>
                <v-tooltip bottom position-y="">
                  <template #activator="{ on }">
                    <v-icon small class="ml-1" v-on="on"> mdi-information-outline </v-icon>
                  </template>
                  <div class="caption" style="width: 260px">
                    If flatten nested option is set it will flatten nested object as root level property. In normal case
                    nested object will treat as JSON column.
                    <br />
                    <br />
                    For example the following input:
                    <code class="caption font-weight-bold"
                      >{ "prop1": { "prop2": "value" }, "prop3": "value", "prop4": 1 }</code
                    >
                    will treat as:
                    <code class="caption font-weight-bold"
                      >{ "prop1_prop2": "value", "prop3": "value", "prop4": 1 }</code
                    >
                  </div>
                </v-tooltip>
              </template>
            </v-checkbox>
            <v-checkbox v-model="parserConfig.importData" style="width: 250px" class="mx-auto mb-2" dense hide-details>
              <template #label>
                <span class="caption">Import data</span>
              </template>
            </v-checkbox>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <v-tooltip bottom>
      <template #activator="{ on }">
        <input
          ref="file"
          class="nc-json-import-input"
          type="file"
          style="display: none"
          accept=".json"
          @change="_change($event)"
        />
        <v-btn v-if="!hideLabel" small outlined v-on="on" @click="$refs.file.click()">
          <v-icon small class="mr-1"> mdi-file-excel-outline </v-icon>
          <!--Import-->
          {{ $t('activity.import') }}
        </v-btn>
      </template>
      <span class="caption">Create template from JSON</span>
    </v-tooltip>

    <v-dialog v-if="templateData" v-model="templateEditorModal" max-width="1000">
      <v-card class="pa-6" min-width="500">
        <template-editor :project-template.sync="templateData" json-import :quick-import-type="quickImportType">
          <template #toolbar="{ valid }">
            <h3 class="mt-2 grey--text">
              <span> JSON Import </span>
            </h3>
            <v-spacer />
            <v-spacer />
            <create-project-from-template-btn
              :template-data="templateData"
              :import-data="importData"
              :import-to-project="importToProject"
              json-import
              :valid="valid"
              create-gql-text="Import as GQL Project"
              create-rest-text="Import as REST Project"
              @closeModal="$emit('closeModal'), (templateEditorModal = false)"
            >
              <!--Import Excel-->
              <span v-if="quickImportType === 'excel'">
                {{ $t('activity.importExcel') }}
              </span>
              <!--Import CSV-->
              <span v-if="quickImportType === 'csv'">
                {{ $t('activity.importCSV') }}
              </span>
            </create-project-from-template-btn>
          </template>
        </template-editor>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import TemplateEditor from '~/components/templates/Editor';
import CreateProjectFromTemplateBtn from '~/components/templates/CreateProjectFromTemplateBtn';
import MonacoJsonEditor from '~/components/monaco/MonacoJsonEditor';
import JSONTemplateAdapter from '~/components/import/templateParsers/JSONTemplateAdapter';
import JSONUrlTemplateAdapter from '~/components/import/templateParsers/JSONUrlTemplateAdapter';

export default {
  name: 'JsonImport',
  components: { MonacoJsonEditor, CreateProjectFromTemplateBtn, TemplateEditor },
  props: {
    hideLabel: Boolean,
    value: Boolean,
    importToProject: Boolean,
    quickImportType: String,
  },
  data() {
    return {
      templateEditorModal: false,
      valid: null,
      templateData: null,
      importData: null,
      dragOver: false,
      url: '',
      showMore: false,
      parserConfig: {
        maxRowsToParse: 500,
        normalizeNested: true,
        importData: true,
      },
      filename: '',
      jsonString: '',
      errorMessages: {
        ipBlockList: 'IP Not allowed!',
        importJSON: 'Target file is not an accepted file type. The accepted file type is .json!',
      },
    };
  },
  computed: {
    dropOrUpload: {
      set(v) {
        this.$emit('input', v);
      },
      get() {
        return this.value;
      },
    },
    tables() {
      return this.$store.state.project.tables || [];
    },
  },
  mounted() {
    if (this.$route && this.$route.query && this.$route.query.excelUrl) {
      this.url = this.$route.query.excelUrl;
      this.loadUrl();
    }
  },
  methods: {
    formatJson() {
      console.log(this.$refs.editor);
      this.$refs.editor.format();
    },

    selectFile() {
      this.$refs.file.files = null;
      this.$refs.file.click();
    },

    _change(event) {
      const files = event.target.files;
      if (files && files[0]) {
        this._file(files[0]);
        event.target.value = '';
      }
    },
    async _file(file) {
      this.templateData = null;
      this.importData = null;
      this.$store.commit('loader/MutMessage', 'Loading excel file');
      let i = 0;
      const int = setInterval(() => {
        this.$store.commit('loader/MutMessage', `Loading excel file${'.'.repeat(++i % 4)}`);
      }, 1000);
      this.dropOrUpload = false;
      const reader = new FileReader();
      this.filename = file.name;

      reader.onload = async e => {
        const ab = e.target.result;
        await this.parseAndExtractData('file', ab, file.name);
        this.$store.commit('loader/MutMessage', null);

        clearInterval(int);
      };

      const handleEvent = event => {
        this.$store.commit('loader/MutMessage', `${event.type}: ${event.loaded} bytes transferred`);
      };

      reader.addEventListener('progress', handleEvent);
      reader.onerror = e => {
        console.log('error', e);
        this.$store.commit('loader/MutClear');
      };
      reader.readAsText(file);
    },

    async parseAndExtractData(type, val, name) {
      try {
        let templateGenerator;
        this.templateData = null;
        this.importData = null;
        switch (type) {
          case 'file':
            templateGenerator = new JSONTemplateAdapter(name, val, this.parserConfig);
            break;
          case 'url':
            templateGenerator = new JSONUrlTemplateAdapter(val, this.$store, this.parserConfig, this.$api);
            break;
          case 'string':
            templateGenerator = new JSONTemplateAdapter(name, val, this.parserConfig);
            break;
        }
        await templateGenerator.init();
        templateGenerator.parse();
        this.templateData = templateGenerator.getTemplate();

        this.templateData.tables[0].table_name = this.populateUniqueTableName();

        this.importData = templateGenerator.getData();
        this.templateEditorModal = true;
      } catch (e) {
        console.log(e);
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
      }
    },

    dropHandler(ev) {
      this.dragOver = false;
      let file;
      if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        if (ev.dataTransfer.items.length && ev.dataTransfer.items[0].kind === 'file') {
          file = ev.dataTransfer.items[0].getAsFile();
        }
      } else if (ev.dataTransfer.files.length) {
        file = ev.dataTransfer.files[0];
      }

      if (!file) {
        return;
      }

      if (!/.*\.json/.test(file.name)) {
        return this.$toast.error(this.errorMessages.importJSON).goAway(3000);
      }

      this._file(file);
    },
    dragOverHandler(ev) {
      // Prevent default behavior (Prevent file from being opened)
      ev.preventDefault();
    },
    populateUniqueTableName() {
      let c = 1;
      while (this.tables.some(t => t.title === `Sheet${c}`)) {
        c++;
      }
      return `Sheet${c}`;
    },
    async loadUrl() {
      if ((this.$refs.form && !this.$refs.form.validate()) || !this.url) {
        return;
      }

      this.$store.commit('loader/MutMessage', 'Loading json file from url');

      let i = 0;
      const int = setInterval(() => {
        this.$store.commit('loader/MutMessage', `Loading json file${'.'.repeat(++i % 4)}`);
      }, 1000);

      this.dropOrUpload = false;

      await this.parseAndExtractData('url', this.url, '');
      clearInterval(int);
      this.$store.commit('loader/MutClear');
    },

    async loadJsonString() {
      await this.parseAndExtractData('string', this.jsonString);
      this.$store.commit('loader/MutClear');
    },
  },
};
</script>

<style scoped>
.nc-droppable {
  width: 100%;
  min-height: 200px;
  border-radius: 4px;
  border: 2px dashed #ddd;
}

.nc-json-import-tab-item {
  min-height: 400px;
  padding: 20px;
  display: flex;
  align-items: stretch;
  width: 100%;
}

.nc-json-import-options {
  transition: 0.4s max-height;
  overflow: hidden;
}

.nc-json-editor-wrapper {
  position: relative;
}

.nc-json-format-btn {
  position: absolute;
  right: 4px;
  top: 4px;
  z-index: 9;
}
</style>
