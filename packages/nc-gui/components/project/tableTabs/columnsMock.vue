<template>
  <div class="">
    <p>Mock</p>
    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-toolbar-title>
        <v-breadcrumbs
          :items="[{
                     text: nodes.env,
                     disabled: true,
                     href: '#'
                   },{
                     text: nodes.dbAlias,
                     disabled: true,
                     href: '#'
                   },
                   {
                     text: nodes.table_name + ' (table)',
                     disabled: true,
                     href: '#'
                   }]"
          divider=">"
          small
        >
          <template #divider>
            <v-icon small color="grey lighten-2">
              forward
            </v-icon>
          </template>
        </v-breadcrumbs>
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        color="primary"
        small
        @click="loadColumnList"
      >
        <v-icon left>
          refresh
        </v-icon>
        Refresh
      </v-btn>
      <v-btn
        color="primary"
        class="primary"
        small
        @click="addColumn"
      >
        New Column
      </v-btn>

      <v-btn
        color="primary"
        class="primary"
        small
        :disabled="!edited && !newTable"
        @click="applyChanges"
      >
        <!-- Save &nbsp; -->
        {{ $t('general.save') }}
        <v-progress-circular
          v-if="progress.save"
          :indeterminate="progress.save"
          :size="20"
          color="secondary"
        />
      </v-btn>
      <v-btn
        small
        color="error "
        class="error text-right"
        @click="deleteTable('showDialog')"
      >
        {{ $t('activity.deleteTable') }} &nbsp;

        <v-progress-circular
          v-if="progress.deleteTable"
          :indeterminate="progress.deleteTable"
          :size="20"
          color="secondary"
        />
      </v-btn>
      <v-btn
        icon
        class="text-right"
      >
        <v-icon>mdi-help-circle-outline</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card style="">
      <v-data-table
        dense
        :headers="headers"
        :items="columns"
        hide-default-header
        footer-props.items-per-page-options="30"
        class="elevation-20 column-table"
      >
        <template #header="{props:{headers}}">
          <th v-for="header in headers" :key="header.title" class="pt-2 pb-0">
            <v-tooltip bottom>
              <template #activator="{ on }">
                <span v-on="on">{{ header.text }}</span>
              </template>
              <span>{{ header.title }}</span>
            </v-tooltip>
          </th>
        </template>

        <template #item="props">
          <tr :disabled="nodes.table_name==='_evolutions' || nodes.table_name==='nc_evolutions'">
            <td>
              <v-edit-dialog
                :return-value.sync="props.item.column_name"
                @save="saveColumnName(props.item)"
                @cancel="cancel"
                @open="open"
                @close="close"
              >
                {{ props.item.column_name }}
                <template #input>
                  <v-text-field
                    v-model="props.item.column_name"
                    :disabled="props.item.rcn"
                    :rules="[max25chars]"
                    :label="$t('general.edit')"
                    single-line
                  />
                </template>
              </v-edit-dialog>
            </td>
            <td>
              <!--              <v-autocomplete-->
              <!--                :full-width="false"-->
              <!--                v-model="props.item.dtx"-->
              <!--                :items="dataTypes"-->
              <!--                @change="onDataTypeChange(props.item,props.index)"-->
              <!--                dense-->
              <!--              ></v-autocomplete>-->
              <v-autocomplete
                v-model="props.item.dt"
                :full-width="false"
                :items="dataTypes"
                dense
                @change="onDataTypeChange(props.item,props.index)"
              />
            </td>
            <!--            <td>-->
            <!--              <v-edit-dialog-->
            <!--                :return-value.sync="props.item.data_type_x_specific"-->
            <!--                lazy-->
            <!--                @save="save"-->
            <!--                @cancel="cancel"-->
            <!--                @open="open"-->
            <!--                @close="close"-->
            <!--                v-if="props.item.dtx==='specificType'"-->
            <!--              >-->
            <!--                {{ props.item.ct}}-->
            <!--                <template v-slot:input>-->
            <!--                  <v-text-field-->
            <!--                    v-model="props.item.ct"-->
            <!--                    :rules="[max25chars]"-->
            <!--                    label="Edit"-->
            <!--                    single-line-->
            <!--                  ></v-text-field>-->
            <!--                </template>-->
            <!--              </v-edit-dialog>-->
            <!--            </td>-->
            <td>
              <v-edit-dialog
                v-if="props.item.dtxp"
                :return-value.sync="props.item.dtxp"
                lazy
                @save="savePrecision(props.item)"
                @cancel="cancelPrecision"
                @open="openPrecision"
                @close="closePrecision"
              >
                {{ props.item.dtxp }}
                <template #input>
                  <v-text-field
                    v-model="props.item.dtxp"
                    :rules="[max25chars]"
                    :label="$t('general.edit')"
                    single-line
                  />
                </template>
              </v-edit-dialog>
            </td>
            <td>
              <v-edit-dialog
                v-if="props.item.dtxs"
                :return-value.sync="props.item.dtxs"
                lazy
                @save="saveScale(props.item)"
                @cancel="cancelScale"
                @open="openScale"
                @close="closeScale"
              >
                {{ props.item.dtxs }}
                <template #input>
                  <v-text-field
                    v-model="props.item.dtxs"
                    :rules="[max25chars]"
                    :label="$t('general.edit')"
                    single-line
                  />
                </template>
              </v-edit-dialog>
            </td>
            <td>
              <v-checkbox
                v-model="props.item.pk"
                solo
                height="44"
                color=""
                @change="onCheckboxChangePk(props.item)"
              />
            </td>
            <td>
              <v-checkbox
                v-model="props.item.rqd"
                solo
                color=""
                @change="onCheckboxChangeNN(props.item)"
              />
            </td>
            <td>
              <v-checkbox
                v-model="props.item.un"
                :disabled="colPropUNDisabled(props.item)"
                solo
                color=""
                @change="onCheckboxChangeUN(props.item)"
              />
            </td>
            <td>
              <v-checkbox
                v-model="props.item.ai"
                :disabled="colPropAIDisabled(props.item)"
                solo
                color=""
                @change="onCheckboxChangeAI(props.item)"
              />
            </td>

            <td>
              <p v-if="props.item.rtn" row wrap>
                {{ props.item.rtn }}
                <v-icon
                  small
                  @click="createNewOrEditRelation(props.item)"
                >
                  mdi-table-edit
                </v-icon>
                <v-icon
                  small
                  color="error"
                  @click="deleteRelation('showDialog', props.item)"
                >
                  mdi-delete-forever
                </v-icon>
              </p>

              <v-icon
                v-else-if="!props.item.pk"
                color=""
                @click="createNewOrEditRelation(props.item)"
              >
                add
              </v-icon>

              <v-icon
                v-else
                disabled
                color="grey"
              >
                add
              </v-icon>
            </td>
            <td>
              <v-edit-dialog
                :return-value.sync="props.item.cdf"
                large
                lazy
                persistent
                @save="saveDefaultValue(props.item)"
                @cancel="cancel"
                @open="open"
                @close="close"
              >
                <!--                <div v-if="props.item.rqd">{{ props.item.cdf }}</div>-->
                <div v-if="props.item.pk" />
                <div v-else-if="!props.item.cdf && !props.item.rqd">
                  NULL
                </div>
                <div v-else>
                  {{ props.item.cdf }}
                </div>
                <!--                <template #input>-->
                <!--                  <div class="mt-3 title">-->
                <!--                    Update column_default-->
                <!--                  </div>-->
                <!--                </template>-->
                <template #input>
                  <v-text-field
                    v-model="props.item.cdf"
                    :label="$t('general.edit')"
                    single-line
                    counter
                    autofocus
                  />
                </template>
              </v-edit-dialog>
            </td>
            <td>
              <v-icon
                color="error"
                icon
                @click="deleteColumn('showDialog', props.index, props.item)"
              >
                mdi-delete-forever
              </v-icon>
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
      :dialog-show="dialogShow"
      :mtd-dialog-submit="mtdNewRelationDlgSubmit"
      :mtd-dialog-cancel="mtdNewRelationDlgCancel"
    />
    <span v-else />
    <dlgLabelSubmitCancel
      v-if="columnDeleteDlg"
      type="primary"
      :dialog-show="columnDeleteDlg"
      :actions-mtd="deleteColumn"
      heading="Click Submit to Delete the Column"
    />
    <dlgLabelSubmitCancel
      v-if="relationDeleteDlg"
      type="primary"
      :dialog-show="relationDeleteDlg"
      :actions-mtd="deleteRelation"
      heading="Click Submit to Delete the Relation"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import addRelationDlg from '../dlgs/dlgAddRelation.vue'
import dlgLabelSubmitCancel from '../../utils/dlgLabelSubmitCancel.vue'

export default {
  components: { addRelationDlg, dlgLabelSubmitCancel },
  data() {
    return {
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
      headers: [
        {
          text: 'Column',
          title: 'Column name',
          value: 'cn',
          sortable: false,
          width: '1%'
        },
        { text: 'Data Type', title: 'Data Type', value: 'dt', sortable: false, width: '10%' },
        // {text: "Type",title:', value: "dt", sortable: false, width: "10%"},
        { text: 'Length/Values', title: 'Length/Values', value: 'dt', sortable: false, width: '10%' },
        { text: 'Scale', title: 'Scale', value: 'dt', sortable: false, width: '10%' },
        { text: 'PK', title: 'Primary Key', value: 'pk', sortable: false, width: '1%' },
        { text: 'NN', title: 'Not NULL', value: 'rqd', sortable: false, width: '1%' },
        { text: 'UN', title: 'Unsigned', value: 'unsigned', sortable: false, width: '1%' },
        { text: 'AI', title: 'Auto Increment', value: 'ai', sortable: false, width: '1%' },
        { text: 'Foreign Key', title: 'Foreign Key', value: '', sortable: false, width: '20%' },
        {
          text: 'Default',
          title: 'Default Value',
          value: 'cdf',
          sortable: false,
          width: '10%'
        },
        { text: '', title: 'Action', value: '', sortable: false, width: '1%' }
      ],
      max25chars: v => v.length <= 150 || 'Input too long!',
      dialogShow: false,
      selectedColForNewRelation: null
    }
  },
  methods: {
    ...mapActions({
      loadTablesFromChildTreeNode: 'project/loadTablesFromChildTreeNode'
    }),
    async onCheckboxChange() {
      this.edited = true
    },

    async onCheckboxChangePk(col) {
      this.edited = true
      col.altered = col.altered || 2

      col.cdf = null
      col.rqd = true
    },
    colPropAIDisabled(col) {
      if (col.dtx === 'integer' ||
          col.dtx === 'bigInteger' ||
          col.dtx === 'specificType') {
        for (let i = 0; i < this.columns.length; ++i) {
          if (this.columns[i].column_name !== col.column_name && this.columns[i].ai) {
            return true
          }
        }
        return false
      } else {
        return true
      }
    },

    colPropUNDisabled(col) {
      if (col.dtx === 'integer' ||
          col.dtx === 'bigInteger' ||
          col.dt.includes('int')) {
        return false
      } else {
        return true
      }
    },

    onCheckboxChangeAI(col) {
      console.log(col)
      if (col.dt === 'int' || col.dt === 'bigint' || col.dt === 'smallint' || col.dt === 'tinyint') {
        col.altered = col.altered || 2
      }

      if (!col.ai) {
        col.dtx = 'specificType'
      } else {
        col.dtx = ''
      }

      this.edited = true
    },

    onCheckboxChangeNN(col) {
      col.altered = col.altered || 2
      this.edited = true
    },

    onCheckboxChangeUN(col) {
      col.altered = col.altered || 2
      this.edited = true
    },

    async onDataTypeChange(column, index) {
      this.edited = true
      column.altered = column.altered || 2
      column.rqd = false
      column.pk = false
      column.ai = false
      column.cdf = null
      column.dtxp = ' '
      column.dtxs = ' '

      column.dtx = 'specificType'

      console.log('data type changed', index, column)
    },
    async loadColumnList() {
      this.edited = false
      if (this.newTable) {
        this.columns = [
          {
            cn: 'id',
            dt: 'int',
            dtx: 'integer',
            ct: 'int(11)',
            nrqd: false,
            rqd: true,
            ck: false,
            pk: true,
            un: true,
            ai: true,
            cdf: null,
            clen: null,
            np: 10,
            ns: 0,
            // dp: null,
            // data_type_x_specific: '',
            dtxp: '10',
            dtxs: ''
          },
          {
            cn: 'title',
            dt: 'varchar',
            dtx: 'specificType',
            ct: 'varchar(45)',
            nrqd: true,
            rqd: false,
            ck: false,
            pk: false,
            un: false,
            ai: false,
            cdf: null,
            clen: 45,
            np: null,
            ns: null,
            // dp: null
            // data_type_x_specific: 'specificType',
            dtxp: '45',
            dtxs: ''
          }
        ]
        return
      }
      // console.log("env: this.nodes.env", this.nodes.env, this.nodes.dbAlias);
      // const client = await this.sqlMgr.projectGetSqlClient({
      //     env: this.nodes.env,
      //     dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.columnList({
      //     tn: this.nodes.table_name
      // });

      const result = await this.sqlMgr.sqlOp({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', {
        tn: this.nodes.table_name
      })

      console.log('table ', result.data.list)
      const columns = result.data.list

      // const relationsResult = await client.relationList({
      //     tn: this.nodes.table_name
      // });

      const relationsResult = await this.sqlMgr.sqlOp({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'relationList', {
        tn: this.nodes.table_name
      })

      const relations = relationsResult.data.list
      console.log('relations: ', relations)

      for (let i = 0; i < relations.length; i++) {
        const relation = relations[i]
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i]

          if (column.column_name === relation.column_name) {
            // column.rcn = relation.rcn;
            // column.rtn = relation.rtn;
            columns[i] = { ...column, ...relation }
          }
        }
      }

      this.columns = JSON.parse(JSON.stringify(columns))
      this.originalColumns = [...columns]
      console.log(this.columns)
    },
    async loadDataTypes() {
      const client = await this.sqlMgr.projectGetSqlClient({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      })
      const result = client.getKnexDataTypes()
      this.dataTypes = result.data.list
    },
    saveColumnName(col) {
      this.edited = true
      col.altered = col.altered || 8

      this.snack = true
      this.snackColor = 'success'
      this.snackText = 'Data saved'
    },
    save(col) {
      this.edited = true
      col.altered = col.altered || 2

      this.snack = true
      this.snackColor = 'success'
      this.snackText = 'Data saved'
    },
    cancel() {
      this.snack = true
      this.snackColor = 'error'
      this.snackText = 'Canceled'
    },
    open() {
      this.snack = true
      this.snackColor = 'info'
      this.snackText = 'Dialog opened'
    },
    close() {
      console.log('Dialog closed')
    },

    saveDefaultValue(col) {
      this.edited = true
      col.altered = col.altered || 2
      // col.rqd = false;

      this.snack = true
      this.snackColor = 'success'
      this.snackText = 'Data saved'
    },

    savePrecision(col) {
      console.log(col)
      col.altered = col.altered || 2
      this.edited = true
      this.snack = true
      this.snackColor = 'success'
      this.snackText = 'Data saved'
    },
    cancelPrecision() {
      this.snack = true
      this.snackColor = 'error'
      this.snackText = 'Canceled'
    },
    openPrecision() {
      this.snack = true
      this.snackColor = 'info'
      this.snackText = 'Dialog opened'
    },
    closePrecision() {
      console.log('Dialog closed')
    },

    saveScale(col) {
      if (col.dtx === 'float' || col.dtx === 'decimal' || col.dtx === 'specifcType') {
        col.altered = col.altered || 2
        this.edited = true
        this.snack = true
        this.snackColor = 'success'
        this.snackText = 'Data saved'
      }
    },
    cancelScale() {
      this.snack = true
      this.snackColor = 'error'
      this.snackText = 'Canceled'
    },
    openScale() {
      this.snack = true
      this.snackColor = 'info'
      this.snackText = 'Dialog opened'
    },
    closeScale() {
      console.log('Dialog closed')
    },

    removeUnsigned(columns) {
      for (let i = 0; i < columns.length; ++i) {
        if (columns[i].altered === 1 && (!(columns[i].dt === 'int' || columns[i].dt === 'bigint'))) {
          columns[i].un = false
          console.log('>> resetting unsigned value', columns[i].column_name)
        }
        console.log(columns[i].column_name)
      }
    },
    addColumn() {
      this.edited = true
      this.columns.push({
        cn: 'title' + this.columns.length,
        dt: 'int',
        dtx: 'specificType',
        ct: 'integer(10)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: 45,
        np: null,
        ns: null,
        // data_type_x_specific: ' ',
        dtxp: '10',
        dtxs: ' ',
        altered: 1
      })
    },
    async deleteColumn(action = '', index, column) {
      if (action === 'showDialog') {
        this.columnDeleteDlg = true
        this.selectedColForDelete = { index, column }
      } else if (action === 'hideDialog') {
        this.columnDeleteDlg = false
      } else {
        if (this.columns[this.selectedColForDelete.index].altered === 1) {
          // newly added column no need to remove fromd db
          this.columns.splice(this.selectedColForDelete.index, 1)
        } else {
          const columns = JSON.parse(JSON.stringify(this.columns))
          columns[this.selectedColForDelete.index].altered = 4
          await this.sqlMgr.sqlOpPlus(
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'tableUpdate',
            {
              tn: this.nodes.table_name,
              originalColumns: this.originalColumns,
              columns
            }
          )
          this.columns.splice(this.selectedColForDelete.index, 1)
        }
        this.columnDeleteDlg = false
        this.selectedColForDelete = null
      }
    },
    async applyChanges() {
      this.progress.save = true
      await this.sqlMgr.projectGetSqlClient({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      })
      if (this.newTable) {
        this.removeUnsigned(this.columns)
        // let result = await this.sqlMgr.sqlOpPlus(
        //   {
        //     env: this.nodes.env,
        //     dbAlias: this.nodes.dbAlias
        //   },
        //   "tableCreate",
        //   {
        //     tn: this.nodes.table_name,
        //     columns: this.columns
        //   }
        // );

        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableCreate',
        {
          tn: this.nodes.table_name,
          columns: this.columns
        }])
        // const result = await client.tableCreate({
        //   tn: this.nodes.table_name,
        //   columns: this.columns
        // });
        this.mtdNewTableUpdate(false)
        // console.log("result", result, this.nodes);
        await this.loadTablesFromChildTreeNode({
          _nodes: {
            ...this.nodes
          }
        })
      } else {
        console.log('this.columns[index].altered before', this.columns)
        // const result = await client.tableUpdate({
        //   tn: this.nodes.table_name,
        //   originalColumns: this.originalColumns,
        //   columns: this.columns
        // });
        this.removeUnsigned(this.columns)
        // let result = await this.sqlMgr.sqlOpPlus(
        //     {
        //         env: this.nodes.env,
        //         dbAlias: this.nodes.dbAlias
        //     },
        //     "tableUpdate",
        //     {
        //         tn: this.nodes.table_name,
        //         originalColumns: this.originalColumns,
        //         columns: this.columns
        //     }
        // );

        const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          'tableUpdate',
          {
            tn: this.nodes.table_name,
            originalColumns: this.originalColumns,
            columns: this.columns
          }])
        console.log('update table result', result)
      }
      this.progress.save = false
      await this.loadColumnList()
    },
    createNewOrEditRelation(column) {
      console.log(column)
      this.selectedColForNewRelation = { ...column }
      this.dialogShow = true
    },
    async mtdNewRelationDlgSubmit(relationObject) {
      try {
        await this.sqlMgr.projectGetSqlClient({
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        })

        if (relationObject.updateRelation) {
          // update existing relation
          alert('Not Implemented yet')
        } else {
          // const result = await client.relationCreate(relationObject);

          const result = await this.sqlMgr.sqlOpPlus(
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'relationCreate',
            relationObject
          )
          console.log('relationCreate result: ', result)
        }

        await this.loadColumnList()
        this.selectedColForNewRelation = null
        this.dialogShow = false
      } catch (error) {
        console.error('relationCreate error: ', error)
      }
    },
    mtdNewRelationDlgCancel() {
      this.dialogShow = false
      this.selectedColNameForNewRelation = ''
    },
    async deleteRelation(action = '', column) {
      if (action === 'showDialog') {
        this.relationDeleteDlg = true
        this.selectedColForRelationDelete = column
      } else if (action === 'hideDialog') {
        this.relationDeleteDlg = false
        this.selectedColForRelationDelete = null
      } else {
        await this.sqlMgr.projectGetSqlClient({
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        })

        // const result = await client.relationDelete({
        //   childColumn: column.column_name,
        //   childTable: this.nodes.table_name,
        //   parentTable: column.rtn,
        //   parentColumn: column.rcn,
        //   foreignKeyName: column.cstn
        // });
        const result = await this.sqlMgr.sqlOpPlus(
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          'relationDelete',
          {
            childColumn: this.selectedColForRelationDelete.column_name,
            childTable: this.nodes.table_name,
            parentTable: this.selectedColForRelationDelete
              .rtn,
            parentColumn: this.selectedColForRelationDelete
              .rcn,
            foreignKeyName: this.selectedColForRelationDelete.cstn
          }
        )
        console.log('relationDelete result ', result)
        await this.loadColumnList()
        this.relationDeleteDlg = false
        this.selectedColForRelationDelete = null
      }
    }
  },
  computed: { ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }) },

  beforeCreated() {
  },
  watch: {},
  async created() {
    await this.loadColumnList()
    this.loadDataTypes()
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  directives: {},
  validate({ params }) {
    return true
  },
  head() {
    return {}
  },
  props: ['nodes', 'newTable', 'mtdNewTableUpdate', 'deleteTable']
}
</script>

<style scoped>
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
