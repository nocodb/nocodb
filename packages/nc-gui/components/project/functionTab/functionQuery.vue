<template>
  <v-container class="pa-0 ma-0" fluid>
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
                     text: nodes.function_name + ' (function)',
                     disabled: true,
                     href: '#'
                   }]"
          divider=">"
          dark
          large
          light
          class="title"
        >
          <template #divider>
            <v-icon small color="grey lighten-2">
              forward
            </v-icon>
          </template>
        </v-breadcrumbs>
      </v-toolbar-title>
      <v-spacer />
      <x-btn
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        small
        color="primary"
        icon="save"
        @click="applyChanges()"
      >
        <!-- Save -->
        {{ $t('general.save') }}
      </x-btn>
      <x-btn
        outlined
        tooltip="Delete Function"
        small
        color="error"
        icon="mdi-delete-outline"
        @click="deleteFunction('showDialog')"
      >
        Delete Function
      </x-btn>
    </v-toolbar>

    <monaco-editor
      v-if="functionData.create_function != undefined"
      :code.sync="functionData.create_function"
      css-style="height:400px"
    />

    <dlgLabelSubmitCancel
      v-if="dialogShow"
      :dialog-show="dialogShow"
      :actions-mtd="deleteFunction"
      heading="Click Submit to Delete the Function"
      type="error"
    />
  </v-container>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

import MonacoEditor from '../../monaco/Monaco'
import dlgLabelSubmitCancel from '../../utils/dlgLabelSubmitCancel'

import { SqlUI } from '../../../helpers/sqlUi/SqlUiFactory'

export default {
  components: { MonacoEditor, dlgLabelSubmitCancel },
  data() {
    return {
      functionData: {},
      newFunction: !!this.nodes.newFunction,
      oldCreateFunction: '',
      dialogShow: false
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' })
  },
  methods: {
    ...mapActions({
      loadFunctionsFromChildTreeNode: 'project/loadFunctionsFromChildTreeNode',
      loadFunctionsFromParentTreeNode:
        'project/loadFunctionsFromParentTreeNode',
      removeFunctionTab: 'tabs/removeFunctionTab'
    }),

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        case 'true_s' :
          await this.applyChanges()
          break
        case 'true_l' :
          await this.loadFunction()
          break
        // case 'true_n' :
        //   this.addColumn();
        //   break;
        case 'true_d' :
          await this.deleteFunction('showDialog')
          break
      }
    },

    async loadFunction() {
      if (this.newFunction) {
        this.functionData = {
          function_name: this.nodes.function_name,
          create_function: ''
        }
        return
      }
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.functionRead({
      //   function_name: this.nodes.function_name
      // });

      //
      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'functionRead', { function_name: this.nodes.function_name})

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'functionRead', { function_name: this.nodes.function_name }])

      // console.log("functionData read", result);
      this.functionData = result.data.list[0]
      this.oldCreateFunction = `${this.functionData.create_function}` + ''
    },
    async applyChanges() {
      try {
        if (this.newFunction) {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'functionCreate',
            {
              function_name: this.nodes.function_name,
              create_function: this.functionData.create_function
            }])
          await this.loadFunctionsFromChildTreeNode({
            _nodes: {
              ...this.nodes
            }
          })
          this.newFunction = false
          this.oldCreateFunction = `${this.functionData.create_function}` + ''
          this.$toast.success('Function created successfully').goAway(3000)
        } else {
          const functionName = this.sqlUi.extractFunctionName(this.functionData.create_function)
          if (!functionName) {
            this.$toast.error('Invalid syntax, please check function name.').goAway(5000)
            return
          }

          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'functionUpdate',
            {
              function_name: functionName,
              create_function: this.functionData.create_function,
              function_declaration: this.functionData.function_declaration,
              oldCreateFunction: this.oldCreateFunction
            }])

          this.oldCreateFunction = `${this.functionData.create_function}` + ''
          this.$toast.success('Function updated successfully').goAway(3000)
        }
      } catch (e) {
        this.$toast.error('Saving function failed').goAway(3000)
        throw e
      }
    },
    async deleteFunction(action = '') {
      try {
        if (action === 'showDialog') {
          this.dialogShow = true
        } else if (action === 'hideDialog') {
          this.dialogShow = false
        } else {
          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'functionDelete',
            {
              function_name: this.nodes.function_name,
              create_function: this.functionData.create_function,
              function_declaration: this.functionData.function_declaration
            }])

          this.removeFunctionTab({
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            function_name: this.nodes.function_name
          })
          await this.loadFunctionsFromParentTreeNode({
            _nodes: {
              ...this.nodes
            }
          })
          this.dialogShow = false
          this.$toast.success('Function deleted successfully').goAway(3000)
        }
      } catch (e) {
        this.$toast.error('Deleting function failed').goAway(3000)
        throw e
      }
    }
  },
  beforeCreated() {
  },
  watch: {},
  created() {
    this.sqlUi = SqlUI.create(this.nodes.dbConnection)
  },
  mounted() {
    this.loadFunction()
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
  props: ['nodes']
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
