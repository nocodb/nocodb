<template>
  <v-container fluid class="pa-0 ma-0">
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
                     text: originalNodes.sequence_name + ' (sequence)',
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
        tooltip="Reload Sequences"
        small
        color="primary"
        icon="refresh"
        :disabled="newSequence"
        @click="loadSequences()"
      >
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
      <x-btn
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        small
        color="primary"
        icon="save"
        :disabled="!(newSequence || edited)"
        @click="applyChanges()"
      >
        <!-- Save -->
        {{ $t('general.save') }}
      </x-btn>
      <x-btn
        outlined
        tooltip="Delete Sequence"
        small
        color="error"
        icon="mdi-delete-outline"
        @click="deleteSequence('showDialog')"
      >
        Delete Sequence
      </x-btn>
    </v-toolbar>
    <br>
    <v-row>
      <v-col cols="8" offset="2">
        <v-simple-table v-if="newSequence">
          <template #default>
            <thead>
              <tr>
                <th class="text-left">
                  Name
                </th>
                <th class="text-left">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class="pa-1">
                <td>sequence_name</td>
                <td class="pb-2 pt-1 pr-1">
                  <v-row />
                  <v-text-field
                    v-model="sequence.sequence_name"
                    :rules="[v=> !!v || 'Value required']"
                    @input="sequenceNameChanged()"
                  />
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>

        <v-simple-table v-else>
          <template #default>
            <thead>
              <tr>
                <th class="text-left">
                  Name
                </th>
                <th class="text-left">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>sequence_name</td>
                <td class="pb-2 pt-1 pr-1">
                  <v-text-field
                    v-model="sequence.sequence_name"
                    :disabled="nodes.dbConnection.client === 'mssql'"
                    :rules="[v=> !!v || 'Value required']"
                    @input="sequenceNameChanged()"
                  />
                </td>
              </tr>
              <tr
                v-for="(item,key,i) in sequence"
                :key="i"
                :style="key ==='sequence_name' ? 'display:none' : ''"
                class="grey--text"
              >
                <td>{{ key }}</td>
                <td>
                  {{ item }}
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-col>
    </v-row>
    <dlgLabelSubmitCancel
      v-if="dialogShow"
      type="error"
      :dialog-show="dialogShow"
      css-style="border:1px solid grey;height:300px"
      :actions-mtd="deleteSequence"
      heading="Click Submit to Delete the Sequence"
    />
  </v-container>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

import dlgLabelSubmitCancel from '../utils/dlgLabelSubmitCancel'

export default {
  components: { dlgLabelSubmitCancel },
  data() {
    return {
      edited: false,
      originalNodes: {},
      sequence: {},
      newSequence: !!this.nodes.newSequence,
      oldCreateSequence: '',
      dialogShow: false
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' })
  },
  methods: {
    ...mapActions({
      loadSequencesFromChildTreeNode:
          'project/loadSequencesFromChildTreeNode',
      loadSequencesFromParentTreeNode:
          'project/loadSequencesFromParentTreeNode',
      removeSequenceTab: 'tabs/removeSequenceTab'
    }),
    async loadSequences() {
      try {
        this.$store.commit('notification/MutToggleProgressBar', true)
        if (this.newSequence) {
          this.sequence = {
            sequence_name: this.originalNodes.sequence_name
          }
          this.$store.commit('notification/MutToggleProgressBar', false)
          return
        }

        const result = await this.sqlMgr.sqlOp({
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'sequenceList', { sequence_name: this.originalNodes.sequence_name })

        this.sequence = { ...result.data.list.find(seq => seq.sequence_name === this.originalNodes.sequence_name) }
      } catch (e) {
        console.log(e)
        this.$toast.error('Loading sequence failed')
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false)
      }
    },
    async applyChanges() {
      try {
        if (this.newSequence) {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'sequenceCreate',
            this.sequence])

          await this.loadSequencesFromChildTreeNode({
            _nodes: {
              ...this.nodes
            }
          })
          this.originalNodes.sequence_name = this.sequence.sequence_name
          this.newSequence = false
          await this.loadSequences()
          this.$toast.success('Sequence created successfully').goAway(3000)
        } else {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            'sequenceUpdate',
            this.sequence
          ])

          this.$toast.success('Sequence updated successfully').goAway(3000)
        }
      } catch (e) {
        this.$toast.error('Saving sequence failed').goAway(3000)
        throw e
      }
    },
    async deleteSequence(action = '') {
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
            'sequenceDelete',
            {
              sequence_name: this.originalNodes.sequence_name
            }])

          this.removeSequenceTab({
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            sequence_name: this.originalNodes.sequence_name
          })
          await this.loadSequencesFromParentTreeNode({
            _nodes: {
              ...this.nodes
            }
          })
          this.dialogShow = false
          this.$toast.success('Sequence deleted successfully').goAway(3000)
        }
      } catch (e) {
        this.$toast.error('Deleting sequence failed').goAway(3000)
        throw e
      }
    },
    sequenceNameChanged() {
      this.edited = this.sequence.sequence_name.trim() !== ''
    }
  },
  beforeCreated() {
  },
  watch: {
    // 'sequence' : {
    //   deep:true,
    //   handler(n,o) {
    //     console.log('watch sequence',n,o);
    //     if(o.sequence_name)
    //       this.edited = true;
    //   }
    // }
  },
  async created() {
    this.originalNodes = { ...this.nodes }
    await this.loadSequences()
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
