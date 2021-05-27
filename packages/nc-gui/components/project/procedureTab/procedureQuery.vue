<template>
  <v-container class="pa-0 ma-0" fluid>
    <v-toolbar flat height="42" class="toolbar-border-bottom">
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
          text: this.nodes.procedure_name + ' (function)',
          disabled: true,
          href: '#'
        }]" divider=">" small>
          <template v-slot:divider>
            <v-icon small color="grey lighten-2">forward</v-icon>
          </template>
        </v-breadcrumbs>
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <x-btn outlined tooltip="Save Changes" small @click="applyChanges()" color="primary" icon="save">Save</x-btn>
      <x-btn outlined tooltip="Delete Procedure" small color="error" @click="deleteProcedure('showDialog')"
             icon="mdi-delete-outline">
        Delete Procedure
        <!--        <v-icon>delete</v-icon>-->
      </x-btn>
    </v-toolbar>
    <monaco-editor
      v-if="procedure.create_procedure != undefined"
      :code.sync="procedure.create_procedure"
      cssStyle="height:500px"
    ></monaco-editor>
    <dlgLabelSubmitCancel
      type="error"
      v-if="dialogShow"
      :dialogShow="dialogShow"
      cssStyle="border:1px solid grey;height:300px"
      :actionsMtd="deleteProcedure"
      heading="Click Submit to Delete the Procedure"
    />
  </v-container>
</template>

<script>
import {mapGetters, mapActions} from "vuex";

import MonacoEditor from "../../monaco/Monaco";
import dlgLabelSubmitCancel from "../../utils/dlgLabelSubmitCancel";

export default {
  components: {MonacoEditor, dlgLabelSubmitCancel},
  data() {
    return {
      procedure: {},
      newProcedure: this.nodes.newProcedure ? true : false,
      oldCreateProcedure: "",
      dialogShow: false
    };
  },
  computed: {
    ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"})
  },
  methods: {
    ...mapActions({
      loadProceduresFromChildTreeNode:
        "project/loadProceduresFromChildTreeNode",
      loadProceduresFromParentTreeNode:
        "project/loadProceduresFromParentTreeNode",
      removeProcedureTab: "tabs/removeProcedureTab"
    }),

    async handleKeyDown({metaKey, key, altKey, shiftKey, ctrlKey}) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        case 'true_s' :
          await this.applyChanges();
          break;
        case 'true_l' :
          await this.loadProcedure()
          break;
        // case 'true_n' :
        //   this.addColumn();
        //   break;
        case 'true_d' :
          await this.deleteProcedure('showDialog');
          break;

      }
    },

    async loadProcedure() {

      try {
        this.$store.commit('notification/MutToggleProgressBar', true);
        if (this.newProcedure) {
          this.procedure = {
            procedure_name: this.nodes.procedure_name,
            create_procedure: ""
          };
          this.$store.commit('notification/MutToggleProgressBar', false);
          return;
        }

        // // console.log("env: this.env", this.env, this.dbAlias);
        // const client = await this.sqlMgr.projectGetSqlClient({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // });
        // const result = await client.procedureRead({
        //   procedure_name: this.nodes.procedure_name
        // });
        //
        // const result = await this.sqlMgr.sqlOp({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // }, 'procedureRead', {procedure_name: this.nodes.procedure_name})


        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'procedureRead', {procedure_name: this.nodes.procedure_name}])


        // console.log("procedure read", result);
        this.procedure = result.data.list[0];
        this.oldCreateProcedure = this.procedure.create_procedure;

      } catch (e) {
        console.log(e);
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false);
      }

    },
    async applyChanges() {

      try {

        if (this.newProcedure) {

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "procedureCreate",
            {
              procedure_name: this.nodes.procedure_name,
              create_procedure: this.procedure.create_procedure
            }]);

          await this.loadProceduresFromChildTreeNode({
            _nodes: {
              ...this.nodes
            }
          });
          console.log("create procedure result", result);
          this.newProcedure = false;
          this.oldCreateProcedure = this.procedure.create_procedure;
          this.$toast.success('Procedure created successfully').goAway(3000);
        } else {

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "procedureUpdate",
            {
              procedure_name: this.nodes.procedure_name,
              create_procedure: this.procedure.create_procedure,
              oldCreateProcedure: this.oldCreateProcedure
            }]);

          this.oldCreateProcedure = this.procedure.create_procedure;
          console.log("update procedure result", result);
          this.$toast.success('Procedure updated successfully').goAway(3000);
        }

      } catch (e) {
        this.$toast.error('Saving procedure failed').goAway(3000);
        throw e;
      }

    },
    async deleteProcedure(action = "") {

      try {
        if (action === "showDialog") {
          this.dialogShow = true;
        } else if (action === "hideDialog") {
          this.dialogShow = false;
        } else {

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "procedureDelete",
            {
              procedure_name: this.nodes.procedure_name,
              create_procedure: this.oldCreateProcedure
            }]);

          this.removeProcedureTab({
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            procedure_name: this.nodes.procedure_name
          });
          await this.loadProceduresFromParentTreeNode({
            _nodes: {
              ...this.nodes
            }
          });
          this.dialogShow = false;
          this.$toast.success('Procedure deleted successfully').goAway(3000);
        }
      } catch (e) {
        this.$toast.error('Deleting procedure failed').goAway(3000);
        throw e;
      }


    }
  },
  beforeCreated() {
  },
  created() {
    this.loadProcedure();
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
  props: ["nodes"],
  watch: {},
  directives: {}
};
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
