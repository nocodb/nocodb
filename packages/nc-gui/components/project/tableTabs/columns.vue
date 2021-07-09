<template>
  <div class="">
    <v-overlay absolute v-if="isMetaTable">
      <v-alert type="info">Meta tables are not editable</v-alert>
    </v-overlay>
    <v-card class="elevation-0">

      <v-toolbar height="42" flat class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },{
          text: this.nodes.dbAlias,
          disabled: true,
          href: '#'
        },
        {
          text: this.nodes._tn + ' (table)',
          disabled: true,
          href: '#'
        }]" divider=">" small class="title">
            <template v-slot:divider>
              <v-icon small color="grey lighten-2">forward</v-icon>
            </template>
          </v-breadcrumbs>

        </v-toolbar-title>
        <v-spacer></v-spacer>

        <x-btn tooltip="Reload Columns from database"
               outlined
               color="primary"
               small
               @click="reload"
               v-ge="['columns','reload']"
        >
          <v-icon small left>refresh</v-icon>
          Re<u>l</u>oad
        </x-btn>
        <x-btn tooltip="Adds new column"
               outlined
               color="primary"
               small
               @click="addColumn"
               v-ge="['columns','new']"
        >
          <v-icon small>mdi-plus</v-icon>&nbsp;<u>N</u>ew Column
        </x-btn
        >

        <x-btn
          v-if="$store.state.windows.scaffoldOnSave && projectIsGraphql && !isNoApis"
          tooltip="Save & Scaffold Changes"
          outlined
          color="primary"
          small
          :disabled="(!edited && !newTable) || isMetaTable"
          @click="applyChangesDirectGql"
          v-ge="['columns','save-and-scaffold']"
        >
          <v-icon small>mdi-content-save</v-icon>&nbsp;
          <u>S</u>ave &nbsp;& Scaffold
        </x-btn>

        <x-btn
          v-else-if="$store.state.windows.scaffoldOnSave && !isNoApis"
          tooltip="Save & Scaffold Changes"
          outlined
          color="primary"
          small
          :disabled="(!edited && !newTable) || isMetaTable"
          @click="applyChangesDirect"
          v-ge="['columns','save-and-scaffold']"
        >
          <v-icon small>mdi-content-save</v-icon>&nbsp;
          <u>S</u>ave &nbsp;& Scaffold
        </x-btn>
        <x-btn
          v-else
          tooltip="Save Changes"
          outlined
          color="primary"
          small
          :disabled="(!edited && !newTable) || isMetaTable"
          @click="applyChanges"
          v-ge="['columns','save']">
          <v-icon small>mdi-content-save</v-icon>&nbsp;
          <u>S</u>ave &nbsp;
        </x-btn>
        <x-btn tooltip="Deletes Table"
               outlined
               small
               @click="deleteTable('showDialog')"
               color="error "
               class="text-right"
               v-ge="['columns','table-delete']">
          <v-icon small>mdi-delete-outline</v-icon>&nbsp;<u>D</u>elete Table &nbsp;
        </x-btn>
        <v-menu open-on-hover offset-y primary>
          <template v-slot:activator="{ on }">
            <v-btn
              outlined
              small
              color="primary"
              dark
              v-on="on"
              class="font-weight-bold">
              Actions
              <v-icon>mdi-menu-down</v-icon>
            </v-btn>
          </template>

          <v-list dense>

            <template v-if="!isNoApis && isMvc">
              <template
                v-if="projectIsGraphql">
                <v-list-item
                  @click="saveAndScaffoldGql()"

                  v-ge="['columns','save-and-scaffold']">
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Save & Scaffold Module

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  @click="saveAndScaffoldGqlModel()"
                  v-ge="['columns','save-and-scaffold']"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Save & Scaffold GQL Model

                  </v-list-item-title>
                </v-list-item>


                <v-list-item
                  @click="scaffoldGql({model:true})"
                  v-ge="['columns','scaffold']"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold GQL Model

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  @click="scaffoldGql({resolver:true})"
                  v-ge="['columns','scaffold']"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold GQL Resolver

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  @click="scaffoldGql({service:true})"
                  v-ge="['columns','scaffold']"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold GQL Service

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  @click="scaffoldGql({relations:true})"
                  v-ge="['columns','scaffold']"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold GQL Relations

                  </v-list-item-title>
                </v-list-item>

                <!--            graphql : end-->


              </template>
              <template v-else>


                <v-list-item
                  v-ge="['columns','save-and-scaffold']"
                  @click="saveAndScaffold()">
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Save & Scaffold Module

                  </v-list-item-title>
                </v-list-item>

                <v-list-item
                  v-ge="['columns','save-and-scaffold']"
                  @click="saveAndScaffoldModel()">
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Save & Scaffold Model

                  </v-list-item-title>
                </v-list-item>

                <v-list-item
                  v-ge="['columns','json-to-column']"
                  @click="scaffold({model:true})">
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold Model

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-ge="['columns','scaffold']"
                  @click="scaffold({router:true})"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold Router

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-ge="['columns','scaffold']"
                  @click="scaffold({service:true})"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold Service

                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-ge="['columns','scaffold']"
                  @click="scaffold({relations:true})"
                >
                  <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                    <v-icon color="primary" small>mdi-code-json</v-icon>
                    &nbsp;Scaffold Relations

                  </v-list-item-title>
                </v-list-item>


              </template>

            </template>
            <v-list-item
              @click="showJsonToColumDlg = true"
            >
              <v-list-item-title class="font-weight-bold pa-1" v-ge="['columns','json-to-columns']">
                <v-icon color="primary" small>mdi-code-json</v-icon>
                &nbsp;
                JSON To Columns
              </v-list-item-title>
            </v-list-item>


          </v-list>
        </v-menu>

      </v-toolbar>

      <v-skeleton-loader type="table" v-if="loading"></v-skeleton-loader>
      <v-data-table
        v-else
        dense
        :headers="headers"
        :items="columns"
        hide-default-header
        :footer-props="{'items-per-page-options': paginationLength }"
        class=" column-table"
      >
        <template v-slot:header="{props:{headers}}">
          <tr>
            <th class="pt-2 pb-0 grey--text caption  text-center" v-for="header in headers" :key="header.title"
                style="white-space: nowrap;"
                :style="{minWidth:header.width,width:header.width}"
            >
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <span v-on="on">{{ header.text }}</span>
                </template>
                <span>{{ header.title }}</span>
              </v-tooltip>
            </th>
          </tr>
        </template>

        <template v-slot:item="props">
          <tr :disabled="nodes.tn==='_evolutions' || nodes.tn==='nc_evolutions'">
            <td
              :title="props.item.cn"
              ref="column"
              style="width:200px"
            >
              <div class="d-flex">
                &nbsp;
                <v-icon small
                        :class="{
                        'green--text' : props.item.pk,
                        'orange--text text--darken-2':props.item.rcn,
                        'lime--text text--lighten-4' : !props.item.pk&&!props.item.rcn
                        }">
                  {{ getColumnIcon(props.item) }}
                </v-icon>&nbsp;

                <v-edit-dialog
                  class="flex-shrink-1"
                  v-if="!props.item.rcn"
                  @save.native="saveColumnName(props.item)"
                  @cancel="saveColumnName(props.item)"
                  @close="saveColumnName(props.item)"
                  v-ge="['columns','cn']"
                >
                  <div
                    :title="props.item.cn"
                    style="width:180px;overflow:hidden;white-space: nowrap;text-overflow:ellipsis"> {{
                      props.item.cn
                    }}
                  </div>
                  <template v-slot:input>
                    <v-text-field
                      :disabled="props.item.rcn || !sqlUi.columnEditable(props.item)"
                      v-model="props.item.cn"
                      :rules="form.validation.required"
                      label="Edit"
                      single-line
                    ></v-text-field>
                  </template>
                </v-edit-dialog>
                <span v-else @click="onFKShowWarning">{{ props.item.cn }}</span>
              </div>
            </td>
            <td class="pa-0">
              <v-autocomplete
                :disabled="!sqlUi.columnEditable(props.item)"
                v-if="!props.item.rcn"
                class="body-2 mt-n1"
                :full-width="false"
                v-model="props.item.dt"
                :items="dataTypes"
                @change="onDataTypeChange(props.item,props.index)"
                dense
                hide-details
                v-ge="['columns','dt']"
              ></v-autocomplete>

              <span v-else @click="onFKShowWarning">{{ props.item.dt }}</span>
            </td>
            <td class="pa-0">
              <v-autocomplete
                :disabled="!sqlUi.columnEditable(props.item)"
                class="body-2 mt-n1"
                :full-width="false"
                v-model="props.item.uidt"
                :items="uiDataTypes"
                @change="onUiDataTypeChange(props.item)"
                dense
                hide-details
                v-ge="['columns','dt']"
              ></v-autocomplete>

            </td>
            <td>
              <v-edit-dialog
                v-if="!props.item.rcn"
                lazy
                @cancel="savePrecision(props.item)"
                @close="savePrecision(props.item)">
                {{ props.item.dtxp }}
                <template v-slot:input>
                  <v-text-field
                    :disabled="sqlUi.getDefaultLengthIsDisabled(props.item.dt) || !sqlUi.columnEditable(props.item)"
                    v-model="props.item.dtxp"
                    :rules="[max25chars]"
                    label="Edit"
                    single-line
                    v-ge="['columns','precision']"
                  ></v-text-field>
                </template>
              </v-edit-dialog>
              <span v-else @click="onFKShowWarning">{{ props.item.dtxp }}</span>
            </td>
            <td :style="props.item.rcn? 'padding:0' : ''">

              <template v-if="!props.item.rcn">
                <v-edit-dialog
                  v-if="showScale(props.item)"
                  lazy
                  @cancel="saveScale(props.item)"
                  @close="saveScale(props.item)"
                >
                  {{ props.item.dtxs }}
                  <template v-slot:input>
                    <v-text-field
                      :disabled="!sqlUi.columnEditable(props.item)"
                      v-model="props.item.dtxs"
                      :rules="[max25chars]"
                      label="Edit"
                      single-line
                      v-ge="['columns','scale']"
                    ></v-text-field>
                  </template>
                </v-edit-dialog>
              </template>
              <div style="width: 100%;height:100%" v-else @click="onFKShowWarning">{{
                  props.item.dtxs || ''
                }}
              </div>
            </td>
            <td>
              <v-checkbox
                hide-details
                :disabled="!sqlUi.columnEditable(props.item)"
                v-if="!props.item.rcn"
                @change="onCheckboxChangePk(props.item)"
                solo
                dense
                height="44"
                color="primary lighten-1"
                v-model="props.item.pk"
                v-ge="['columns','pk']"
              ></v-checkbox>
              <v-checkbox
                hide-details
                :disabled="!sqlUi.columnEditable(props.item)"
                v-else
                @click.stop="onFKShowWarning"
                solo
                dense
                height="44"
                color="primary lighten-1"
                v-model="props.item.pk"
                v-ge="['columns','pk']"
              ></v-checkbox>
            </td>
            <td>
              <v-checkbox
                hide-details
                v-if="!props.item.rcn"
                @change="onCheckboxChangeNN(props.item)"
                solo
                dense
                color="primary lighten-1"
                :disabled="props.item.pk || !sqlUi.columnEditable(props.item)"
                v-model="props.item.rqd"
                v-ge="['columns','nn']"
              ></v-checkbox>

              <v-checkbox
                hide-details
                :disabled="!sqlUi.columnEditable(props.item)"
                v-else
                @click.stop="onFKShowWarning"
                solo
                dense
                color="primary lighten-1"
                v-model="props.item.rqd"
                v-ge="['columns','nn']"
              ></v-checkbox>

            </td>
            <td>
              <v-checkbox
                hide-details
                v-if="!props.item.rcn"
                :disabled="colPropUNDisabled(props.item) || !sqlUi.columnEditable(props.item)"
                @change="onCheckboxChangeUN(props.item)"
                solo
                dense
                color="primary lighten-1"
                v-model="props.item.un"
                v-ge="['columns','un']"
              ></v-checkbox>
              <v-checkbox
                hide-details
                v-else
                :disabled="colPropUNDisabled(props.item) || !sqlUi.columnEditable(props.item)"
                @click.stop="onFKShowWarning"
                solo
                dense
                color="primary lighten-1"
                v-model="props.item.un"
                v-ge="['columns','un']"
              ></v-checkbox>
            </td>
            <td>
              <v-checkbox
                hide-details
                v-if="!props.item.rcn"
                :disabled="colPropAIDisabled(props.item) || !sqlUi.columnEditable(props.item)"
                @change="onCheckboxChangeAI(props.item)"
                solo
                dense
                color="primary lighten-1"
                v-model="props.item.ai"
                v-ge="['columns','ai']"
              ></v-checkbox>
              <v-checkbox
                v-else
                :disabled="colPropAIDisabled(props.item) || !sqlUi.columnEditable(props.item)"
                @click.stop="onFKShowWarning"
                solo
                dense
                color="primary lighten-1"
                v-model="props.item.ai"
                v-ge="['columns','ai']"
              ></v-checkbox>
            </td>
            <td>
              <v-checkbox
                hide-details
                :disabled=" sqlUi.colPropAuDisabled(props.item) || !sqlUi.columnEditable(props.item)"
                @change="onCheckboxChangeAU(props.item)"
                solo
                dense
                color="primary lighten-1"
                v-model="props.item.au"
                v-ge="['columns','au']"
              ></v-checkbox>
            </td>

            <td>
              <p v-if="props.item.rtn" row wrap class="mb-0">
                {{ props.item.rtn }}
                <x-icon small @click="createNewOrEditRelation(props.item)"
                        color="primary"
                        :disabled="!sqlUi.columnEditable(props.item)"
                        v-ge="['columns','fk-edit']"
                >mdi-table-edit
                </x-icon
                >
                <x-icon small
                        :disabled="!sqlUi.columnEditable(props.item)"
                        @click="deleteRelation('showDialog', props.item)"
                        color="error"
                        v-ge="['columns','fk-delete']"
                >mdi-delete-forever
                </x-icon
                >
                <span v-if="props.item.type=== 'virtual'" class="caption">(v)</span>
              </p>

              <x-icon
                v-else-if="!props.item.pk && props.item.altered!==1"
                color="primary grey"
                small
                :disabled="!sqlUi.columnEditable(props.item)"
                @click="createNewOrEditRelation(props.item)"
                v-ge="['columns','fk-add']"
              >add
              </x-icon>

              <v-icon
                v-else
                disabled
                small
                color="grey"
                v-ge="['columns','fk-add']"
              >add
              </v-icon>

            </td>
            <td :style="props.item.rcn? 'padding:0' : ''">
              <v-edit-dialog
                v-if="!props.item.rcn"
                :return-value.sync="props.item.cdf"
                large
                lazy
                persistent
                :value="true"
                @save="saveDefaultValue(props.item)"
                @cancel="cancel"
                @open="open"
                @close="close"
                class="caption"
              >
                <!--                <div v-if="props.item.rqd">{{ props.item.cdf }}</div>-->
                <div v-if="props.item.pk"></div>
                <div v-else-if="!props.item.cdf && !props.item.rqd" class="caption">NULL</div>
                <div v-else class="caption">{{ props.item.cdf }}</div>
                <template v-slot:input>
                  <div class="mt-3 title">Update Column Default</div>
                </template>
                <template v-slot:input>
                  <v-textarea
                    :disabled="!sqlUi.columnEditable(props.item)"
                    v-model="props.item.cdf"
                    label="Edit"
                    counter
                    class="caption"
                    :placeholder="`${sqlUi.getDefaultValueForDatatype(props.item.dt)}`"
                    autofocus
                    v-ge="['columns','default']"
                  ></v-textarea>
                </template>
              </v-edit-dialog>
              <div style="width: 100%;height:100%" v-else @click="onFKShowWarning">{{ props.item.cdf }}</div>
            </td>
            <td>
              <v-hover
                v-if="!props.item.rcn" v-slot:default="{ hover }">
                <v-icon
                  :color="hover ? 'error' : 'grey'"
                  small
                  :disabled="!sqlUi.columnEditable(props.item)"
                  @click="deleteColumn('showDialog', props.index, props.item)"
                  v-ge="['columns','delete']"
                >mdi-delete-forever
                </v-icon
                >
              </v-hover>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>

    <addRelationDlg
      v-if="dialogShow"
      :nodes="nodes"
      :column="selectedColForNewRelation"
      heading="Relation Column "
      :dialogShow="dialogShow"
      :mtdDialogSubmit="mtdNewRelationDlgSubmit"
      :mtdDialogCancel="mtdNewRelationDlgCancel"
    />

    <span v-else></span>
    <dlgLabelSubmitCancel
      type="primary"
      v-if="columnDeleteDlg"
      :dialogShow="columnDeleteDlg"
      :actionsMtd="deleteColumn"
      heading="Click Submit to Delete the Column"
    />
    <dlgLabelSubmitCancel
      type="primary"
      v-if="relationDeleteDlg"
      :dialogShow="relationDeleteDlg"
      :actionsMtd="deleteRelation"
      heading="Click Submit to Delete the Relation"
    />
    <jsonToColumn
      :show.sync="showJsonToColumDlg"
      @load="loadJsonColumn"
    />
  </div>
</template>

<script>
import {mapGetters, mapActions} from "vuex";
import addRelationDlg from "../dlgs/dlgAddRelation.vue";
import dlgLabelSubmitCancel from "../../utils/dlgLabelSubmitCancel.vue";

import {SqlUI} from '../../../helpers/SqlUiFactory';
import jsonToColumn from "./columnActions/jsonToColumn";
import JSON5 from 'json5';
import uiTypes from "@/components/project/spreadsheet/helpers/uiTypes";

// const {path} = require("electron").remote.require(
//   "./libs"
// );

export default {
  components: {addRelationDlg, dlgLabelSubmitCancel, jsonToColumn},
  data() {
    return {
      showJsonToColumDlg: false,
      paginationLength: [20, 50, -1],
      form: {
        validation: {
          required: [v => !!v || 'Required']
        }
      },
      progress: {
        save: false,
        deleteTable: false,
        refresh: false
      },
      edited: false,
      columnDeleteDlg: false,
      selectedColForDelete: null,
      relationDeleteDlg: false,
      selectedColForRelationDelete: null,
      columns: [],
      dataTypes: [],
      uiDataTypes: [],
      headers: [
        {
          text: "Column", title: 'Column name', value: "cn",
          sortable: false,
          width: "1%"
        },
        {text: "Data Type", title: 'Data Type', value: "dt", sortable: false, width: "10%"},
        {text: "UI Type", title: 'UI Type', value: "uidt", sortable: false, width: "10%"},
        // {text: "Type",title:', value: "dt", sortable: false, width: "10%"},
        {text: "Length/Values", title: 'Length/Values', value: "dt", sortable: false, width: "5%"},
        {text: "Scale", title: 'Scale', value: "dt", sortable: false, width: "5%"},
        {text: "PK", title: 'Primary Key', value: "pk", sortable: false, width: "1%"},
        {text: "NN", title: 'Not NULL', value: "rqd", sortable: false, width: "1%"},
        {text: "UN", title: 'Unsigned', value: "unsigned", sortable: false, width: "1%"},
        {text: "AI", title: 'Auto Increment', value: "ai", sortable: false, width: "1%"},
        {text: "AU", title: 'Auto Update Timestamp', value: "", sortable: false, width: "1%"},
        {text: "FK", title: 'Foreign Key', value: "", sortable: false, width: "20%"},
        {
          text: "Default", title: 'Default Value', value: "cdf",
          sortable: false,
          width: "10%"
        },
        {text: "", title: 'Action', value: "", sortable: false, width: "1%"}
      ],
      max25chars: v => (v + '').length <= 150 || "Input too long!",
      dialogShow: false,
      selectedColForNewRelation: null,
      loading: true
    };
  },
  methods: {
    async saveAndScaffold() {
      await this.applyChanges();
      await this.scaffold();
    },
    async saveAndScaffoldModel() {
      await this.applyChanges();
      await this.scaffold({model: true});
    },
    async scaffold(scaffold = null) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          null,
          "projectGenerateBackend",
          {
            env: 'dev',
            tn: this.nodes.tn,
            scaffold
          }
        ]);
      } catch (e) {
        console.log(e)
      }
    },
    async saveAndScaffoldGql() {
      await this.applyChanges();
      await this.scaffoldGql();
    },
    async saveAndScaffoldModelGql() {
      await this.applyChanges();
      await this.scaffoldGql({model: true});
    },
    async scaffoldGql(scaffold = null) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          null,
          "projectGenerateBackendGql",
          {
            env: 'dev',
            tn: this.nodes.tn,
            scaffold
          }
        ]);
      } catch (e) {
      }
    },
    async handleKeyDown({metaKey, key, altKey, shiftKey, ctrlKey}) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([this._isMac ? metaKey : ctrlKey, key].join('_')) {
        case 'true_s' :
          await this.applyChanges();
          break;
        case 'true_l' :
          await this.loadColumnList();
          break;
        case 'true_n' :
          this.addColumn();
          break;
        case 'true_d' :
          await this.deleteTable('showDialog');
          break;

      }
    },
    loadJsonColumn(jsonString) {

      try {
        const columns = this.sqlUi.getColumnsFromJson(JSON5.parse(jsonString), this.nodes.tn);
        let dup = columns.find(col => this.columns.some(exCol => exCol.cn === col.cn));
        if (!dup) {
          this.columns = [...this.columns, ...columns];
          this.showJsonToColumDlg = false;
          this.edited = true;
          this.$toast.info(`${columns.length} column${columns.length > 1 ? 's' : ''} added`).goAway(3000)
        } else {
          this.$toast.error(`Duplicate column found : ${dup.cn}`).goAway(3000)
        }
      } catch (e) {
        console.log(e)
        this.$toast.error('Invalid JSON string').goAway(3000)
      }
    },
    getColumnIcon(column) {
      if (column.pk) {
        return 'mdi-key'
      } else if (column.rcn) {
        return 'mdi-link-variant'
      } else {
        return 'mdi-gate-or'
      }
    },
    onFKShowWarning() {
      this.$toast.error("COLUMN property with foreign key mapped can't be edited. Remove foreign key to edit.").goAway(3000)
    },


    ...mapActions({
      loadTablesFromChildTreeNode: "project/loadTablesFromChildTreeNode"
    }),
    onCheckboxChange() {
      this.edited = true;
    },

    onCheckboxChangePk(col) {

      this.edited = true;
      col.altered = col.altered || 2;

      if (!col.pk && col.ai) {
        col.ai = false;
      } else if (col.pk) {
        col.rqd = true;
      }

      col.cdf = null;
      col.rqd = true;

    },
    colPropAIDisabled(col) {
      return this.sqlUi.colPropAIDisabled(col, this.columns);

    },

    colPropUNDisabled(col) {
      return this.sqlUi.colPropUNDisabled(col);

    },


    onCheckboxChangeAI(col) {
      this.sqlUi.onCheckboxChangeAI(col);

      this.edited = true;
    },

    onCheckboxChangeAU(col) {
      this.sqlUi.onCheckboxChangeAU(col);
      this.edited = true;
    },

    onCheckboxChangeNN(col) {
      col.altered = col.altered || 2;
      this.edited = true;
    },

    onCheckboxChangeUN(col) {
      col.altered = col.altered || 2;
      this.edited = true;
    },


    onUiDataTypeChange(column) {
      this.edited = true;
      column.altered = column.altered || 2
    },
    onDataTypeChange(column, index) {

      this.edited = true;
      column.altered = column.altered || 2;
      column.rqd = false;
      column.pk = false;
      column.ai = false;
      column.cdf = null;
      column.dtxp = this.sqlUi.getDefaultLengthForDatatype(column.dt);
      column.dtxs = this.sqlUi.getDefaultScaleForDatatype(column.dt);

      column.dtx = 'specificType';

      console.log('data type changed', index, column);

      this.$set(column, 'uidt', this.sqlUi.getUIType(column));

    },
    async loadColumnList() {
      this.loading = true;
      this.$store.commit('notification/MutToggleProgressBar', true);
      try {
        this.edited = false;
        if (this.newTable) {
          this.columns = this.sqlUi.getNewTableColumns();
          return;
        }

        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'columnList', {
          tn: this.nodes.tn
        }]);
        const columns = result.data.list;

        const relations = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcRelationList', {
          tn: this.nodes.tn
        }]);


        for (let i = 0; i < relations.length; i++) {
          const relation = relations[i];
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];

            if (column.cn === relation.cn) {
              columns[i] = {...column, ...relation};
            }
          }
        }

        this.columns = JSON.parse(JSON.stringify(columns));
        this.originalColumns = [...columns];


      } catch (e) {
        console.log(e);
        this.$toast.error('Error loading columns :' + e).goAway(4000);
        throw e;
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false);
        this.loading = false;
      }

    },
    async loadUiDataTypes() {
      this.uiDataTypes = uiTypes;
    },
    async loadDataTypes() {
      try {
        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'getKnexDataTypes', {}])

        this.dataTypes = result.data.list;
      } catch (e) {
        this.$toast.error('Error loading datatypes :' + e).goAway(4000);
        throw e;
      }
    },
    saveColumnName(col, v) {
      this.edited = true;
      col.altered = col.altered || 8;
      this.snack = true;
    },
    save(col) {
      this.edited = true;
      col.altered = col.altered || 2;
      this.snack = true;
    },
    cancel() {
      this.snack = true;
    },
    open() {
      this.snack = true;
    },
    close() {
      console.log("Dialog closed");
    },

    saveDefaultValue(col) {
      this.edited = true;
      col.altered = col.altered || 2;
      this.snack = true;
    },
    savePrecision(col) {
      console.log(col);
      col.altered = col.altered || 2;
      this.edited = true;
      this.snack = true;
    },
    cancelPrecision() {
      this.snack = true;
    },
    openPrecision() {
      this.snack = true;
    },
    closePrecision() {
      console.log("Dialog closed");
    },
    showScale(columnObj) {
      return this.sqlUi.showScale(columnObj);
    },
    saveScale(col) {
      col.altered = col.altered || 2;
      this.edited = true;
      this.snack = true;
    },
    cancelScale() {
      this.snack = true;
    },
    openScale() {
      this.snack = true;
    },
    closeScale() {
      console.log("Dialog closed");
    },
    removeUnsigned(columns) {
      this.sqlUi.removeUnsigned(columns);
    },
    async reload() {
      await this.loadColumnList();
    },
    addColumn() {
      this.edited = true;
      this.columns.push(this.sqlUi.getNewColumn(this.columns.length));
      this.scrollAndFocusLastRow();
    },
    async deleteColumn(action = "", index, column) {

      try {
        if (action === "showDialog") {
          this.columnDeleteDlg = true;
          this.selectedColForDelete = {index, column};
        } else if (action === "hideDialog") {
          this.columnDeleteDlg = false;
        } else {
          if (this.columns[this.selectedColForDelete.index].altered === 1) {
            //newly added column no need to remove from db
            this.columns.splice(this.selectedColForDelete.index, 1);
          } else {
            const columns = JSON.parse(JSON.stringify(this.columns));
            columns[this.selectedColForDelete.index].altered = 4;
            await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            }, "tableUpdate", {
              tn: this.nodes.tn,
              originalColumns: this.originalColumns,
              columns: columns
            }]);
            this.columns.splice(this.selectedColForDelete.index, 1);
            this.$toast.success('Column deleted successfully').goAway(3000);
          }
          this.columnDeleteDlg = false;
          this.selectedColForDelete = null;
        }
      } catch (e) {
        console.log(e);
        this.$toast.error('Error while deleting column : ' + e).goAway(3000);
        throw e;
      }

    },

    async applyChangesDirect() {
      try {
        if (this.newTable) {
          await this.saveAndScaffold();
        } else if (this.edited) {
          await this.saveAndScaffoldModel();
        }
      } catch (e) {
        console.log(e);
        this.$toast.error('Error while saving table : ' + e).goAway(3000);
        throw e;
      }
    },
    async applyChangesDirectGql() {
      try {
        if (this.newTable) {
          await this.saveAndScaffoldGql();
        } else if (this.edited) {
          await this.saveAndScaffoldModelGql();
        }
      } catch (e) {
        console.log(e);
        this.$toast.error('Error while saving table : ' + e).goAway(3000);
        throw e;
      }
    },
    async applyChanges() {

      try {
        this.progress.save = true;
        if (this.newTable) {
          this.removeUnsigned(this.columns);
          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "tableCreate",
            {
              tn: this.nodes.tn,
              columns: this.columns
            }]);
          this.mtdNewTableUpdate(false);
          await this.loadTablesFromChildTreeNode({
            _nodes: {
              ...this.nodes
            }
          });
        } else if (this.edited) {
          console.log("this.columns[index].altered before", this.columns);
          this.removeUnsigned(this.columns);
          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, "tableUpdate", {
            tn: this.nodes.tn,
            originalColumns: this.originalColumns,
            columns: this.columns
          }]);
          console.log("update table result", result);
        }
        await this.loadColumnList();

      } catch (e) {
        console.log(e);
        this.$toast.error('Error while saving table : ' + e).goAway(3000);
      }

      this.progress.save = false;

    },
    createNewOrEditRelation(column) {
      console.log(column);
      this.selectedColForNewRelation = {...column};
      this.dialogShow = true;
    },
    async mtdNewRelationDlgSubmit(relationObject) {
      try {
        if (relationObject.updateRelation) {
          //update existing relation
          alert("Not Implemented yet");
        } else {
          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            relationObject.type === 'real' ? "relationCreate" : 'xcVirtualRelationCreate',
            relationObject
          ]);
          console.log("relationCreate result: ", result);
        }

        // await this.scaffold();
        await this.loadColumnList();
        this.selectedColForNewRelation = null;
        this.dialogShow = false;

        this.$toast.success('Foreign Key created successfully').goAway(3000);

      } catch (error) {
        console.log(error)
        this.$toast.error('Foreign Key relation creation failed ' + error).goAway(4000);
        console.error("relationCreate error: ", error);
        throw error;
      }
    },
    mtdNewRelationDlgCancel() {
      this.dialogShow = false;
      this.selectedColNameForNewRelation = "";
    },
    async deleteRelation(action = "", column) {

      try {
        if (action === "showDialog") {
          this.relationDeleteDlg = true;
          this.selectedColForRelationDelete = column;
        } else if (action === "hideDialog") {
          this.relationDeleteDlg = false;
          this.selectedColForRelationDelete = null;
        } else {
          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            this.selectedColForRelationDelete.type === 'virtual' ? 'xcVirtualRelationDelete' : "relationDelete",
            {
              childColumn: this.selectedColForRelationDelete.cn,
              childTable: this.nodes.tn,
              parentTable: this.selectedColForRelationDelete
                .rtn,
              parentColumn: this.selectedColForRelationDelete
                .rcn,
            }
          ]);
          console.log("relationDelete result ", result);
          await this.loadColumnList();
          this.relationDeleteDlg = false;
          this.selectedColForRelationDelete = null;
          this.$toast.success('Foreign Key deleted successfully').goAway(3000);
        }

      } catch (e) {
        console.log(e);
        this.$toast.error('Foreign key relation delete failed' + e).goAway(3000);
        throw e;
      }

    },
    scrollAndFocusLastRow() {
      this.$nextTick(() => {
        document.querySelector('.project-container').scrollTop = 9999;
        const menuActivator = this.$refs.column && this.$refs.column.querySelector('.v-small-dialog__activator__content');
        if (menuActivator) {
          this.$refs.column.querySelector('.v-small-dialog__activator__content').click();
          this.$nextTick(() => {
            const inputField = document.querySelector('.menuable__content__active input');
            inputField && inputField.select()
          })
        }
      })
    }
  },
  computed: {
    ...mapGetters({
      sqlMgr: "sqlMgr/sqlMgr",
      currentProjectFolder: "project/currentProjectFolder",
      projectIsGraphql: "project/GtrProjectIsGraphql",
      isNoApis: "project/GtrProjectIsNoApis",
      isMvc: "project/GtrIsMvc",
    })
  },

  beforeCreated() {
  },
  async created() {

    this.sqlUi = SqlUI.create(this.nodes.dbConnection);

    try {
      this.loading = true;
      this.loadDataTypes();
      this.loadUiDataTypes();
      await this.loadColumnList();
    } catch (e) {
      throw e;
    } finally {
      this.loading = false;
    }

  },
  mounted() {

  },
  beforeDestroy() {
  },
  destroy() {
  },
  validate({params}) {
    return true;
  },
  head() {
    return {};
  },
  props: ["nodes", "newTable", "mtdNewTableUpdate", "deleteTable", "isMetaTable"],
  watch: {},
  directives: {}
};
</script>

<style scoped>
/* to apply 6-9 columns */
/deep/ .column-table td:nth-child(n+5):not(:nth-child(n+10)),
/deep/ .column-table th:nth-child(n+5):not(:nth-child(n+10)) {
  width: 30px;
  padding: 0;
}

</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
