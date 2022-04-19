<template>
  <v-container class="ma-0 pa-0" fluid style="height: 100%">
    <template v-if="!isSimpleProject">
      <v-toolbar height="42" class="toolbar-border-bottom elevation-0">
        <v-breadcrumbs
          :items="[{
            text: nodes.env,
            disabled: true,
            href: '#'
          },{
            text: nodes.dbAlias,
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

        <p v-if="tableMigrationFiles.data.length" class=" pt-3 body-2">
          : Pending Migrations
          <span><b>( {{ tableMigrationFiles.status }} )</b></span>
        </p>

        <v-spacer />

        <!--        <x-btn tooltip="Open Migrations Folder"
                       icon="mdi-folder-open"
                       outlined
                       small
                       @click="openFolder">
                  Open Folder
                </x-btn>-->

        <x-btn
          tooltip="Reload Migrations"
          small
          outlined
          @dblclick="showUpAndDownBtns = !showUpAndDownBtns"
          @click="loadEnv"
        >
          <v-icon left small>
            refresh
          </v-icon>
          <!-- Reload -->
          {{ $t('general.reload') }}
        </x-btn>

        <div
          v-if=" showUpAndDownBtns &&tableMigrationFiles.data.length"
          class="ml-1"
        >
          <v-menu
            v-for="(menu,menuIndex) in migrationMenu"
            :key="menuIndex"
            open-on-hover
            bottom
            offset-y
            class="ml-1"
          >
            <template #activator="{ on }">
              <v-btn
                :tooltip="menu.tooltip"
                :color="menu.color"
                outlined
                small
                :disabled="isMigrationButtonEnabled(menu.label)"
                v-on="on"
              >
                {{ menu.label }}
                <v-icon>mdi-menu-down</v-icon>
              </v-btn>
            </template>

            <v-list dense>
              <div
                v-for="(item, itemIndex) in menu.menuItems"
                :key="itemIndex"
              >
                <v-list-item
                  @click="item.action"
                >
                  <v-list-item-title>
                    <v-icon
                      small
                      :color="menu.color"
                    >
                      {{ item.icon }}
                    </v-icon> &nbsp;
                    {{ item.label }}
                  </v-list-item-title>
                </v-list-item>

                <v-divider v-if="itemIndex < menu.menuItems.length - 1" />
              </div>
            </v-list>
          </v-menu>
        </div>
      </v-toolbar>
      <!--    <v-row class="height" v-if="tableMigrationFiles.data.length">-->

      <!--      <v-col class="column py-0 my-0" cols="6">-->

      <splitpanes
        v-if="tableMigrationFiles.data.length"
        style="height:calc(100% - 42px);border-top: 1px solid grey"
        class="xc-theme"
      >
        <pane min-size="20" size="40" style="overflow: auto">
          <v-card class="px-0 py-0 my-0">
            <!--          v-if="tableMigrationFiles.status"-->
            <v-hover>
              <v-checkbox
                v-model="tableMigrationFiles.showPendingMigrations"
                slot-scope="{ hover }"
                class="pl-3 "
                dense
                color="primary lighten-1"
              >
                <template #label="">
                  <span
                    class="body-2"
                    :class="{'white--text ':hover}"
                  >Show Only Pending Migrations ({{ tableMigrationFiles.status }})</span>
                </template>
              </v-checkbox>
            </v-hover>
            <v-data-table
              v-model="tableMigrationFiles.selected"
              dense
              style="  border-top: 1px solid #7F828B33;"
              :headers="tableMigrationFiles.headers"
              :items="tableMigrationFiles.data"
              footer-props.items-per-page-options="15"
            >
              <template #item="props">
                <tr
                  v-if="tableMigrationFiles.showPendingMigrations
                    ? props.item.status === true
                    : true"
                  :active="!!selectedMigration.migration &&
                    selectedMigration.migration.title == props.item.title"
                  @click="getMigrationFiles(props.item)"
                >
                  <td :class="findMigrationTextColor(props.item)" class="caption">
                    {{ props.index + 1 }}
                  </td>
                  <td
                    class="text-center py-2 caption"
                    style="cursor: pointer"
                    :class="findMigrationTextColor(props.item)"
                  >
                    <span>{{ props.item.title }}</span> &nbsp;&nbsp;&nbsp;&nbsp; <span>{{ props.item.titleDown }}</span>
                  </td>
                  <!--                <td></td>-->
                  <td class="text-center caption">
                    <div v-if="props.item.status" class="pa-0 ma-0 caption">
                      <x-btn text tooltip="Migration yet to be applied" btn.class="warning--text caption">
                        No
                        <!--                      <v-icon :color="findNextMigrationColor(props.item)">mdi-seal-->
                        <!--                      </v-icon>-->
                      </x-btn>
                    </div>
                    <div v-else class="pa-0 ma-0">
                      <x-btn text tooltip="Applied migration" btn.class="primary--text caption">
                        Yes
                        <!--                      <v-icon :color="findNextMigrationColor(props.item)">mdi-seal</v-icon>-->
                      </x-btn>
                    </div>
                  </td>
                </tr>
              </template>
            </v-data-table>
          </v-card>
          <!--      </v-col>-->
          <!--      <v-col class="column " cols="6">-->
        </pane>
        <pane min-size="33" size="60" style="overflow: auto">
          <MonacoEditor
            v-if="selectedMigration.up"
            :code.sync="selectedMigration.up"
            :heading="`${selectedMigration.migration.title}`"
            css-style="height:300px"
            :read-only="true"
          />
          <MonacoEditor
            v-if="selectedMigration.down"
            :code.sync="selectedMigration.down"
            css-style="height:300px"
            :heading="`${selectedMigration.migration.titleDown}`"
            :read-only="true"
          />
          <!--      </v-col-->
          <!--      >-->
          <!--    </v-row>-->
        </pane>
      </splitpanes>
      <v-row v-cloak v-else class="pa-4 ma-4" justify="center" align="center">
        <v-card class="pa-4 ma-4 text-center">
          <p class="display-2">
            Schema migrations will be created automatically
          </p>
          <p class="display-2">
            Create a table and refresh this page.
            <br>
            Show GIF
          </p>
        </v-card>
      </v-row>
    </template>
    <template v-else>
      <v-row>
        <v-col class="pa-4">
          <v-alert type="info" class="mx-3" outlined>
            Migration is not available in Simple DB Connection project
          </v-alert>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'

import { Splitpanes, Pane } from 'splitpanes'
import MonacoEditor from '../../monaco/Monaco'

// const {shell, path} = require("electron").remote.require(
//   "./libs"
// );

export default {
  name: 'Db',
  components: {
    // dlgLabelSubmitCancel,
    MonacoEditor,
    Splitpanes,
    Pane
  },
  data() {
    return {
      showUpAndDownBtns: false,
      tableMigrationFiles: {
        heading: '',
        selected: [],
        headers: [
          { text: '#', sortable: false, width: '1%', class: '  text-center' },
          { text: 'Migration Files', value: 'migration', sortable: false, class: ' pa-4  text-center' },
          // { text: "Down File", sortable: false, width: "1%" ,class:''},
          { text: 'Migrations applied', sortable: false, width: '1%', class: ' pa-4  text-center' }
        ],
        data: [],
        status: '',
        showPendingMigrations: false
      },
      tableMigrationRows: {
        heading: '',
        headers: [],
        data: []
      },
      selectedMigration: { migration: null, up: null, down: null },
      view: {},
      oldViewDefination: '',
      newView: !!this.nodes.newView,
      dialogShow: false,
      migrationMenu: [
        {
          label: 'Migration Up',
          tooltip: 'Apply Database Migrations',
          color: 'primary',
          menuItems: [
            {
              label: 'Migration Up One',
              icon: 'mdi-redo',
              action: () => this.migrationUp(1)
            },
            {
              label: 'MIGRATION UP ALL',
              icon: 'mdi-fast-forward',
              action: () => this.migrationUp()
            }
          ]
        }, {
          label: 'Migration Down',
          color: 'warning',
          tooltip: 'Revert Database Migrations',
          menuItems: [
            {
              label: 'Migration Down One',
              icon: 'mdi-undo',
              action: () => this.migrationDown(1)
            },
            {
              label: 'Migration Down All',
              icon: 'mdi-rewind',
              action: () => this.migrationDown()
            }
          ]
        }
      ]
    }
  },
  computed: {
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      currentProjectFolder: 'project/currentProjectFolder',

      isSimpleProject: 'project/GtrProjectIsDbConnection'
    })
  },
  watch: {},
  created() {
    this.loadEnv()
  },
  mounted() {
  },
  beforeDestroy() {
  },
  methods: {

    // openFolder() {
    //   shell.openItem(path.join(this.currentProjectFolder, 'server', 'tool', this.nodes.dbAlias, 'migrations'));
    // },

    isMigrationButtonEnabled(name) {
      return this.nodes.dbConnection.client === 'sqlite3' && name === 'Migration Down'
    },

    async getMigrationFiles(migration) {
      this.selectedMigration.migration = ''
      this.selectedMigration.up = ''
      this.selectedMigration.down = ''
      this.selectedMigration.migration = migration
      // let result = await this.sqlMgr.migrator().migrationsToSql({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   folder: this.currentProjectFolder,
      //   title: migration.title,
      //   titleDown: migration.titleDown
      // });
      // let result = await this.sqlMgr.sqlOp(null, 'migrationsToSql', {
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   folder: this.currentProjectFolder,
      //   title: migration.title,
      //   titleDown: migration.titleDown
      // });
      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'migrationsToSql', {
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        folder: this.currentProjectFolder,
        title: migration.title,
        titleDown: migration.titleDown
      }])
      this.selectedMigration.up = result.data.object.up
      this.selectedMigration.down = result.data.object.down
    },

    async loadEnv() {
      try {
        this.$store.commit('notification/MutToggleProgressBar', true)
        const migrationArgs = {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          folder: this.currentProjectFolder,
          sqlContentMigrate: 0,
          migrationSteps: 9999,
          onlyList: true
        }

        // let result = await this.sqlMgr.migrator().migrationsList(migrationArgs);
        // let result = await this.sqlMgr.sqlOp(null, 'migrationsList', migrationArgs);
        const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'migrationsList', migrationArgs])
        let nextMigration = 0

        for (let i = 0; i < result.data.object.list.length; i++) {
          const el = result.data.object.list[i]
          el.nextMigration = 0
          if (el.status === true && nextMigration === 0) {
            nextMigration = 1
            el.nextMigration = nextMigration
          } else if (el.status === true && nextMigration === 1) {
            el.nextMigration = 2
          }
        }

        this.tableMigrationFiles.data = result.data.object.list
        this.tableMigrationFiles.status = result.data.object.pending
        if (this.tableMigrationFiles.data[0]) {
          await this.getMigrationFiles(this.tableMigrationFiles.data[0])
        }
      } catch (e) {
        console.log(e)
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false)
      }
    },
    async applyChanges() {
    },
    async deleteView(action = '') {
    },
    async migrationUp(steps = 99999999999) {
      try {

        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'migrationsUp', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          migrationSteps: steps,
          folder: this.currentProjectFolder,
          sqlContentMigrate: 1
        }])
        this.$toast.success('Migration up was successfully completed.').goAway(5000)
      } catch (e) {
        this.$toast.error('Migration up was failed.').goAway(5000)
      }
      await this.loadEnv()
    },
    async migrationDown(steps = 99999999999) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'migrationsDown', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          migrationSteps: steps,
          folder: this.currentProjectFolder,
          sqlContentMigrate: 1
        }])
        this.$toast.success('Migration down was successfully completed.').goAway(5000)
      } catch (e) {
        this.$toast.error('Migration down was failed.').goAway(5000)
      }
      await this.loadEnv()
    },
    findNextMigrationColor(item) {
      if (item.nextMigration === 1) {
        return 'orange'
      } else if (item.nextMigration === 2) {
        return 'orange'
      } else if (item.nextMigration === 0) {
        return 'grey'
      }
      return ''
    },
    findMigrationTextColor(item) {
      // if (item.nextMigration === 1) {
      //   return "white--text";
      // } else if (item.nextMigration === 2) {
      //   return "white--text";
      // } else if (item.nextMigration === 0) {
      //   return "grey--text";
      // }
      return ''
    }
  },

  beforeCreated() {
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
