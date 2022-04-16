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
                     text: nodes.view_name + ' (view)',
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
      <x-btn
        outlined
        tooltip="Reload View"
        small
        color="primary"
        icon="refresh"
        @click="loadEnv()"
      >
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
      <x-btn
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        :disabled="nodes.dbConnection.client === 'sqlite3' && !newView "
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
        tooltip="Delete View"
        small
        color="error"
        icon="mdi-delete-outline"
        @click="deleteView('showDialog')"
      >
        Delete View
      </x-btn>
    </v-toolbar>

    <MonacoEditor
      v-if="view.view_definition != undefined"
      :code.sync="view.view_definition"
      css-style="border:1px solid grey;height:500px; width:100%"
    />

    <dlgLabelSubmitCancel
      v-if="dialogShow"
      :dialog-show="dialogShow"
      :actions-mtd="deleteView"
      css-style="height:300px"
      heading="Click Submit to Delete the View"
      type="error"
    />
  </v-container>
</template>

<script>
import { mapActions } from 'vuex'

import MonacoEditor from '../../monaco/Monaco'
import dlgLabelSubmitCancel from '../../utils/dlgLabelSubmitCancel'

export default {
  components: { MonacoEditor, dlgLabelSubmitCancel },
  data() {
    return {
      view: {},
      oldViewDefination: '',
      newView: !!this.nodes.newView,
      dialogShow: false
    }
  },
  computed: {},
  methods: {
    ...mapActions({
      loadViewsFromChildTreeNode: 'project/loadViewsFromChildTreeNode',
      loadViewsFromParentTreeNode: 'project/loadViewsFromParentTreeNode',
      removeViewTab: 'tabs/removeViewTab'
    }),

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
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
          await this.loadEnv()
          break
        // case 'true_n' :
        //   this.addColumn();
        //   break;
        case 'true_d' :
          await this.deleteView('showDialog')
          break
      }
    },

    async loadEnv() {
      try {
        this.$store.commit('notification/MutToggleProgressBar', true)
        if (this.newView) {
          this.view = { view_name: this.nodes.view_name, view_definition: '' }
          this.$store.commit('notification/MutToggleProgressBar', false)
          return
        }
        // // console.log("env: this.env", this.env, this.dbAlias);
        // const client = await this.sqlMgr.projectGetSqlClient({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // });
        // const result = await client.viewRead({view_name: this.nodes.view_name});

        // const result = await this.sqlMgr.sqlOp({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // }, 'viewRead', {view_name: this.nodes.view_name})

        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'viewRead', { view_name: this.nodes.view_name }])

        console.log('view read', result)
        this.view = { ...result.data.list[0] }
        this.oldViewDefination = `${this.view.view_definition}` + '' // for migration statements
      } catch (e) {
        console.log(e)
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false)
      }
    },
    async applyChanges() {
      try {
        if (this.newView) {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'viewCreate',
            {
              view_name: this.nodes.view_name,
              title: this.nodes.title,
              view_definition: this.view.view_definition
            }]
          )

          await this.loadViewsFromChildTreeNode({
            _nodes: {
              ...this.nodes
            }
          })
          console.log('create view result', result)
          this.newView = false
          this.oldViewDefination = `${this.view.view_definition}` + '' // for migration statments
          this.$toast.success('View created successfully').goAway(3000)
          delete this.nodes.newView
          this.$emit('created')
        } else {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'viewUpdate',
            {
              view_name: this.nodes.view_name,
              view_definition: this.view.view_definition,
              oldViewDefination: this.oldViewDefination
            }]
          )
          this.$toast.success('View updated successfully').goAway(3000)
          this.oldViewDefination = `${this.view.view_definition}` + '' // for migration statments
          console.log('update view result', result)
        }
      } catch (e) {
        this.$toast.error('Error while saving view').goAway(3000)
        throw e
      }
    },
    async deleteView(action = '') {
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
            'viewDelete',
            {
              view_name: this.nodes.view_name,
              oldViewDefination: this.oldViewDefination
            }
          ])
          this.removeViewTab({
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            view_name: this.nodes.view_name
          })
          await this.loadViewsFromParentTreeNode({
            _nodes: {
              ...this.nodes
            }
          })
          this.dialogShow = false

          this.$toast.success('View deleted successfully').goAway(3000)
        }
      } catch (e) {
        this.$toast.error('View deleted failed').goAway(3000)
        throw e
      }
    }
  },

  beforeCreated() {
  },
  watch: {},
  async created() {
    await this.loadEnv()
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
