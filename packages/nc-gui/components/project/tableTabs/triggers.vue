<template>
  <v-row class="pa-0 ma-0">
    <v-overlay v-if="isMetaTable" absolute>
      <v-alert type="info">
        Meta tables are not editable
      </v-alert>
    </v-overlay>

    <v-col cols="12 pa-0">
      <v-card class="elevation-0">
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
                         text: nodes.title + ' (table)',
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
            v-ge="['triggers','load']"
            outlined
            tooltip="Load Triggers"
            small
            class="primary"
            color="primary"
            @click="loadTriggerList"
          >
            <v-icon small left>
              refresh
            </v-icon>
            <!-- Reload -->
            {{ $t('general.reload') }}
          </x-btn>
          <x-btn
            v-ge="['triggers','new']"
            outlined
            tooltip="Create New Trigger"
            small
            class="primary"
            color="primary"
            icon="mdi-plus"
            @click="showTriggerDlg()"
          >
            New Trigger
          </x-btn>
          <x-btn
            v-ge="['triggers','delete']"
            outlined
            :tooltip="$t('activity.deleteTable')"
            small
            icon="mdi-delete-outline"
            class="error text-right"
            color="error "
            @click="deleteTable('showDialog')"
          >
            {{ $t('activity.deleteTable') }}
          </x-btn>
        </v-toolbar>
        <v-skeleton-loader v-if="loading" type="table" />
        <v-data-table
          v-else
          dense
          :headers="headers"
          :items="triggers"
          footer-props.items-per-page-options="30"
        >
          <template #item="props">
            <tr>
              <td>{{ props.item.trigger }}</td>
              <td>{{ props.item.event }}</td>
              <td>{{ props.item.timing }}</td>
              <td>{{ props.item.statement }}</td>
              <td>
                <div>
                  <x-icon
                    v-ge="['triggers','edit']"
                    color="primary"
                    small
                    @click="showTriggerDlg(props.item)"
                  >
                    mdi-square-edit-outline
                  </x-icon>
                  <x-icon
                    v-ge="['triggers','delete']"
                    small
                    color="error"
                    @click="deleteTrigger('showDialog', props.item)"
                  >
                    mdi-delete-forever
                  </x-icon>
                </div>
              </td>
            </tr>
          </template>
        </v-data-table>
      </v-card>
      <triggerAddEditDlg
        v-if="dialogShow"
        :nodes="nodes"
        :trigger-object="selectedTrigger"
        :new-trigger="!selectedTrigger.trigger"
        :dialog-show="dialogShow"
        :mtd-dialog-submit="mtdTriggerDlgSubmit"
        :mtd-dialog-cancel="mtdTriggerDlgCancel"
      />
      <dlgLabelSubmitCancel
        v-if="showTriggerDeleteDialog"
        type="error"
        :dialog-show="showTriggerDeleteDialog"
        :actions-mtd="deleteTrigger"
        heading="Click Submit to Delete the Trigger"
      />
    </v-col>
  </v-row>
</template>

<script>
import { mapGetters } from 'vuex'

import triggerAddEditDlg from '../dlgs/dlgTriggerAddEdit'
import dlgLabelSubmitCancel from '../../utils/dlgLabelSubmitCancel'

export default {
  components: { triggerAddEditDlg, dlgLabelSubmitCancel },
  data() {
    return {
      loading: false,
      showTriggerDeleteDialog: false,
      triggers: [],
      headers: [
        {
          text: 'Trigger Name',
          sortable: false
        },
        { text: 'Event', sortable: false },
        { text: 'Timing', sortable: false },
        { text: 'Statement', sortable: false },
        { text: '', sortable: false }
      ],
      dialogShow: false,
      selectedTrigger: null
    }
  },
  methods: {
    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey)
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        // case 'true_s' :
        //   await this.applyChanges();
        //   break;
        case 'true_l' :
          await this.loadTriggerList()
          break
        case 'true_n' :
          this.showTriggerDlg()
          break
        case 'true_d' :
          await this.deleteTable('showDialog')
          break
      }
    },

    async loadTriggerList() {
      this.loading = true
      try {
        this.$store.commit('notification/MutToggleProgressBar', true)
        if (this.newTable) {
          this.$store.commit('notification/MutToggleProgressBar', false)
          return
        }
        // const client = await this.sqlMgr.projectGetSqlClient({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // });
        // const result = await client.triggerList({
        //   table_name: this.nodes.table_name
        // });

        //
        // const result = await this.sqlMgr.sqlOp({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // }, 'triggerList', {
        //   table_name: this.nodes.table_name
        // })

        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'triggerList', {
          table_name: this.nodes.table_name
        }])

        console.log('triggers', result.data.list)
        this.triggers = result.data.list
      } catch (e) {
        console.log(e)
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false)
      }
      this.loading = false
    },
    showTriggerDlg(trigger) {
      if (trigger) { this.selectedTrigger = trigger } else { this.selectedTrigger = {} }
      this.dialogShow = true
    },
    async mtdTriggerDlgSubmit(triggerObject, newTrigger) {
      try {
        // const client = await this.sqlMgr.projectGetSqlClient({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // });
        if (newTrigger) {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'triggerCreate',
            triggerObject
          ])
          console.log('triggerCreate result: ', result)
          this.$toast.success('Trigger created successfully').goAway(3000)
        } else {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'triggerUpdate',
            {
              ...triggerObject,
              oldStatement: this.selectedTrigger.statement
            }])

          console.log('triggerUpdate result: ', result)
          this.$toast.success('Trigger updated successfully').goAway(3000)
        }

        await this.loadTriggerList()
        this.selectedTrigger = null
        this.dialogShow = false
      } catch (error) {
        console.error('triggerCreate error: ', error)
      }
    },
    mtdTriggerDlgCancel() {
      this.dialogShow = false
      this.selectedTrigger = null
    },
    async deleteTrigger(action = '', trigger) {
      if (action === 'showDialog') {
        this.showTriggerDeleteDialog = true
        this.selectedTriggerForDelete = trigger
      } else if (action === 'hideDialog') {
        this.showTriggerDeleteDialog = false
        this.selectedTriggerForDelete = null
      } else {
        const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          'triggerDelete',
          {
            ...this.selectedTriggerForDelete,
            table_name: this.nodes.table_name,
            oldStatement: this.selectedTriggerForDelete.statement
          }])

        console.log('triggerDelete result ', result)
        await this.loadTriggerList()
        this.showTriggerDeleteDialog = false
        this.selectedTriggerForDelete = null

        this.$toast.success('Trigger deleted successfully').goAway(3000)
      }
    }
  },
  computed: { ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }) },

  beforeCreated() {
  },
  watch: {},
  created() {
    this.loadTriggerList()
  },
  mounted() {
  },
  beforeDestroy() {
    console.log('triggerlist before destroy')
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
  props: ['nodes', 'newTable', 'deleteTable', 'isMetaTable']
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
