<!--eslint-disable-->

<template>
  <v-dialog
    v-model="dialogShow"
    width="60%"
  >
    <v-tabs
      v-model="activeTab"
      height="32"
    >
      <v-tabs-slider />

      <v-tab
        v-for="env in envs"
        :key="env"
        :to="`#${env}`"
      >
        {{ env }}
      </v-tab>
      <div style="padding:0;margin-top:3px;margin-left:20px">
        <x-btn
          v-if="!isDashboard"
          small
          tooltip="Add a new environment"
          outlined
          @click="addNewEnvDialog = true"
        >
          Add Env
        </x-btn>
      </div>

      <v-spacer />
      <div style="padding:0;margin-left:20px">
        <x-btn
          v-if="!isDashboard && activeTab !== 'global'"
          small
          color="error"
          tooltip="Deletes environment(without confirmation dialog)"
          outlined
          @click="deleteEnvironemt(activeTab)"
        >
          Delete '{{ activeTab }}' Env
        </x-btn>
        <x-btn
          outlined
          color="primary"
          :tooltip="`Save all the environemtns`"
          btn.class="ma-1"
          small
          @click="saveEnvironment(env)"
        >
          <v-icon
            small
          >
            save
          </v-icon> &nbsp;Save All
        </x-btn>
      </div>
      <v-tab-item
        v-for="(env) in envs"
        :key="env"
        :value="env"
      >
        <div class="d-flex" style="height: 100%; width:100%">
          <v-simple-table class="ignore-height-style params-table my-4" style="width: 100%" dense>
            <template #default>
              <thead>
                <tr>
                  <th class="text-left body-2" width="5%" />
                  <th class="text-left body-2 grey--text" width="40%">
                    Key
                  </th>
                  <th class="text-left body-2 grey--text" width="40%">
                    Value
                  </th>
                  <th class="text-left body-2" width="5%" />
                </tr>
              </thead>
              <draggable v-if="value" v-model="envValues[env].data" tag="tbody">
                <tr v-for="(item,i) in envValues[env].data" :key="i">
                  <td>
                    <v-checkbox
                      v-model="item.enabled"
                      small
                      class="mt-0"
                      color="primary lighten-1"
                      hide-details
                      dense
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model="item.key"
                      class="body-2"
                      :disabled="!item.enabled"
                      placeholder="Key"
                      hide-details
                      single-line
                      dense
                      @input="handleInput(env,i,item.key)"
                    />
                  </td>
                  <td style="height: auto">
                    <v-text-field
                      v-model="item.value"
                      class="body-2"
                      :disabled="!item.enabled"
                      :placeholder="'Value'"
                      hide-details
                      single-line
                      dense
                    />
                  </td>
                  <td class="">
                    <x-icon
                      tooltip="Delete environment key"
                      color="error grey"
                      small
                      @click="removeKey(env,i)"
                    >
                      mdi-delete-outline
                    </x-icon>
                  </td>
                </tr>
              </draggable>
            </template>
          </v-simple-table>
        </div>
      </v-tab-item>
    </v-tabs>
    <v-dialog v-model="addNewEnvDialog" max-width="500">
      <v-card>
        <v-card-title class="headline">
          New Environment
        </v-card-title>

        <v-card-text>
          <v-text-field v-model="newEnvName" hide-details outlined dense label="Enter environment name" />
        </v-card-text>

        <v-card-actions>
          <v-spacer />

          <v-btn
            color="green darken-1"
            text
            @click="addNewEnvDialog = false"
          >
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </v-btn>

          <v-btn
            color="green darken-1"
            text
            @click="addNewEnvironment(newEnvName)"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script>
/* eslint-disable */

import draggable from 'vuedraggable'
export default {
  name: 'Environment',
  directives: {},
  components: {
    draggable
  },
  validate ({ params }) {
    return true
  },
  props: {
    value: Boolean,
    env: String
  },
  data () {
    return {
      addNewEnvDialog: false,
      newEnvName: '',
      activeTab: 'global',
      envValues: {}
    }
  },
  head () {
    return {}
  },
  computed: {
    dialogShow: {
      get () {
        return this.value
      },
      set (val) {
        this.$emit('input', val)
      }
    },
    envs () {
      if (this.isDashboard) {
        return ['global', ...(Object.keys(this.$store.getters['project/GtrProjectJson'].envs))]
      } else {
        return ['global', ...(Object.keys(this.$store.state.project.defaultProject.envs))]
      }
    }
  },
  watch: {
    env (env) {
      this.activeTab = env
    }
  },
  created () {
    this.activeTab = this.env
    this.loadEnvironments()

    // listen for active project change
    this.$store.watch(
      state => state.project.unserializedList,
      (unserializedList) => {
        if (unserializedList.envs) { this.loadEnvironments() }
      }
    )
  },
  mounted () {
  },
  beforeDestroy () {
  },
  methods: {
    async addNewEnvironment (name) {
      this.addNewEnvDialog = false
      if (!this.isDashboard) {
        const projectJsonPath = config.electron.defaultProjectPath
        const freshProjectObj = JSON.parse(JSON.stringify(this.$store.state.project.defaultProject))
        freshProjectObj.envs[name] = { apiClient: { data: [] } }
        fs.writeFileSync(
          projectJsonPath,
          JSON.stringify(freshProjectObj, null, 2),
          'utf-8')
        this.$store.commit('project/setDefaultProjectJson', JSON.parse(JSON.stringify(freshProjectObj)))
        this.loadEnvironments()
      }
    },
    deleteEnvironemt (env) {
      if (!this.isDashboard) {
        const projectJsonPath = config.electron.defaultProjectPath
        const freshProjectObj = JSON.parse(JSON.stringify(this.$store.state.project.defaultProject))
        delete freshProjectObj.envs[env]
        fs.writeFileSync(
          projectJsonPath,
          JSON.stringify(freshProjectObj, null, 2),
          'utf-8')
        this.$store.commit('project/setDefaultProjectJson', JSON.parse(JSON.stringify(freshProjectObj)))
        this.loadEnvironments()
      }
    },
    // add extra column if last row is filled
    handleInput (env, i, key) {
      if (i === this.envValues[env].data.length - 1 && key.length) {
        this.envValues[env].data = [...this.envValues[env].data, { key: '', value: '', enabled: true }]
      }
    },
    // remove environment key
    removeKey (env, i) {
      this.envValues[env].data.splice(i, 1)
      if (!this.envValues[env].data.length) {
        this.envValues[env].data = [{ key: '', value: '', enabled: true }]
      }
    },
    // filter empty environments and save project JSON
    async saveEnvironmentFile (projectJsonPath, freshProject) {
      this.envs.forEach((env) => {
        let envObj = {}
        if (!this.envValues[env] || !this.envValues[env].data) { this.$set(this.envValues, env, { data: [] }) } else { envObj = this.envValues[env] }
        if (env === 'global') {
          freshProject.apiClient.data = envObj.data.filter(o => o.key.trim())
        } else {
          freshProject.envs[env].apiClient.data = envObj.data.filter(o => o.key.trim())
        }
      })

      fs.writeFileSync(
        projectJsonPath,
        JSON.stringify(freshProject, null, 2),
        'utf-8')
    },
    async saveEnvironment (env) {
      try {
        let projectJsonPath, freshProjectObj

        // make a copy of project json and get it's file path
        // save the changes made to project json and update in state
        if (this.isDashboard) {
          projectJsonPath = path.join(this.$store.getters['project/currentProjectFolder'], 'config.xc.json')
          freshProjectObj = JSON.parse(fs.readFileSync(projectJsonPath))
          await this.saveEnvironmentFile(projectJsonPath, freshProjectObj)
          this.$store.commit('project/setProjectJson', JSON.parse(JSON.stringify(freshProjectObj), (key, value) => {
            return typeof value === 'string' ? Handlebars.compile(value, { noEscape: true })(process.env) : value
          }))
        } else {
          projectJsonPath = config.electron.defaultProjectPath
          freshProjectObj = JSON.parse(JSON.stringify(this.$store.state.project.defaultProject))
          await this.saveEnvironmentFile(projectJsonPath, freshProjectObj)
          this.$store.commit('project/setDefaultProjectJson', JSON.parse(JSON.stringify(freshProjectObj)))
        }

        this.$toast.success('Environment saved successfully').goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error('Invalid JSON failed to save environment').goAway(3000)
      }
    },
    // load current environment values for active project from state
    loadEnvironments () {
      let projectJsonObj
      if (this.isDashboard) {
        projectJsonObj = this.$store.getters['project/GtrProjectJson']
      } else {
        projectJsonObj = this.$store.state.project.defaultProject
      }

      // extract environment object (key-value pair)
      this.envValues = JSON.parse(JSON.stringify({
        global: projectJsonObj.apiClient,
        ...(projectJsonObj.envs
          ? Object.entries(projectJsonObj.envs)
            .reduce((obj, [name, env]) => ({ [name]: env.apiClient, ...obj }), {})
          : [])
      }))

      // add extra empty environment to show in form
      for (const env in this.envValues) {
        this.envValues[env].data.push({ key: '', value: '', enabled: true })
      }
    }
  },
  beforeCreated () {
  },
  destroy () {
  }
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
