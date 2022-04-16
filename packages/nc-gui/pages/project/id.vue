<template>
  <v-container fluid>
    <v-col class="col-md-8 offset-md-2 col-sm-10 offset-sm-1 col-12" style="position: relative">
      <v-form
        ref="form"
        v-model="valid"
        class="mt-8 pt-8"
      >
        <v-card
          ref="mainCard"
          class="elevation-5"
        >
          <div
            style="position: absolute;top:-30px;
                  left:-moz-calc(50% - 30px);
                  left:-webkit-calc(50% - 30px);
                  left:calc(50% - 30px);
                  z-index: 999;
                  border-radius: 10px;
                  "
            class="primary"
          >
            <v-img
              class="mx-auto"
              width="60"
              height="60"
              :src="require('~/assets/img/icons/512x512-trans.png')"
            />
          </div>
          <!-- Create Project -->
          <v-toolbar flat color="" class="mb-3" style="width: 100%; border-bottom: 1px solid grey">
            <v-toolbar-title class="display-1 ">
              {{ $t('activity.createProject') }}
            </v-toolbar-title>
            <v-spacer />
            <x-btn
              v-ge="['project','cancel']"
              tooltip="Cancel and Return"
              to="/"
              class="elevation-20"
            >
              <!-- Cancel -->
              {{ $t('general.cancel') }}
            </x-btn>
            <x-btn
              v-ge="['project','save']"
              :disabled="!valid || !envStatusValid"
              class="primary"
              @click="createOrUpdateProject()"
            >
              Save Project
            </x-btn>
            <v-progress-linear
              v-if="projectReloading"
              top
              absolute
              color="success"
              indeterminate
              height="3"
              style="top:-3px"
            />
          </v-toolbar>

          <div ref="panelContainer" style="">
            <v-overlay v-if="projectReloading" absolute color="grey" opacity="0.4">
              <div class="d-flex flex-column justify-center align-center" />
            </v-overlay>
            <v-container fluid>
              <v-row>
                <v-col cols="6" offset="3 " class="mb-0 pb-0">
                  <!--                  <div class="ml-7 pb-5" v-if="edit">-->
                  <!--                    <x-btn-->
                  <!--                      :tooltip="getProjectEditTooltip()"-->
                  <!--                      :disabled="!this.edit"-->
                  <!--                      btn.class="primary"-->
                  <!--                      icon="mdi-circle-edit-outline"-->
                  <!--                      @click="openJsonInSystemEditor()">-->
                  <!--                      &nbsp;&nbsp;<p class="pa-0 ma-0"><b>Open Editor</b> <span-->
                  <!--                      class="caption">(to edit Project Json)</span>-->
                  <!--                    </p>-->
                  <!--                    </x-btn>-->

                  <!--                  </div>-->
                  <v-text-field
                    v-model="project.title"
                    v-ge="['project','name']"
                    :rules="form.titleRequiredRule"
                    :height="20"
                    label="Enter Project Name"
                    autofocus
                  >
                    <v-icon slot="prepend" color="info" class="blink_me">
                      mdi-lightbulb-on
                    </v-icon>
                  </v-text-field>

                  <v-select
                    v-model="project.projectType"
                    hint="Choose Project type"
                    persistent-hint
                    dense
                    :items="projectTypes"
                  >
                    <template #prepend>
                      <img v-if="typeIcon.type === 'img'" :src="typeIcon.icon" style="width: 32px">
                      <v-icon v-else :color="typeIcon.iconColor">
                        {{ typeIcon.icon }}
                      </v-icon>
                    </template>
                    <template #item="{item}">
                      <span class="caption d-flex align-center">
                        <img v-if="item.type === 'img'" :src="item.icon" style="width: 30px">
                        <v-icon v-else :color="item.iconColor">{{ item.icon }}</v-icon> &nbsp; {{ item.text }}</span>
                    </template>
                  </v-select>
                </v-col>

                <v-col
                  v-show="project.title.trim().length"
                  cols="10"
                  offset="1"
                  :class="{'mt-0 pt-0':!edit,'mt-3 pt-3':edit}"
                >
                  <h2 :class="{'text-center mb-2':!edit,'text-center mb-2 grey--text':edit}">
                    {{ project.title.toUpperCase() }}'s
                    Environments
                  </h2>
                  <v-expansion-panels
                    v-model="panel"
                    focusable
                    accordion=""
                    class="elevation-20"
                    style="border: 1px solid white"
                  >
                    <v-expansion-panel

                      v-for="(envData,envKey,panelIndex) in project.envs"
                      :key="panelIndex"
                      :ref="`panel${envKey}`"
                      @change="onPanelToggle(panelIndex,envKey)"
                    >
                      <v-expansion-panel-header disable-icon-rotate>
                        <p class="pa-0 ma-0">
                          <v-icon>mdi-test-tube</v-icon> &nbsp;
                          <span class="title">&nbsp;<b>'{{ envKey }}'</b> environment : </span>
                          <v-tooltip
                            v-for="(db,tabIndex) in envData.db"
                            :key="tabIndex"
                            bottom
                          >
                            <template #activator="{ on }">
                              <v-icon
                                small
                                :color="getDbStatusColor(db)"
                                @click.native.stop="showDBTabInEnvPanel(panelIndex,tabIndex)"
                                v-on="on"
                              >
                                mdi-database
                              </v-icon>
                            </template>
                            <span>{{ getDbStatusTooltip(db) }}</span>
                          </v-tooltip>

                          <span v-if="project.ui[envKey]" class="caption" :class="project.ui[envKey].color + '--text'">
                            <i>{{ project.ui[envKey].msg }}</i>
                          </span>

                          <x-btn
                            v-if="panelIndex"
                            v-ge="['project','env-delete']"
                            small
                            text
                            btn.class="float-right"
                            tooltip="Click here to remove environment"
                            @click.native.stop="removeEnv(envKey)"
                          >
                            <v-hover v-slot="{ hover }">
                              <v-icon :color="hover ? 'error' : 'grey'" @click.native.stop="removeEnv(envKey)">
                                mdi-delete
                              </v-icon>
                            </v-hover>
                          </x-btn>
                        </p>
                        <template #actions>
                          <v-tooltip v-if="getEnvironmentStatusAggregated(envData.db)" bottom>
                            <template #activator="{ on }">
                              <v-icon color="green" v-on="on">
                                mdi-check-circle
                              </v-icon>
                            </template>
                            <span>Environment setup complete</span>
                          </v-tooltip>
                          <v-tooltip v-else-if="edit" bottom>
                            <template #activator="{ on }">
                              <v-icon color="orange" v-on="on">
                                mdi-alert-circle
                              </v-icon>
                            </template>
                            <span>Environment setup pending</span>
                          </v-tooltip>
                        </template>
                      </v-expansion-panel-header>
                      <v-expansion-panel-content eager>
                        <v-col>
                          <v-card flat="">
                            <v-tabs v-model="databases[panelIndex]" background-color="">
                              <v-tab v-for="(db,dbIndex) in project.envs[envKey].db" :key="dbIndex">
                                <v-icon>mdi-database</v-icon> &nbsp;{{ db.connection.database }}
                              </v-tab>
                              <v-tooltip bottom>
                                <template #activator="{ on }">
                                  <x-btn
                                    v-ge="['project','env-db-add']"
                                    tooltip="Add New Database to Environment"
                                    text
                                    small
                                    class="ma-2"
                                    v-on="on"
                                    @click.prevent.stop="addNewDB(envKey,panelIndex)"
                                  >
                                    <v-hover v-slot="{ hover }">
                                      <v-icon :color="hover ? 'primary' : 'grey'">
                                        mdi-database-plus
                                      </v-icon>
                                    </v-hover>
                                  </x-btn>
                                </template>
                                <span>Add new database to '{{ envKey }}' environment</span>
                              </v-tooltip>

                              <v-tabs-items v-model="databases[panelIndex]">
                                <v-tab-item v-for="(db,dbIndex) in project.envs[envKey].db" :key="dbIndex">
                                  <v-card flat>
                                    <!--                            <form ref="form" class="pa-3">-->
                                    <v-container class="justify-center">
                                      <v-row>
                                        <v-col cols="4" class="py-0">
                                          <v-select
                                            v-model="client[dbIndex]"
                                            v-ge="['project','env-db-change']"
                                            class="body-2 db-select"
                                            :items="Object.keys(databaseNames)"
                                            label="Database Type"
                                            @change="onDatabaseTypeChanged(client[dbIndex],db,dbIndex,envKey)"
                                          >
                                            <template slot="item" slot-scope="data">
                                              {{ data.item }}
                                              <!--                                              <div class="d-flex flex-column mx-auto "-->
                                              <!--                                                   style="width:100%;border-bottom: 1px solid #ddd">-->
                                              <!--                                                <img class="mx-auto py-3" width="80" :src="dbIcons[data.item]"/>-->
                                              <!--                                                &lt;!&ndash;                                              {{ data.item }}&ndash;&gt;-->

                                              <!--                                                <p v-if="!databaseNames[data.item]" class="text-center grey&#45;&#45;text">-->
                                              <!--                                                  Coming soon</p>-->
                                              <!--                                              </div>-->
                                            </template>
                                          </v-select>
                                        </v-col>

                                        <v-col v-if="db.client === 'sqlite3'" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.connection.filename"
                                            v-ge="['project','env-db-file']"
                                            :rules="form.folderRequiredRule"
                                            label="SQLite File"
                                            @click="selectSqliteFile(db)"
                                          >
                                            <v-icon slot="prepend" color="info">
                                              mdi-file-outline
                                            </v-icon>
                                          </v-text-field>
                                        </v-col>

                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.host"
                                            v-ge="['project','env-db-host']"
                                            class="body-2"
                                            :rules="form.requiredRule"
                                            label="Host address"
                                          />
                                        </v-col>
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.port"
                                            v-ge="['project','env-db-port']"
                                            class="body-2"
                                            label="Port number"
                                            :rules="form.portValidationRule"
                                          />
                                        </v-col>
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.user"
                                            v-ge="['project','env-db-user']"
                                            class="body-2"
                                            :rules="form.requiredRule"
                                            label="Username"
                                          />
                                        </v-col>
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            :ref="`password${envKey}`"
                                            v-model="db.connection.password"
                                            v-ge="['project','env-db-password']"
                                            class="body-2 db-password"
                                            :type="showPass[`${panelIndex}_${dbIndex}`] ? 'text' : 'password'"
                                            label="Password"
                                          >
                                            <template #append>
                                              <v-icon
                                                small
                                                @click="$set(showPass,`${panelIndex}_${dbIndex}` , !showPass[`${panelIndex}_${dbIndex}`])"
                                              >
                                                {{
                                                  showPass[`${panelIndex}_${dbIndex}`] ? 'visibility_off' :
                                                  'visibility'
                                                }}
                                              </v-icon>
                                            </template>
                                          </v-text-field>
                                        </v-col>
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.database"
                                            v-ge="['project','env-db-name']"
                                            class="body-2"
                                            :rules="form.requiredRule"
                                            label="Database : create if not exists"
                                          />
                                        </v-col>
                                        <v-col v-if="db.client !== 'sqlite3'" class="">
                                          <v-expansion-panels>
                                            <v-expansion-panel
                                              style="border: 1px solid wheat"
                                            >
                                              <v-expansion-panel-header>
                                                <span class="grey--text">SSL / Advanced parameters</span>
                                              </v-expansion-panel-header>
                                              <v-expansion-panel-content>
                                                <v-card class="elevation-0">
                                                  <v-card-text>
                                                    <v-select
                                                      v-model="db.ui.sslUse"
                                                      :items="Object.keys(sslUsage)"
                                                    />

                                                    <v-row class="pa-0 ma-0">
                                                      <x-btn
                                                        v-ge="['project','env-db-cert']"
                                                        tooltip="Select .cert file"
                                                        small
                                                        color="primary"
                                                        outlined
                                                        class="elevation-5"
                                                        @click="selectFile(db,'ssl', 'certFilePath')"
                                                      >
                                                        {{ db.ui.ssl.cert }}
                                                      </x-btn>
                                                      <x-btn
                                                        v-ge="['project','env-db-key']"
                                                        tooltip="Select .key file"
                                                        small
                                                        color="primary"
                                                        outlined
                                                        class="elevation-5"
                                                        @click="selectFile(db,'ssl', 'keyFilePath')"
                                                      >
                                                        {{ db.ui.ssl.key }}
                                                      </x-btn>

                                                      <x-btn
                                                        v-ge="['project','env-db-ca']"
                                                        tooltip="Select CA file"
                                                        small
                                                        color="primary"
                                                        outlined
                                                        @click="selectFile(db,'ssl', 'caFilePath')"
                                                      >
                                                        {{ db.ui.ssl.ca }}
                                                      </x-btn>
                                                    </v-row>

                                                    <v-row>
                                                      <v-col>
                                                        <v-select
                                                          v-model="db.meta.inflection.table_name"
                                                          label="Inflection - Table name"
                                                          multiple
                                                          :items="['camelize','pluralize']"
                                                        />
                                                      </v-col>
                                                      <v-col>
                                                        <v-select
                                                          v-model="db.meta.inflection.column_name"
                                                          label="Inflection - Column name"
                                                          multiple
                                                          :items="['camelize']"
                                                        />
                                                      </v-col>
                                                    </v-row>
                                                  </v-card-text>
                                                </v-card>
                                              </v-expansion-panel-content>
                                            </v-expansion-panel>
                                          </v-expansion-panels>
                                        </v-col>
                                      </v-row>

                                      <v-row class="text-right justify-end">
                                        <x-btn
                                          v-ge="['project','env-db-test-connection']"
                                          tooltip="Test Database Connection"
                                          outlined
                                          small
                                          @click="testConnection(db,envKey,panelIndex)"
                                        >
                                          Test Database Connection
                                        </x-btn>
                                        <x-btn
                                          v-if="dbIndex"
                                          v-ge="['project','env-db-delete']"
                                          tooltip="Remove Database from environment"
                                          text
                                          small
                                          @click="removeDBFromEnv(db,envKey,panelIndex,dbIndex)"
                                        >
                                          <v-hover v-slot="{ hover }">
                                            <v-icon :color="hover ? 'error' : 'grey'">
                                              mdi-database-remove
                                            </v-icon>
                                          </v-hover>
                                        </x-btn>
                                      </v-row>
                                    </v-container>
                                    <!--                            </form>-->
                                  </v-card>
                                </v-tab-item>
                              </v-tabs-items>
                            </v-tabs>
                          </v-card>
                        </v-col>
                      </v-expansion-panel-content>
                    </v-expansion-panel>

                    <v-expansion-panel>
                      <v-expansion-panel-header disable-icon-rotate>
                        <v-tooltip bottom>
                          <template #activator="{ on }">
                            <x-btn
                              v-ge="['project','env-add']"
                              tooltip="Add New Environment to Project"
                              color="grey"
                              block
                              outlined
                              v-on="on"
                              @click.stop="addNewEnvironment"
                            >
                              <v-icon>mdi-plus</v-icon>
                              Add Another Environment
                            </x-btn>
                          </template>
                          <span>Add new environment to {{ project.title }} project</span>
                        </v-tooltip>
                        <template #actions>
                          <i />
                        </template>
                      </v-expansion-panel-header>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-col>

                <v-col
                  v-show="project.title.trim().length"
                  cols="10"
                  offset="1"
                  :class="{'mt-0 pt-0':!edit,'mt-3 pt-3':edit}"
                >
                  <!--                  <h2 :class="{'text-center mb-2':!edit,'text-center mb-2 grey&#45;&#45;text':edit}">-->
                  <!--                    Advanced Configuration</h2>-->
                  <v-expansion-panels
                    focusable
                    accordion=""
                    class="elevation-20"
                    style="border: 1px solid grey"
                  >
                    <v-expansion-panel>
                      <v-expansion-panel-header disable-icon-rotate>
                        <p class="pa-0 ma-0">
                          <v-icon class="mt-n2 " color="grey darken-1">
                            mdi-cog
                          </v-icon> &nbsp;
                          <span class="grey--text text--darken-1">&nbsp;Advanced Configuration </span>
                        </p>
                      </v-expansion-panel-header>
                      <v-expansion-panel-content eager>
                        <v-container class="justify-center">
                          <v-row>
                            <v-col cols="12" class="py-0">
                              <v-select
                                v-model="auth.authType"
                                hint="Choose Authentication type"
                                persistent-hint
                                dense
                                :items="authTypes"
                              >
                                <template #item="{item}">
                                  <span class="caption">
                                    {{ item.text }}</span>
                                </template>
                              </v-select>
                            </v-col>
                            <v-col v-if="auth.authType && auth.authType !== 'none'" cols="12" class="py-0">
                              <v-text-field

                                v-if="auth.authType !== 'middleware'"
                                v-model="auth.authSecret"
                                label="Enter Auth Secret (Randomly generated)"
                                :type="showSecret ? 'text' : 'password'"
                              >
                                <template #append>
                                  <v-icon
                                    small
                                    @click="showSecret = !showSecret"
                                  >
                                    {{
                                      showSecret ? 'visibility_off' :
                                      'visibility'
                                    }}
                                  </v-icon>
                                </template>
                              </v-text-field>
                              <v-text-field
                                v-else

                                v-model="auth.webhook"
                                label="Webhook url"
                              />
                            </v-col>
                          </v-row>
                        </v-container>
                      </v-expansion-panel-content>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-col>
              </v-row>
            </v-container>
          </div>
        </v-card>
      </v-form>
    </v-col>
    <dlgOk
      v-if="dialog.show"
      :dialog-show="dialog.show"
      :mtd-ok="dialog.mtdOk"
      :heading="dialog.heading"
      :type="dialog.type"
    />

    <textDlgSubmitCancel
      v-if="dialogGetEnvName.dialogShow"
      :dialog-show="dialogGetEnvName.dialogShow"
      :heading="dialogGetEnvName.heading"
      :mtd-dialog-submit="mtdDialogGetEnvNameSubmit"
      :mtd-dialog-cancel="mtdDialogGetEnvNameCancel"
    />

    <div v-if="project.title.trim().length" class="floating-button">
      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            v-ge="['project','save']"
            fab
            dark
            large
            tooltip="Scroll to top"
            :disabled="!valid || !envStatusValid"
            class="primary"
            v-on="on"
            @click="createOrUpdateProject()"
          >
            <v-icon>save</v-icon>
          </v-btn>
        </template>
        <span>
          Save Project
        </span>
      </v-tooltip>
    </div>
  </v-container>
</template>
<script>
/* eslint-disable */

import { mapGetters, mapActions } from 'vuex'
import Vue from 'vue'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import textDlgSubmitCancel from '../../components/utils/dlgTextSubmitCancel'

import dlgOk from '../../components/utils/dlgOk.vue'
import XBtn from '../../components/global/xBtn'

const { uniqueNamesGenerator, starWars, adjectives, animals } = require('unique-names-generator')

const homeDir = ''

export default {

  components: {
    XBtn,
    dlgOk,
    textDlgSubmitCancel
  },
  layout: 'empty',
  data () {
    return {
      showSecret: false,
      loaderMessages: [
        'Setting up new database configs',
        'Inferring database schema',
        'Generating APIs.',
        'Generating APIs..',
        'Generating APIs...',
        'Generating APIs....',
        'Please wait...'
      ],
      loaderMessage: '',
      projectReloading: false,
      authTypes: [
        { text: 'JWT', value: 'jwt' },
        { text: 'Master Key', value: 'masterKey' },
        { text: 'Middleware', value: 'middleware' },
        { text: 'Disabled', value: 'none' }
      ],
      projectTypes: [
        { text: 'Automatic REST APIs on database', value: 'rest', icon: 'mdi-code-json', iconColor: 'green' },
        { text: 'Automatic GRAPHQL APIs on database', value: 'graphql', icon: 'mdi-graphql', iconColor: 'pink' },
        { text: 'Automatic gRPC APIs on database', value: 'grpc', icon: 'grpc-icon-color.png', type: 'img' }
        // {
        //   text: 'Automatic SQL Schema Migrations',
        //   value: 'migrations',
        //   icon: 'mdi-database-sync',
        //   iconColor: 'indigo'
        // },
        // {text: 'Simple Database Connection', value: 'dbConnection', icon: 'mdi-database', iconColor: 'primary'},
      ],

      showPass: {},
      /** ************** START : form related ****************/
      form: {
        portValidationRule: [v => /^\d+$/.test(v) || 'Not a valid port'],
        titleRequiredRule: [v => !!v || 'Title is required'],
        requiredRule: [v => !!v || 'Field is required'],
        folderRequiredRule: [v => !!v || 'Folder path is required']
      },
      valid: null,
      panel: null,
      client: ['Sqlite'],
      baseFolder: homeDir,

      tab: null,
      env: null,
      databases: [],
      /** ************** END : form related ****************/
      auth: {
        authSecret: uuidv4(),
        authType: 'jwt',
        webhook: null
      },
      project: {},
      defaultProject: {
        title: '',
        folder: homeDir,
        envs: {
          _noco: {
            db: [
              {
                client: 'pg',
                connection: {
                  host: 'localhost',
                  port: '5432',
                  user: 'postgres',
                  password: 'password',
                  database: '_dev',
                  ssl: {
                    ca: '',
                    key: '',
                    cert: ''
                  }
                },
                meta: {
                  tn: 'nc_evolutions',
                  dbAlias: 'db',
                  api: {
                    type: 'rest',
                    prefix: '',
                    graphqlDepthLimit: 10
                  },
                  inflection: {
                    tn: []
                  }
                },
                ui: {
                  setup: -1,
                  ssl: {
                    key: 'Client Key',
                    cert: 'Client Cert',
                    ca: 'Server CA'
                  },
                  sslUse: 'Preferred'
                }
              }
            ],
            apiClient: {
              data: []
            }
          }
        },
        workingEnv: '_noco',
        ui: {
          envs: {
            _noco: {}

          }
        },
        meta: {
          version: '0.5',
          seedsFolder: 'seeds',
          queriesFolder: 'queries',
          apisFolder: 'apis',
          projectType: 'rest',
          type: 'mvc',
          language: 'ts'
        },
        version: '0.5',
        seedsFolder: 'seeds',
        queriesFolder: 'queries',
        apisFolder: 'apis',
        projectType: 'rest',
        type: 'mvc',
        language: 'ts',
        apiClient: {
          data: []
        }
      },

      sampleConnectionData: {
        Postgres: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: 'password',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        MySQL: {
          host: 'localhost',
          port: '3306',
          user: 'root',
          password: 'password',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        Vitess: {
          host: 'localhost',
          port: '15306',
          user: 'root',
          password: 'password',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        MsSQL: {
          host: 'localhost',
          port: 1433,
          user: 'sa',
          password: 'Password123.',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        Oracle: {
          host: 'localhost',
          port: '1521',
          user: 'system',
          password: 'Oracle18',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        Sqlite: {
          client: 'sqlite3',
          database: homeDir,
          connection: {
            filename: homeDir
          },
          useNullAsDefault: true

        }

      },

      edit: false,
      dialog: {
        show: false,
        title: '',
        heading: '',
        mtdOk: this.testConnectionMethodSubmit,
        type: 'primary'
      },
      sslUsage: {
        No: 'No',
        Preferred: 'Preferred',
        Required: 'pg',
        'Required-CA': 'Required-CA',
        'Required-IDENTITY': 'Required-IDENTITY'
      },
      sslUse: 'Preferred',
      ssl: {
        key: 'Client Key',
        cert: 'Client Cert',
        ca: 'Server CA'
      },
      databaseNames: {
        MySQL: 'mysql2',
        Postgres: 'pg',
        Oracle: 'oracledb',
        MsSQL: 'mssql',
        Sqlite: 'sqlite3'
        // 'Google Analytics': '',
        // Vitess: "mysql",
        // 'Salesforce': '',
        // 'SAP': '',
        // 'Stripe': '',
      },
      testDatabaseNames: {
        mysql2: null,
        mysql: null,
        pg: 'postgres',
        oracledb: 'xe',
        mssql: undefined,
        sqlite3: 'a.sqlite'
      },
      dbIcons: {
        Oracle: 'temp/db/oracle.png',
        Postgres: 'temp/db/postgre.png',
        MySQL: 'temp/db/mysql.png',
        MsSQL: 'temp/db/mssql.png',
        Sqlite: 'temp/db/sqlite.svg',
        Salesforce: 'temp/salesforce-3-569548.webp',
        SAP: 'temp/sap.png',
        Stripe: 'temp/stripe.svg'
      },
      dialogGetEnvName: {
        dialogShow: false,
        heading: 'Enter New Environment Name',
        field: 'Environment Name'
      },

      compErrorMessages: [
        'Invalid character in folder path.',
        'Invalid database credentials.',
        'Unable to connect to database, please check your database is up.',
        'User does not exist or have sufficient permission to create schema.'
      ],
      compErrorMessage: ''
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }),
    envStatusValid () {
      return Object.values(this.project.envs).every(this.getEnvironmentStatusAggregatedNew)
    },
    typeIcon () {
      if (this.project.projectType) {
        return this.projectTypes.find(({ value }) => value === this.project.projectType)
      } else {
        return { icon: 'mdi-server', iconColor: 'primary' }
      }
    },
    databaseNamesReverse () {
      return Object.entries(this.databaseNames).reduce((newObj, [value, key]) => {
        newObj[key] = value
        return newObj
      }, {})
    }
  },
  methods: {

    ...mapActions({
      loadProjects: 'project/loadProjects'
    }),

    getProjectEditTooltip () {
      // return `Opens ${path.join(this.project.folder, 'config.xc.json')} and edit - its really simple`;
    },
    openJsonInSystemEditor () {
      // shell.openItem(path.join(this.project.folder, 'config.xc.json'));
    },

    selectFile (db, obj, key) {
      // console.log(obj, key);
      // const file = dialog.showOpenDialog({
      //   properties: ['openFile']
      // })
      // console.log(typeof file, file, typeof file[0])
      // if (file && file[0]) {
      //   const fileName = path.basename(file[0])
      //   db.ui[obj][key] = fileName
      //   Vue.set(db.ui[obj], key, fileName)
      //   // db.connection[obj][key] = file[0].toString();
      //   Vue.set(db.connection[obj], key, file[0].toString())
      // }
    },
    onPanelToggle (panelIndex, envKey) {
      this.$nextTick(() => {
        if (this.panel !== undefined) {
          const panelContainer = this.$refs.panelContainer
          const panel = this.$refs[`panel${envKey}`][0].$el
          setTimeout(() => panelContainer.scrollTop = (panel.getBoundingClientRect().top + panelContainer.scrollTop) - panelContainer.getBoundingClientRect().top - 50, 500)
          setTimeout(() => this.$refs[`password${envKey}`][0].focus())
        }
      })
    },
    scrollToTop () {
      document.querySelector('html').scrollTop = 0
    },
    showDBTabInEnvPanel (panelIndex, tabIndex) {
      this.panel = panelIndex
      Vue.set(this.databases, panelIndex, tabIndex)
    },
    getProjectJson () {
      /**
       * remove UI keys within project
       */
      const xcConfig = JSON.parse(JSON.stringify(this.project))
      delete xcConfig.ui

      for (const env in xcConfig.envs) {
        for (let i = 0; i < xcConfig.envs[env].db.length; ++i) {
          xcConfig.envs[env].db[i].meta.api.type = this.project.projectType
          if (xcConfig.envs[env].db[i].client === 'mysql' || xcConfig.envs[env].db[i].client === 'mysql2') {
            xcConfig.envs[env].db[i].connection.multipleStatements = true
          }
          this.handleSSL(xcConfig.envs[env].db[i], false)
          delete xcConfig.envs[env].db[i].ui
          if (this.client[i] === 'Vitess') {
            xcConfig.envs[env].db[i].meta.dbtype = 'vitess'
          }
          if (xcConfig.envs[env].db[i].client === 'oracledb') {
            xcConfig.envs[env].db[i].pool = {
              min: 0, max: 50
            }

            xcConfig.envs[env].db[i].acquireConnectionTimeout = 60000
          }

          const inflectionObj = xcConfig.envs[env].db[i].meta.inflection

          if (inflectionObj) {
            if (Array.isArray(inflectionObj.table_name)) {
              inflectionObj.table_name = inflectionObj.table_name.join(',')
            }
            if (Array.isArray(inflectionObj.column_name)) {
              inflectionObj.column_name = inflectionObj.column_name.join(',')
            }

            inflectionObj.table_name = inflectionObj.table_name || 'none'
            inflectionObj.column_name = inflectionObj.column_name || 'none'
          }
        }
      }

      xcConfig.auth = {}
      switch (this.auth.authType) {
        case 'jwt':
          xcConfig.auth.jwt = {
            secret: this.auth.authSecret,
            dbAlias: xcConfig.envs[Object.keys(xcConfig.envs)[0]].db[0].meta.dbAlias
          }
          break
        case 'masterKey':
          xcConfig.auth.masterKey = {
            secret: this.auth.authSecret
          }
          sessionStorage.setItem('admin-secret', this.auth.authSecret)
          break
        case 'middleware':
          xcConfig.auth.masterKey = {
            url: this.auth.webhook
          }
          break
        default:
          this.auth.disabled = true
          break
      }

      xcConfig.type = this.$store.state.project.projectInfo ? this.$store.state.project.projectInfo.type : 'docker'

      return xcConfig
    },

    constructProjectJsonFromProject (project) {
      // const {projectJson: envs, ...rest} = project;

      // let p = {...rest, ...envs};
      const p = JSON.parse(JSON.stringify(project.projectJson))

      p.ui = {
        envs: {
          _noco: {}
        }
      }
      for (const env in p.envs) {
        let i = 0
        for (const db of p.envs[env].db) {
          Vue.set(this.client, i++, this.databaseNamesReverse[db.client])

          Vue.set(db, 'ui', {
            setup: 0,
            ssl: {
              key: 'Client Key',
              cert: 'Client Cert',
              ca: 'Server CA'
            },
            sslUse: 'Preferred'
          })
        }
      }
      delete p.projectJson

      if (p.auth) {
        if (p.auth.jwt) {
          this.auth.authType = 'jwt'
          this.auth.authSecret = p.auth.jwt.secret
        } else if (p.auth.masterKey) {
          if (p.auth.masterKey.secret) {
            this.auth.authSecret = p.auth.masterKey.secret
            this.auth.authType = 'masterKey'
          } else if (p.auth.masterKey.url) {
            this.auth.webhook = p.auth.masterKey.url
            this.auth.authType = 'middleware'
          } else {
            this.auth.authType = 'none'
          }
        } else {
          this.auth.authType = 'none'
        }
      } else {
        this.auth.authType = 'none'
      }

      this.project = p
    },

    async createOrUpdateProject () {
      // if (this.$store.state.windows.isComp) {
      //   try {
      //     ga('send', 'event', 'NewProject.', 'Action failed', this.$store.state.windows.isComp);
      //   } catch (e) {
      //   }
      //   this.$toast.info(this.compErrorMessage).goAway(800);
      //   return;
      // }

      const projectJson = this.getProjectJson()
      // electron error from this.sqlMgr.projectCreate1 this fn
      // Attempting to call a function in a renderer window that has been closed or released.
      // const result = await this.sqlMgr.projectCreate1({
      //   project: {
      //     title: this.project.title,
      //     folder: this.project.folder,
      //     type: 'mysql'
      //   },
      //   projectJson
      // });

      const folder = projectJson.folder
      delete projectJson.folder

      // let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
        {
          query: {
            skipProjectHasDb: 1
          }
        },
        this.edit ? 'projectUpdateByWeb' : 'projectCreateByWeb',
        // "projectCreate1",
        {
          project: {
            title: projectJson.title,
            folder: 'config.xc.json', // slash(path.join(folder, 'config.xc.json')),
            type: 'pg'
          },
          projectJson
        }])


      this.projectReloading = true

      let i = 0
      const toast = this.$toast.info(this.loaderMessages[0])
      await new Promise((resolve) => {
        const interv = setInterval(() => {
          if (i < this.loaderMessages.length - 1) { i++ }
          if (toast) {
            toast.text(this.loaderMessages[i])
          }

          axios.create({
            baseURL: `${this.$axios.defaults.baseURL}/dashboard`
          }).get('').then(() => {
            toast.goAway(100)
            this.projectReloading = false
            clearInterval(interv)
            resolve()
          }).catch((err) => {
          })
        }, 1000)
      })

      await this.$store.dispatch('project/ActLoadProjectInfo')

      if (this.$store.state.project.projectInfo.firstUser || this.$store.state.project.projectInfo.authType === 'masterKey') {
        return this.$router.push({
          path: '/user/authentication/signup'
        })
      }

      this.$router.push({
        path: '/'
      })
    },

    mtdDialogGetEnvNameSubmit (envName, cookie) {
      this.dialogGetEnvName.dialogShow = false
      if (envName in this.project.envs) {
      } else {
        Vue.set(this.project.envs, envName,
          {
            db: [
              {
                client: 'pg',
                connection: {
                  host: 'localhost',
                  port: '5432',
                  user: 'postgres',
                  password: 'password',
                  database: 'new_database'
                },
                meta: {
                  tn: 'xc_evolutions',
                  dbAlias: 'db',
                  inflection: {
                    tn: []
                  }
                },
                ui: {
                  setup: 0,
                  ssl: {
                    key: 'Client Key',
                    cert: 'Client Cert',
                    ca: 'Server CA'
                  },
                  sslUse: 'Preferred'
                }
              }
            ],
            apiClient: { data: [] }
          })
      }
    },
    mtdDialogGetEnvNameCancel () {
      this.dialogGetEnvName.dialogShow = false
    },

    addNewEnvironment () {
      this.dialogGetEnvName.dialogShow = true
    },
    addNewDB (envKey, panelIndex) {
      const len = this.project.envs[envKey].db.length
      const lastDbName = `${this.project.title}_${envKey}_${len}`
      const dbType = this.client[len] = this.client[len] || this.client[len - 1]
      const newlyCreatedIndex = this.project.envs[envKey].db.length
      const dbAlias = this.project.envs[envKey].db.length <= 0 ? 'db' : `db${this.project.envs[envKey].db.length + 1}`
      this.project.envs[envKey].db.push({
        client: this.databaseNames[dbType],
        connection: {
          ...this.sampleConnectionData[dbType],
          database: `${this.project.title}_${envKey}_${newlyCreatedIndex + 1}`
        },
        meta: {
          tn: 'xc_evolutions',
          dbAlias,
          inflection: {
            tn: []
          },
          api: {
            type: ''
          }
        },
        ui: {
          setup: 0,
          sslUse: 'Preferred',
          ssl: {
            key: 'Client Key',
            cert: 'Client Cert',
            ca: 'Server CA'
          }
        }
      })
      // set active tab as newly created
      this.databases[panelIndex] = newlyCreatedIndex
    },

    testConnectionMethodSubmit () {
      this.dialog.show = false
    },
    selectDir (ev) {
      // console.log(ev)
      const file = dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (file && file[0]) {
        this.baseFolder = file[0]
        this.project.folder = file[0]
        this.userSelectedDir = true
      }
    },
    selectSqliteFile (db) {
      // console.log(ev)
      const file = dialog.showOpenDialog({
        properties: ['openFile']
      })
      if (file && file[0]) {
        db.connection.connection.filename = file[0]
      }
    },

    getDbStatusColor (db) {
      switch (db.ui.setup) {
        case -1:
          return 'red'
          break
        case 0:
          return 'orange'
          break
        case 1:
          return 'green'
          break
        default:
          break
      }
    },

    getDbStatusTooltip (db) {
      switch (db.ui.setup) {
        case -1:
          return 'DB Connection NOT successful'
          break
        case 0:
          return 'MySql Database Detected - Test your connection'
          break
        case 1:
          return 'DB Connection successful'
          break
        default:
          break
      }
    },
    async newTestConnection (db, env, panelIndex) {
      if (db.connection.host === 'localhost' &&
        !this.edit &&
        env === '_noco' &&
        this.project.envs[env].db.length === 1 &&
        this.project.envs[env].db[0].connection.user === 'postgres' &&
        this.project.envs[env].db[0].connection.database === `${this.project.title}_${env}_${this.project.envs[env].length}`) {
        this.handleSSL(db)
        if (db.client === 'sqlite3') {
          db.ui.setup = 1
        } else {
          const c1 = {
            connection: { ...db.connection, database: this.testDatabaseNames[db.client] },
            client: db.client
          }

          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            query: {
              skipProjectHasDb: 1
            }
          }, 'testConnection', c1])

          if (result.code === 0) {
            db.ui.setup = 1
            let passed = true
            /**
             * get other environments
             * and if host is localhost - test and update connection status
             * UI panel close
             */

            for (const e in this.project.envs) {
              if (e === env) {

              } else {
                const c2 = {
                  connection: { ...this.project.envs[e].db[0].connection, database: undefined },
                  client: this.project.envs[e].db[0].client
                }

                this.handleSSL(c2)

                const result = await this.sqlMgr.testConnection(c2)

                if (result.code === 0) {
                  this.project.envs[e][0].ui.setup = 1
                } else {
                  this.project.envs[e][0].ui.setup = -1
                  passed = false
                  break
                }
              }
            }

            if (passed) {
              this.panel = null
            } else {
              this.dialog.heading = 'Connection was successful'
              this.dialog.type = 'success'
              this.dialog.show = true
            }
          } else {
            db.ui.setup = -1
            this.dialog.heading = 'Connection Failure: \n\n' + result.message
            this.dialog.type = 'error'
            this.dialog.show = true
          }
        }

        return true
      } else {
        return false
      }
    },

    sendAdvancedConfig (connection) {
      if (!connection.ssl) { return false }
      let sendAdvancedConfig = false
      const sslOptions = Object.values(connection.ssl).filter(el => !!el)
      if (sslOptions[0]) {
        sendAdvancedConfig = true
      } else {
      }
      return sendAdvancedConfig
    },

    handleSSL (db, creating = true) {
      const sendAdvancedConfig = this.sendAdvancedConfig(db.connection)
      if (!sendAdvancedConfig) {
        // args.ssl = undefined;
        db.connection.ssl = undefined
      }

      if (db.connection.ssl) {
        // db.connection.ssl.caFilePath = db.connection.ssl.ca;
        // db.connection.ssl.keyFilePath = db.connection.ssl.key;
        // db.connection.ssl.certFilePath = db.connection.ssl.cert;
        // if(creating) {
        //   delete db.connection.ssl.ca;
        //   delete db.connection.ssl.key;
        //   delete db.connection.ssl.cert;
        // }
      }
    },
    getDatabaseForTestConnection (dbType) {

    },
    async testConnection (db, env, panelIndex) {
      this.$store.commit('notification/MutToggleProgressBar', true)
      try {
        if (!await this.newTestConnection(db, env, panelIndex)) {
          // this.activeDbNode.testConnectionStatus = false;
          //

          this.handleSSL(db)

          if (db.client === 'sqlite3') {
            db.ui.setup = 1
          } else {
            const c1 = {
              connection: { ...db.connection, database: this.testDatabaseNames[db.client] },
              client: db.client
            }

            // const result = await this.sqlMgr.testConnection(c1);
            const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              query: {
                skipProjectHasDb: 1
              }
            }, 'testConnection', c1])


            if (result.code === 0) {
              db.ui.setup = 1
              this.dialog.heading = 'Connection was successful'
              this.dialog.type = 'success'
              this.dialog.show = true
            } else {
              db.ui.setup = -1
              // this.activeDbNode.testConnectionStatus = false;
              this.dialog.heading = 'Connection Failure: \n\n' + result.message
              this.dialog.type = 'error'
              this.dialog.show = true
            }

          }
        }
      } catch (e) {
        console.log(e)
      } finally {
        this.$store.commit('notification/MutToggleProgressBar', false)
      }
    },
    getEnvironmentStatusAggregated (dbs) {
      return dbs.every(db => db.ui.setup === 1)
    },

    getEnvironmentStatusAggregatedNew (dbs) {
      return dbs.db.every(db => db.ui.setup === 1)
    },
    openFirstPanel () {
      if (!this.edit) { this.panel = 0 }
    },
    onDatabaseTypeChanged (client, db1, index, env) {
      for (const env in this.project.envs) {
        if (this.project.envs[env].db.length > index) {
          const db = this.project.envs[env].db[index]
          Vue.set(db, 'client', this.databaseNames[client])
          if (client !== 'Sqlite') {
            const { ssl, ...connectionDet } = this.sampleConnectionData[client]

            Vue.set(db, 'connection', {
              ...connectionDet,
              database: `${this.project.title}_${env}_${index + 1}`,
              ssl: { ...ssl }
            })

            for (const env in this.project.envs) {
              if (this.project.envs[env].length > index) {
                this.setDBStatus(this.project.envs[env][index], 0)
              }
            }
          } else {
            db.connection = {}
            Vue.set(db, 'connection', {
              client: 'sqlite3',
              // connection: {filename: path.join(this.project.folder, `${this.project.title}_${env}_${index + 1}`)},
              connection: { filename: [this.project.folder, `${this.project.title}_${env}_${index + 1}`].join('/') },
              database: [this.project.folder, `${this.project.title}_${env}_${index + 1}`].join('/'),
              // database: path.join(this.project.folder, `${this.project.title}_${env}_${index + 1}`),
              useNullAsDefault: true
            })
            // Vue.set(db.connection, 'connection', {filename: `${this.project.folder}/${this.project.title}_${env}_${index + 1}`})
            // Vue.set(db.connection, 'database', `${this.project.folder}/${this.project.title}_${env}_${index + 1}`)
          }
        }
      }
    },
    selectDatabaseClient (database, index = 0) {
      if (this.client) { this.client[index] = database }
    },
    setDBStatus (db, status) {
      db.ui.setup = status
    },
    removeDBFromEnv (db, env, panelIndex, dbIndex) {
      for (const env in this.project.envs) {
        if (this.project.envs[env].db.length > dbIndex) {
          this.project.envs[env].db.splice(dbIndex, 1)
        }
      }
    },
    removeEnv (envKey) {
      delete this.project.envs[envKey]
      Vue.set(this.project, 'envs', { ...this.project.envs })
    }

  },
  fetch ({ store, params }) {
  },
  beforeCreated () {
  },
  watch: {
    'project.title' (newValue, oldValue) {
      if (!newValue) { return }
      if (!this.edit) {
        // Vue.set(this.project, 'folder', slash(path.join(this.baseFolder, newValue)))
        Vue.set(this.project, 'folder', [this.baseFolder, newValue].join('/'))
        // }//this.project.folder = `${this.baseFolder}/${newValue}`;

        for (const env in this.project.envs) {
          for (const [index, db] of this.project.envs[env].db.entries()) {
            // db.connection.database = `${this.project.title}_${env}_${index}`
            if (db.client !== 'sqlite3') {
              Vue.set(db.connection, 'database', `${this.project.title}_${env}_${index + 1}`)
            } else {
              Vue.set(db.connection, 'connection', { filename: path.join(this.project.folder, `${this.project.title}_${env}_${index + 1}`) })
              Vue.set(db.connection, 'database', `${this.project.title}_${env}_${index + 1}`)
            }
          }
        }
      }
    },
    'project.envs': {
      deep: true,
      handler (envs) {
        Object.entries(envs).forEach(([key, env]) => {
          let res = 1; const msg = {}
          for (const db of env.db) {
            res = db.ui.setup < res ? db.ui.setup : res
          }
          if (this.edit) {
            Vue.set(this.project.ui, key, '')
          } else {
            switch (res) {
              case -1:
                msg.color = 'red'
                msg.msg = ' ( Invalid database parameters )'
                break
              case 0:
                msg.color = 'warning'
                msg.msg = ' ( Click to validate database credentials )'
                break
              case 1:
                msg.color = 'green'
                msg.msg = ' ( Environment Validated )'
                break
            }
            Vue.set(this.project.ui, key, msg)
          }
        })
      }
    }
  },
  async created () {
    this.compErrorMessage = this.compErrorMessages[Math.floor(Math.random() * this.compErrorMessages.length)]

    if (this.$route.query && this.$route.query.edit) {
      this.edit = true
      // await this.$store.dispatch('sqlMgr/instantiateSqlMgr');
      let data = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ id: this.$route.query.projectId }, 'PROJECT_READ_BY_WEB'])
      data = data.data.list[0]
      this.constructProjectJsonFromProject(data)
      this.$set(this.project, 'folder', data.folder)
    } else {
      this.project = JSON.parse(JSON.stringify(this.defaultProject))
      this.edit = false

      /**
       *  Figure out which databases users has by scanning port numbers
       *      preference can be - pg | mysql | mssql | oracledb | sqlite
       *      create this.project based on the database
       *
       *
       */
      let dbsAvailable = []// await PortScanner.getOpenDbPortsAsList();
      // // setting MySQL as default value if no databases are available
      // if (!dbsAvailable || !dbsAvailable.length) {
      dbsAvailable = ['MySQL']
      // }

      this.selectDatabaseClient(dbsAvailable[0], 0)

      // iterating over environment and setting default connection details based
      // on first available database
      for (const env in this.project.envs) {
        for (const db of this.project.envs[env].db) {
          db.client = this.databaseNames[dbsAvailable[0]]

          if (db.client === 'sqlite3') {
            db.connection = {
              ...this.sampleConnectionData[dbsAvailable[0]]
            }

            db.ui.setup = 0
          } else {
            db.connection = {
              ...this.sampleConnectionData[dbsAvailable[0]],
              ssl: { ...this.sampleConnectionData[dbsAvailable[0]].ssl }
            }
            // db.ui.setup = await PortScanner.isAlive(db.connection.host, parseInt(db.connection.port)) ? 0 : -1;
          }
        }
      }

      // for (let env in this.project.envs) {
      //   for (let db of this.project.envs[env]) {
      //     db.ui.setup = await PortScanner.isAlive(db.connection.host, parseInt(db.connection.port)) ? 0 : -1;
      //     console.log('testing port', env, db.connection.database, db.ui.setup);
      //   }
      // }
    }
  },
  beforeMount () {
  },
  mounted () {
    this.$set(this.project, 'title', uniqueNamesGenerator({
      dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)]
    }).toLowerCase().replace(/[ -]/g, '_'))
  },
  beforeDestroy () {
  },
  destroy () {
  },
  validate ({ params }) {
    return true
  },
  head () {
    return {
      title: 'Create Project | XC'
    }
  },
  props: {},
  directives: {}
}
</script>

<style scoped>
.floating-button {
  position: fixed;
  right: 7%;
  bottom: 100px
}

/deep/ .v-expansion-panel-header {
  padding: 0 6px;
  min-height: 50px !important;
}

</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
