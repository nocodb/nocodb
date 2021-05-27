<template>
  <v-container fluid class="pa-0 ma-0" style="height: 100%">

    <v-alert v-if="error" type="error" class="ma-2">
      {{ error }}
    </v-alert>
    <template v-else>
      <v-tabs
        v-model="active"
        :height="relationTabs &&  relationTabs.length ?38:0"
        class="table-tabs"
        @change="onTabChange"
        color="pink"
      >
        <template v-if="_isUIAllowed('model')">
          <v-tab class="" v-show="false">
            <v-icon small>mdi-table-eye</v-icon>&nbsp;
            <span class="caption text-capitalize font-weight-bold"> Model</span></v-tab>
          <v-tab-item
                      style="height:100%">
            <v-tabs
              color="pink"
              height="38"
              class="table-tabs"
              ma-0
              pa-0
              style="height:100%">
              <v-tab ripple class="">
                <v-icon small>mdi-view-column</v-icon>&nbsp;
                <span class="caption font-weight-bold text-capitalize">Columns</span>
              </v-tab>


              <v-tab-item
                          style="height:100%">

                <columnList
                  ref="tabs0"
                  :nodes="this.nodes"
                  :newTable="this.newTableCopy"
                  :mtdNewTableUpdate="this.mtdNewTableUpdate"
                  :deleteTable="this.deleteTable"
                  :is-meta-table="isMetaTable"
                />
              </v-tab-item>


              <v-tab ripple class="" @click="loadIndexList = true">
                <v-icon small>mdi-blur</v-icon>&nbsp;
                <span class="caption font-weight-bold text-capitalize">Indexes</span>
              </v-tab>
              <v-tab-item :transition="false"
                          style="height:100%"
                          :reverse-transition="false">
                <indexList
                  ref="tabs1"
                  v-if="loadIndexList"
                  :nodes="this.nodes"
                  :newTable="this.newTableCopy"
                  :mtdNewTableUpdate="this.mtdNewTableUpdate"
                  :deleteTable="this.deleteTable"
                  :is-meta-table="isMetaTable"
                />
              </v-tab-item>

              <v-tab ripple class="" @click="loadTriggerList = true">
                <v-icon small>mdi-clock-in</v-icon>&nbsp;
                <span class="caption font-weight-bold text-capitalize"> Triggers</span>
              </v-tab>
              <v-tab-item
                          style="height:100%">
                <triggerList
                  ref="tabs2"
                  v-if="loadTriggerList"
                  :nodes="this.nodes"
                  :newTable="this.newTableCopy"
                  :mtdNewTableUpdate="this.mtdNewTableUpdate"
                  :deleteTable="this.deleteTable"
                  :is-meta-table="isMetaTable"

                />
              </v-tab-item>

              <!--      <v-tab ripple class="divider v-tab-border-right" @click="loadConstraintList = true">-->
              <!--        <v-icon small>mdi-view-column</v-icon>-->
              <!--        Constraints-->
              <!--      </v-tab>-->
              <!--      <v-tab-item :transition="false" >-->
              <!--        <constraintList-->
              <!--          v-if="loadConstraintList"-->
              <!--          :nodes="this.nodes"-->
              <!--          :newTable="this.newTableCopy"-->
              <!--          :mtdNewTableUpdate="this.mtdNewTableUpdate"-->
              <!--          :deleteTable="this.deleteTable"-->
              <!--        />-->
              <!--      </v-tab-item>-->


<!--            </v-tabs>-->


<!--          </v-tab-item>
        </template>
        <template v-if="_isUIAllowed('api')">
          <v-tab class="">
            <v-icon small>mdi-code-braces</v-icon>&nbsp;
            <span class="caption text-capitalize  font-weight-bold"> APIs</span></v-tab>
          <v-tab-item>-->
<!--            <v-tabs-->
<!--              height="38"-->
<!--              class="table-tabs"-->
<!--              ma-0-->
<!--              pa-0-->
<!--              style="height:100%">-->


              <template v-if="!isMvc && !isMetaTable">
                <template v-if="isRest">
                  <v-tab ripple class="">
                    <v-icon small>mdi-nodejs</v-icon>&nbsp;
                    <span class="caption font-weight-bold text-capitalize">Routes</span>

                  </v-tab>

                  <v-tab-item :transition="false">

                    <logic-rest
                      ref="tabs0"
                      :nodes="this.nodes"
                      :newTable="this.newTableCopy"
                      :mtdNewTableUpdate="this.mtdNewTableUpdate"
                      :deleteTable="this.deleteTable"
                      :is-meta-table="isMetaTable"
                    />
                  </v-tab-item>
                </template>
                <template v-if="isGraphql">

                  <v-tab ripple class="">
                    <v-icon small>mdi-graphql</v-icon>&nbsp;
                    <span class="caption font-weight-bold text-capitalize">Schema & Resolvers</span>
                  </v-tab>


                  <v-tab-item :transition="false">

                    <logic-gql
                      ref="tabs0"
                      :nodes="this.nodes"
                      :newTable="this.newTableCopy"
                      :mtdNewTableUpdate="this.mtdNewTableUpdate"
                      :deleteTable="this.deleteTable"
                      :is-meta-table="isMetaTable"
                    />
                  </v-tab-item>
                </template>
                <template v-if="isGrpc">
                  <v-tab ripple class="">
                    <v-icon small>mdi-nodejs</v-icon>&nbsp;
                    <span class="caption font-weight-bold text-capitalize">gRPC Services</span>
                  </v-tab>


                  <v-tab-item :transition="false">

                    <logic-grpc
                      ref="tabs0"
                      :nodes="this.nodes"
                      :newTable="this.newTableCopy"
                      :mtdNewTableUpdate="this.mtdNewTableUpdate"
                      :deleteTable="this.deleteTable"
                      :is-meta-table="isMetaTable"
                    />
                  </v-tab-item>
                </template>
              </template>


              <template v-if="!isMetaTable">

                <v-tab ripple class="">
                  <v-icon small>mdi-shield-edit-outline</v-icon>&nbsp;
                  <span class="caption font-weight-bold text-capitalize"> ACL</span>
                </v-tab>
                <v-tab-item :transition="false">
                  <table-acl
                    :nodes="nodes"
                    :newTable="this.newTableCopy"
                    :mtdNewTableUpdate="this.mtdNewTableUpdate"
                    :deleteTable="this.deleteTable"
                    :is-meta-table="isMetaTable"
                  />
                </v-tab-item>
                <!-- <template v-if="!isNoApis">
                   <v-tab ripple class="divider v-tab-border-right" >
                     <v-icon small>mdi-shield-edit-outline</v-icon>&nbsp;
                     <span class="caption font-weight-bold text-capitalize"> ACL</span>
                   </v-tab>
                   <v-tab-item :transition="false" >
                     <template v-if="isRest">
                       <acl-typeorm-db v-if="isPackage || isDocker" :nodes="nodes"></acl-typeorm-db>
                       <template v-else-if="isTs">
                         <acl-typeorm
                           v-if="isMvc"
                           ref="tabs4"
                           :nodes="this.nodes"
                         />
                       </template>
                       <template v-else>
                         <acl-js
                           ref="tabs4"
                           :nodes="this.nodes"
                         />
                       </template>
                     </template>

                     <template v-else-if="isGraphql">

                       <acl-ts-file-db-gql v-if="isPackage || isDocker" :nodes="nodes"></acl-ts-file-db-gql>

                       <template v-else-if="isTs">
                         <acl-ts-file-gql v-if="isMvc"
                                          ref="tabs4"
                                          :nodes="this.nodes"></acl-ts-file-gql>
                       </template>
                       <template v-else>
                         <acl-gql
                           ref="tabs4"
                           :nodes="this.nodes"></acl-gql>
                       </template>


                     </template>

                     <template v-else-if="isGrpc">

                       <acl-grpc-db v-if="isPackage" :nodes="nodes"></acl-grpc-db>

                     </template>


                   </v-tab-item>


                 </template>-->
                <!--        <v-tab ripple class="divider v-tab-border-right" @click="loadColumnsMock = true" >-->
                <!--          <v-icon small>mdi-seed</v-icon>&nbsp;-->
                <!--          <span class="caption font-weight-bold text-capitalize">  Mock</span>-->
                <!--        </v-tab>-->
                <!--        <v-tab-item :transition="false" >-->
                <!--          <mocks-->
                <!--            ref="tabs4"-->
                <!--            v-if="loadColumnsMock"-->
                <!--            :nodes="this.nodes"-->
                <!--            :newTable="this.newTableCopy"-->
                <!--            :mtdNewTableUpdate="this.mtdNewTableUpdate"-->
                <!--            :deleteTable="this.deleteTable"-->
                <!--          />-->
                <!--        </v-tab-item>-->


                <template v-if="!isMetaTable">
                  <v-tab ripple class="">
                    <v-icon small>mdi-sticker-check-outline</v-icon>&nbsp;
                    <span class="caption font-weight-bold text-capitalize">Validators</span>
                  </v-tab>


                  <v-tab-item :transition="false">

                    <validation
                      :nodes="this.nodes"
                      :newTable="this.newTableCopy"
                      :mtdNewTableUpdate="this.mtdNewTableUpdate"
                      :deleteTable="this.deleteTable"
                      :is-meta-table="isMetaTable"
                    />
                  </v-tab-item>
                </template>
                <template v-if="!isMvc && !isMetaTable">


                  <v-tab ripple class="">
                    <v-icon small>mdi-hook</v-icon>&nbsp;
                    <span class="caption font-weight-bold text-capitalize">Webhooks</span>
                  </v-tab>


                  <v-tab-item :transition="false">

                    <webhooks
                      ref="tabs0"
                      :nodes="this.nodes"
                      :newTable="this.newTableCopy"
                      :mtdNewTableUpdate="this.mtdNewTableUpdate"
                      :deleteTable="this.deleteTable"
                      :is-meta-table="isMetaTable"
                    />
                  </v-tab-item>

                </template>


              </template>


            </v-tabs>

          </v-tab-item>
        </template>

        <template v-if="_isUIAllowed('airTable')">
          <v-tab v-show="relationTabs &&  relationTabs.length" class="" >
            <v-icon small>mdi-table-edit</v-icon>&nbsp;<span
            class="caption text-capitalize  font-weight-bold"> {{nodes._tn}}</span></v-tab>
          <v-tab-item
                      style="height:100%">
              <rows-xc-data-table
                ref="tabs7"
                :show-tabs="relationTabs &&  relationTabs.length"
                :table="nodes.tn"
                :nodes="nodes"
                :newTable="newTableCopy"
                :mtdNewTableUpdate="mtdNewTableUpdate"
                :deleteTable="deleteTable"
                :is-meta-table="isMetaTable"
                :addNewRelationTab="addNewRelationTab"
              />
          </v-tab-item>
        </template>
        <!-- Closable tabs : START -->
        <template v-for="({
        relation,
        table,
        relationType,
        relationIdValue,
        relationRow,
        primaryValue,
        refTable,
        refTableAlias,
        tableAlias
        },i) in relationTabs">
          <v-tab :key="i" ripple class="" @click="loadRows = true" :href="`#relRow${i}`" style="position: relative;">
            <v-tooltip bottom nudge-bottom="">
              <template v-slot:activator="{on}">
                <div v-on="on">
<!--                  <span class="rel-row-parent"> {{ refTable }} - {{ primaryValue }} </span>-->
                  <v-icon small>mdi-table-arrow-{{ relationType === 'hm' ? 'right' : 'left' }}</v-icon>&nbsp;
                  <span
                    class="caption font-weight-bold text-capitalize">
                      {{ refTableAlias }} ({{ ((primaryValue || '') + '').slice(0,13) }}) ->
                    {{ tableAlias }}
                  </span>
                  <v-icon icon @click="removeRelationTab(i)" x-small class="ml-2">mdi-close</v-icon>
                </div>
              </template>
              <span class="caption">{{
                  refTableAlias
                }}({{ primaryValue }}) -> {{ relationType === 'hm' ? ' Has Many ' : ' Belongs To ' }} -> {{
                  tableAlias
                }}</span>

            </v-tooltip>
          </v-tab>
          <v-tab-item :value="`relRow${i}`" :key="i"
                      style="height:100%">
            <template>
              <rows-xc-data-table
                ref="tabs7"
                :show-tabs="relationTabs &&  relationTabs.length"
                :table="nodes.tn"
                :nodes="nodes"
                :relation="relation"
                :relation-type="relationType"
                :newTable="newTableCopy"
                :relationIdValue="relationIdValue"
                :mtdNewTableUpdate="mtdNewTableUpdate"
                :deleteTable="deleteTable"
                :is-meta-table="isMetaTable"
                :relationRow="relationRow"
                :relationPrimaryValue="primaryValue"
                :refTable="refTable"
                :addNewRelationTab="addNewRelationTab"
              />
            </template>
          </v-tab-item>

        </template>
        <!-- Closable tabs : END -->


      </v-tabs>

    </template>
    <dlgLabelSubmitCancel
      type="error"
      v-if="dialogShow"
      :actionsMtd="deleteTable"
      :dialogShow="dialogShow"
      heading="Click Submit to Delete the Table"
    />
  </v-container>
</template>

<script>
import columnList from "./tableTabs/columns";
import indexList from "./tableTabs/indexes";
import triggerList from "./tableTabs/triggers";
import rows from "./tableTabs/rows";
import dlgLabelSubmitCancel from "../utils/dlgLabelSubmitCancel";

import {mapGetters, mapActions} from "vuex";
import AclGql from "./tableTabs/aclGql";
import AclTypeorm from "./tableTabs/aclTsFile";
import AclTsFileGql from "./tableTabs/aclTsFileGql";
import AclJs from "./tableTabs/aclJs";
import TrialExpired from "../trialExpired";
import AclTypeormDb from "./tableTabs/aclTsFileDb";
import AclGrpcDb from "./tableTabs/aclGrpcDb";
import AclTsFileDbGql from "./tableTabs/aclTsFileDbGql";
import {isMetaTable} from "@/helpers/xutils";
import Webhooks from "@/components/project/tableTabs/webhooks";
import LogicRest from "@/components/project/tableTabs/logicRest";
import LogicGql from "@/components/project/tableTabs/logicGql";
import LogicGrpc from "@/components/project/tableTabs/logicGrpc";
import Validation from "@/components/project/tableTabs/validation";
import TableAcl from "@/components/project/tableTabs/tableAcl";
import RowsXcDataTable from "@/components/project/spreadsheet/rowsXcDataTable";


export default {
  components: {
    RowsXcDataTable,
    TableAcl,
    Validation,
    LogicGrpc,
    LogicGql,
    LogicRest,
    Webhooks,
    AclTsFileDbGql,
    AclTypeormDb,
    TrialExpired,
    AclJs,
    AclTsFileGql,
    AclTypeorm,
    AclGql,
    AclGrpcDb,
    columnList,
    indexList,
    // constraintList,
    triggerList,
    dlgLabelSubmitCancel,
    rows,
    // mocks
  },
  data() {
    return {
      error: false,
      active: 1, // this.nodes.newTable ? 0 : 1,
      newTableCopy: this.nodes.newTable ? true : false,
      dialogShow: false,
      loadIndexList: false,
      loadTriggerList: false,
      loadRelationList: false,
      loadConstraintList: false,
      loadRows: false,
      loadColumnsMock: false,
      relationTabs: []
    };
  },
  methods: {
    addNewRelationTab(relation, refTable,refTableAlias, table,tableAlias, relationIdValue, relationType, relationRow, primaryValue) {
      this.relationTabs.push({relation, refTable, table, relationIdValue, relationType, relationRow, primaryValue,refTableAlias,tableAlias});
      this.active = 'relRow' + (this.relationTabs.length - 1);
    },
    removeRelationTab(i) {
      this.relationTabs.splice(i, 1);
    },


    async handleKeyDown(event) {
      let activeTabEleKey = `tabs${this.active}`;
      if (this.$refs[activeTabEleKey]
        && this.$refs[activeTabEleKey].handleKeyDown
      ) {
        await this.$refs[activeTabEleKey].handleKeyDown(event);
      }
    },
    ...mapActions({
      removeTableTab: "tabs/removeTableTab",
      loadTablesFromParentTreeNode: "project/loadTablesFromParentTreeNode"
    }),
    mtdNewTableUpdate(value) {
      this.newTableCopy = value;
    },
    async deleteTable(action = "") {
      if (action === "showDialog") {
        this.dialogShow = true;
      } else if (action === "hideDialog") {
        this.dialogShow = false;
      } else {
        let relationListAll = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'relationListAll']);


        relationListAll = relationListAll.data.list.filter(rel => rel.rtn === this.nodes.tn).map(({tn}) => tn);

        if (relationListAll.length) {
          this.$toast.info('Table can\'t be  deleted  since Table is being referred in following tables : ' + relationListAll.join(', ')).goAway(10000);
          this.dialogShow = false;
          return;
        }


        let triggerList = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'triggerList', {
          tn: this.nodes.tn
        }]);

        for (const trigger of triggerList.data.list) {


          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "triggerDelete",
            {
              ...trigger,
              tn: this.nodes.tn,
              oldStatement: trigger.statement
            }]);

          console.log("triggerDelete result ", result);

          this.$toast.success('Trigger deleted successfully').goAway(1000);

        }

        let columns = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'columnList', {
          tn: this.nodes.tn
        }]);

        columns = columns.data.list;

        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        },
          "tableDelete",
          {tn: this.nodes.tn, columns}])

        this.removeTableTab({
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.nodes.tn
        });

        await this.loadTablesFromParentTreeNode({
          _nodes: {
            ...this.nodes
          }
        });
        this.dialogShow = false;
      }
    },
    onTabChange() {
      this.$emit('update:hideLogWindows', this.active === 2)
    }
  },
  computed: {
    ...mapGetters({
      isGraphql: "project/GtrProjectIsGraphql",
      isNoApis: "project/GtrProjectIsNoApis",
      isMvc: 'project/GtrProjectIsMvc',
      isDocker: 'project/GtrProjectIsDocker',
      isPackage: 'project/GtrProjectIsPackage',
      isTs: 'project/GtrProjectIsTs',
      isRest: 'project/GtrProjectIsRest',
      isGrpc: 'project/GtrProjectIsGrpc',
    }),

    scaffoldOnSave: {
      get() {
        return this.$store.state.windows.scaffoldOnSave
      },
      set(status) {
        this.$store.commit('windows/MutToggleScaffoldOnSave', status)
        this.$toast.success(`Scaffolding of source code ${status ? 'ENABLED' : 'DISABLED'} successfully`).goAway(4000);
      }
    },
    isTsEnabled() {
      return process.env.TS_ENABLED;
    },
    isMetaTable() {
      return isMetaTable(this.nodes.tn);
    }
  },
  beforeCreated() {
  },
  created() {
  },
  mounted() {
    this.onTabChange();
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
  props: ["nodes", 'hideLogWindows'],
  watch: {},
  directives: {},
};
</script>

<style scoped>

/deep/ .table-tabs > .v-tabs-items {
  border-top: 1px solid #7F828B33;
}


/deep/ .scaffoldOnSave .v-input__control {
  margin-top: -2px;
}

.table-tabs, /deep/ .table-tabs > .v-windows {
  height: 100%;
}
/deep/ .v-window-item {
  height: 100%
}

.rel-row-parent {
  text-align: center;
  left: 0;
  padding: 2px 3px;
  text-transform: none;
  display: inline-block;
  position: absolute;
  top: 0;
  font-size: 8px;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%;
  overflow: hidden;
  color: grey;
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
