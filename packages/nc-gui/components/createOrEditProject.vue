<template>
  <v-container fluid>
    <v-col
      :class="{ 'col-md-8 offset-md-2 col-sm-10 offset-sm-1 col-12': !edit }"
      style="position: relative"
    >
      <v-form ref="form" v-model="valid" :class="{ 'mt-8 pt-8': !edit }">
        <v-card ref="mainCard" class="elevation-5">
          <div
            v-if="!edit"
            style="
              position: absolute;
              top: -30px;
              left: -moz-calc(50% - 30px);
              left: -webkit-calc(50% - 30px);
              left: calc(50% - 30px);
              z-index: 999;
              border-radius: 10px;
            "
            class="primary"
          >
            <v-img
              class="mx-auto"
              width="60"
              height="60"
              :src="require('@/assets/img/icons/512x512-trans.png')"
              @dblclick="enableAllSchemas()"
            />
          </div>
          <v-toolbar
            flat
            color=""
            class="mb-3"
            style="width: 100%; border-bottom: 1px solid var(--v-backgroundColor-base)"
          >
            <v-toolbar-title class="title">
              <!-- Edit Project -->
              <span v-if="edit">{{ $t('projects.ext_db.title.edit') }}</span>
              <!-- Create Project -->
              <span v-else>{{ $t('projects.ext_db.title.create') }}</span>
            </v-toolbar-title>
            <v-spacer />
            <!-- Cancel and Return -->
            <x-btn
              v-ge="['project', 'cancel']"
              :tooltip="$t('projects.ext_db.button.cancel_tooltip')"
              to="/"
              class="elevation-20"
            >
              <!-- Cancel -->
              {{ $t('projects.ext_db.button.cancel') }}
            </x-btn>
            <x-btn
              v-ge="['project', 'save']"
              :disabled="!valid || !envStatusValid"
              class="primary"
              @click="createOrUpdateProject()"
            >
              <!-- Update & Restart -->
              <span v-if="edit">{{ $t('projects.ext_db.button.update_and_restart') }}</span>
              <!-- Save Project -->
              <span v-else>{{ $t('projects.ext_db.button.save_project') }}</span>
            </x-btn>
            <v-progress-linear
              v-if="projectReloading"
              top
              absolute
              color="success"
              indeterminate
              height="3"
              style="top: -3px"
            />
          </v-toolbar>

          <div ref="panelContainer" style="">
            <api-overlay v-show="projectReloading" :project-created="projectCreated" />
            <!--            <v-overlay absolute color="grey" opacity="0.4"-->
            <!--                       class="create-project-overlay">-->

            <!--<div>
              <v-card dark style="width: 100%; max-height:100%;overflow: auto">
                <v-container fluid style="min-height:200px;">
                  &lt;!&ndash;                    <v-row class="text-center">&ndash;&gt;
                  &lt;!&ndash;                      <v-col cols="12">&ndash;&gt;
                  <v-card class="pa-2 text-center elevation-10" dark>
                    <h3 class="title mb-3 mt-4">APIs Generated</h3>
                    <p><span class="display-2 font-weight-bold">1,200,000</span><br>
                      <span class="subtitle grey&#45;&#45;text text&#45;&#45;lighten-1">within 60 seconds</span></p>
                  </v-card>
                  &lt;!&ndash;                      </v-col>&ndash;&gt;
                  &lt;!&ndash;                    </v-row>&ndash;&gt;
                  <v-row>
                    <v-col>
                      <v-card dark class=" elevation-10">
                        <v-card-text class="pb-0 font-weight-bold"># Databases</v-card-text>
                        <v-card-text class="title white&#45;&#45;text">
                          <v-icon class="mt-n2 mr-1" color="info">mdi-database-sync</v-icon>

                          180/190
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col>
                      <v-card dark class=" elevation-10">
                        <v-card-text class="pb-0 font-weight-bold"># Tables</v-card-text>
                        <v-card-text class="title white&#45;&#45;text">
                          <v-icon class="mr-1 mt-n1 " color="info">mdi-table-large</v-icon>
                          50000
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col>
                      <v-card dark class=" elevation-10">
                        <v-card-text class="pb-0 font-weight-bold">Time Saved</v-card-text>
                        <v-card-text class="title white&#45;&#45;text">
                          <v-icon class="mr-1 mt-n1" color="secondary">mdi-clock-fast</v-icon>
                          10hrs
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col>
                      <v-card dark class=" elevation-10">
                        <v-card-text class="pb-0 font-weight-bold">CostSaved</v-card-text>
                        <v-card-text class="title white&#45;&#45;text">
                          <v-icon color="success" class="mt-n2 mr-1">mdi-currency-usd-circle</v-icon>
                          100$
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>
                  &lt;!&ndash;                    <v-divider class="my-3 "></v-divider>&ndash;&gt;
                  <v-card dark class=" elevation-10">
                    <p class="title text-center pt-2">List of Database</p>
                    <v-simple-table style="width: 100%">
                      <tr v-for="i in 40">
                        <td v-for="j in 5" class="py-2 px-3">
                          <div class="d-flex">
                            <v-icon color="green" x-small class="mr-2">mdi-moon-full</v-icon>
                            <span class="caption">Database {{ i }} {{ j }}</span>
                            <v-spacer></v-spacer>

                          </div>
                        </td>
                      </tr>
                    </v-simple-table>
                  </v-card>
                </v-container>
              </v-card>
            </div>-->
            <!--            </v-overlay>-->

            <v-container fluid>
              <v-row>
                <v-col cols="12" class="mb-0 pb-0">
                  <div style="max-width: 360px" class="mx-auto mb-3">
                    <!-- Enter Project Name -->
                    <v-text-field
                      ref="name"
                      v-model="project.title"
                      v-ge="['project', 'name']"
                      :rules="form.titleRequiredRule"
                      :height="20"
                      :label="$t('projects.ext_db.project_name')"
                      autofocus
                    >
                      <!--                      <v-icon color="info" class="blink_me mt-n1" slot="prepend">-->
                      <!--                        mdi-lightbulb-on-->
                      <!--                      </v-icon>-->
                    </v-text-field>

                    <!-- Access Project via -->
                    <label class="caption"> {{ $t('projects.ext_db.project_name') }}</label>
                    <v-radio-group
                      v-model="project.projectType"
                      row
                      hide-details
                      dense
                      class="mb-0 mt-0"
                    >
                      <v-radio
                        v-for="(type, i) in projectTypes"
                        :key="type.value"
                        :color="type.iconColor"
                        :value="type.value"
                      >
                        <template #label>
                          <v-chip :color="i ? colors[3] : colors[7]">
                            <v-icon small class="mr-1">
                              {{ type.icon }}
                            </v-icon>
                            <span class="caption">{{ type.text }}</span>
                          </v-chip>
                        </template>
                      </v-radio>
                    </v-radio-group>
                  </div>

                  <!--            <v-select
                                v-model="project.projectType" hint="Access via API type" persistent-hint dense
                                :items="projectTypes">
                                <template v-slot:prepend>
                                  <img v-if="typeIcon.type === 'img'" :src="typeIcon.icon" style="width: 32px">
                                  <v-icon v-else :color="typeIcon.iconColor">{{ typeIcon.icon }}</v-icon>
                                </template>
                                <template v-slot:item="{item}">
                                  <span class="caption d-flex align-center">
                                  <img v-if="item.type === 'img'" :src="item.icon" style="width: 30px">
                                    <v-icon v-else :color="item.iconColor">{{ item.icon }}</v-icon> &nbsp; {{ item.text }}</span>
                                </template>

                              </v-select>-->
                </v-col>

                <v-col
                  v-show="isTitle"
                  cols="10"
                  offset="1"
                  :class="{ 'mt-0 pt-0': !edit, 'mt-3 pt-3': edit }"
                >
                  <!--            <h2 :class="{'text-center mb-2':!edit,'text-center mb-2 grey&#45;&#45;text':edit}">
                                {{ project.title && project.title.toUpperCase() }}'s
                                Environments</h2> -->

                  <p
                    :class="{
                      'text-center mb-2 mt-3': !edit,
                      'text-center mb-2 mt-3 grey--text': edit,
                    }"
                  >
                    {{ $t('projects.ext_db.credentials') }}
                  </p>
                  <v-expansion-panels
                    v-model="panel"
                    focusable
                    accordion=""
                    class="elevation-20"
                    style="border: 1px solid white"
                  >
                    <v-expansion-panel
                      v-for="(envData, envKey, panelIndex) in project.envs"
                      :key="panelIndex"
                      :ref="`panel${envKey}`"
                      @change="onPanelToggle(panelIndex, envKey)"
                    >
                      <v-expansion-panel-header disable-icon-rotate>
                        <p class="pa-0 ma-0">
                          <!--                          <v-icon>mdi-test-tube</v-icon> &nbsp;-->
                          <!--                          <span class="title">&nbsp;<b>'{{ envKey }}'</b> environment : </span>-->
                          <v-tooltip v-for="(db, tabIndex) in envData.db" :key="tabIndex" bottom>
                            <template #activator="{ on }">
                              <v-icon
                                small
                                :color="getDbStatusColor(db)"
                                @click.native.stop="showDBTabInEnvPanel(panelIndex, tabIndex)"
                                v-on="on"
                              >
                                mdi-database
                              </v-icon>
                            </template>
                            {{ getDbStatusTooltip(db) }}
                          </v-tooltip>

                          <span
                            v-if="project.ui[envKey]"
                            class="caption"
                            :class="project.ui[envKey].color + '--text'"
                          >
                            <i>{{ project.ui[envKey].msg }}</i>
                          </span>

                          <x-btn
                            v-if="panelIndex"
                            v-ge="['project', 'env-delete']"
                            small
                            text
                            btn.class="float-right"
                            tooltip="Click here to remove environment"
                            @click.native.stop="removeEnv(envKey)"
                          >
                            <v-hover v-slot="{ hover }">
                              <v-icon
                                :color="hover ? 'error' : 'grey'"
                                @click.native.stop="removeEnv(envKey)"
                              >
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
                            <v-tabs v-model="databases[panelIndex]" height="34" background-color="">
                              <v-tab
                                v-for="(db, dbIndex) in project.envs[envKey].db"
                                :key="dbIndex"
                              >
                                <v-icon small>
                                  mdi-database
                                </v-icon> &nbsp;
                                <span class="text-capitalize caption">{{
                                  db.connection.database
                                }}</span>
                              </v-tab>
                              <!--                  <v-tooltip bottom>
                                                  <template v-slot:activator="{ on }">
                                                    <x-btn tooltip="Add New Database to Environment" text small class="ma-2" v-on="on"
                                                           @click.prevent.stop="addNewDB(envKey,panelIndex)"
                                                           v-ge="['project','env-db-add']"
                                                    >
                                                      <v-hover v-slot:default="{ hover }">
                                                        <v-icon :color="hover ? 'primary' : 'grey'">mdi-database-plus
                                                        </v-icon>
                                                      </v-hover>
                                                    </x-btn>
                                                  </template>
                                                  <span>Add new database to '{{ envKey }}' environment</span>
                                                </v-tooltip>
                  -->
                              <v-tabs-items v-model="databases[panelIndex]">
                                <v-tab-item
                                  v-for="(db, dbIndex) in project.envs[envKey].db"
                                  :key="dbIndex"
                                >
                                  <v-card flat>
                                    <!--                            <form ref="form" class="pa-3">-->
                                    <v-container class="justify-center">
                                      <v-row style="position: relative">
                                        <v-overlay
                                          v-if="showMonaco[dbIndex]"
                                          absolute
                                          class="monaco-overlay"
                                        >
                                          <v-container fluid class="h-100">
                                            <v-card style="position: relative" class="h-100">
                                              <v-icon
                                                class="monaco-overlay-close pointer"
                                                color="error"
                                                @click="$set(showMonaco, dbIndex, false)"
                                              >
                                                mdi-close-circle
                                              </v-icon>

                                              <span
                                                class="ml-2 caption grey--text"
                                              >Refer knex documentation
                                                <a
                                                  href="https://knexjs.org/#Installation-client"
                                                  target="_blank"
                                                  class="grey--text"
                                                >here</a>
                                                .</span>

                                              <monaco-json-object-editor
                                                v-model="project.envs[envKey].db[dbIndex]"
                                                style="height: calc(100% - 20px); width: 100%"
                                              />
                                            </v-card>
                                          </v-container>
                                        </v-overlay>

                                        <v-col cols="4" class="py-0">
                                          <!-- Database Type -->
                                          <v-select
                                            v-model="client[dbIndex]"
                                            v-ge="['project', 'env-db-change']"
                                            class="body-2 db-select"
                                            :items="Object.keys(databaseNames)"
                                            :label="$t('projects.ext_db.credentials.db_type')"
                                            @change="
                                              onDatabaseTypeChanged(
                                                client[dbIndex],
                                                db,
                                                dbIndex,
                                                envKey
                                              )
                                            "
                                          >
                                            <template #selection="{ item }">
                                              <v-chip
                                                small
                                                :color="
                                                  colors[
                                                    Object.keys(databaseNames).indexOf(item) %
                                                    colors.length
                                                  ]
                                                "
                                                class=""
                                              >
                                                {{ item }}
                                              </v-chip>
                                            </template>

                                            <template slot="item" slot-scope="data">
                                              <v-chip
                                                :color="
                                                  colors[
                                                    Object.keys(databaseNames).indexOf(data.item) %
                                                    colors.length
                                                  ]
                                                "
                                                class="caption"
                                              >
                                                {{ data.item }}
                                              </v-chip>
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
                                        <!-- SQLite File -->
                                        <v-col v-if="db.client === 'sqlite3'" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.connection.filename"
                                            v-ge="['project', 'env-db-file']"
                                            :rules="form.folderRequiredRule"
                                            :label="$t('projects.ext_db.credentials.sqlite_file')"
                                            @click="selectSqliteFile(db)"
                                          >
                                            <v-icon slot="prepend" color="info">
                                              mdi-file-outline
                                            </v-icon>
                                          </v-text-field>
                                        </v-col>
                                        <!-- Host Address -->
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.host"
                                            v-ge="['project', 'env-db-host']"
                                            class="body-2"
                                            :rules="form.requiredRule"
                                            :label="$t('projects.ext_db.credentials.host_address')"
                                          />
                                        </v-col>
                                        <!-- Port Number -->
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.port"
                                            v-ge="['project', 'env-db-port']"
                                            class="body-2"
                                            :label="$t('projects.ext_db.credentials.port')"
                                            :rules="form.portValidationRule"
                                          />
                                        </v-col>
                                        <!-- Username -->
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.user"
                                            v-ge="['project', 'env-db-user']"
                                            class="body-2"
                                            :rules="form.requiredRule"
                                            :label="$t('projects.ext_db.credentials.username')"
                                          />
                                        </v-col>
                                        <!-- Password -->
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            :ref="`password${envKey}`"
                                            v-model="db.connection.password"
                                            v-ge="['project', 'env-db-password']"
                                            class="body-2 db-password"
                                            :type="
                                              showPass[`${panelIndex}_${dbIndex}`]
                                                ? 'text'
                                                : 'password'
                                            "
                                            :label="$t('projects.ext_db.credentials.password')"
                                          >
                                            <template #append>
                                              <v-icon
                                                small
                                                @click="
                                                  $set(
                                                    showPass,
                                                    `${panelIndex}_${dbIndex}`,
                                                    !showPass[`${panelIndex}_${dbIndex}`]
                                                  )
                                                "
                                              >
                                                {{
                                                  showPass[`${panelIndex}_${dbIndex}`]
                                                    ? 'visibility_off'
                                                    : 'visibility'
                                                }}
                                              </v-icon>
                                            </template>
                                          </v-text-field>
                                        </v-col>
                                        <!-- Database : create if not exists -->
                                        <v-col v-if="db.client !== 'sqlite3'" cols="4" class="py-0">
                                          <v-text-field
                                            v-model="db.connection.database"
                                            v-ge="['project', 'env-db-name']"
                                            class="body-2 database-field"
                                            :rules="form.requiredRule"
                                            :label="$t('projects.ext_db.credentials.db_create_if_not_exists')"
                                          />
                                        </v-col>
                                        <v-col v-if="db.client !== 'sqlite3'" class="">
                                          <v-expansion-panels>
                                            <v-expansion-panel style="border: 1px solid wheat">
                                              <v-expansion-panel-header>
                                                <!-- SSL & Advanced parameters -->
                                                <span class="grey--text caption">{{
                                                  $t('projects.ext_db.credentials.advanced')
                                                }}</span>
                                              </v-expansion-panel-header>
                                              <v-expansion-panel-content>
                                                <v-card class="elevation-0">
                                                  <v-card-text>
                                                    <v-select
                                                      v-model="db.ui.sslUse"
                                                      class="caption"
                                                      :items="Object.keys(sslUsage)"
                                                    >
                                                      <template #item="{ item }">
                                                        <span class="caption">{{ item }}</span>
                                                      </template>
                                                    </v-select>

                                                    <v-row class="pa-0 ma-0">
                                                      <input
                                                        ref="certFilePath"
                                                        type="file"
                                                        class="d-none"
                                                        @change="
                                                          readFileContent(
                                                            db,
                                                            'ssl',
                                                            'cert',
                                                            dbIndex
                                                          )
                                                        "
                                                      >
                                                      <!-- Select .cert file -->
                                                      <x-btn
                                                        v-ge="['project', 'env-db-cert']"
                                                        :tooltip="
                                                          $t(
                                                            'projects.ext_db.credentials.advanced.ssl.client_cert.toolip'
                                                          )
                                                        "
                                                        small
                                                        color="primary"
                                                        outlined
                                                        class="elevation-5"
                                                        @click="
                                                          selectFile(
                                                            db,
                                                            'ssl',
                                                            'certFilePath',
                                                            dbIndex
                                                          )
                                                        "
                                                      >
                                                        {{ db.ui.ssl.cert }}
                                                      </x-btn>
                                                      <!-- Select .key file -->
                                                      <input
                                                        ref="keyFilePath"
                                                        type="file"
                                                        class="d-none"
                                                        @change="
                                                          readFileContent(db, 'ssl', 'key', dbIndex)
                                                        "
                                                      >
                                                      <x-btn
                                                        v-ge="['project', 'env-db-key']"
                                                        :tooltip="
                                                          $t(
                                                            'projects.ext_db.credentials.advanced.ssl.client_key.toolip'
                                                          )
                                                        "
                                                        small
                                                        color="primary"
                                                        outlined
                                                        class="elevation-5"
                                                        @click="
                                                          selectFile(
                                                            db,
                                                            'ssl',
                                                            'keyFilePath',
                                                            dbIndex
                                                          )
                                                        "
                                                      >
                                                        {{ db.ui.ssl.key }}
                                                      </x-btn>
                                                      <!-- Select CA file -->
                                                      <input
                                                        ref="caFilePath"
                                                        type="file"
                                                        class="d-none"
                                                        @change="
                                                          readFileContent(db, 'ssl', 'ca', dbIndex)
                                                        "
                                                      >
                                                      <x-btn
                                                        v-ge="['project', 'env-db-ca']"
                                                        :tooltip="
                                                          $t(
                                                            'projects.ext_db.credentials.advanced.ssl.server_ca.toolip'
                                                          )
                                                        "
                                                        small
                                                        color="primary"
                                                        outlined
                                                        @click="
                                                          selectFile(
                                                            db,
                                                            'ssl',
                                                            'caFilePath',
                                                            dbIndex
                                                          )
                                                        "
                                                      >
                                                        {{ db.ui.ssl.ca }}
                                                      </x-btn>
                                                    </v-row>

                                                    <v-row>
                                                      <v-col>
                                                        <!-- Inflection - Table name -->
                                                        <v-select
                                                          v-model="db.meta.inflection.tn"
                                                          class="caption"
                                                          :label="
                                                            $t(
                                                              'projects.ext_db.credentials.advanced.inflection.table_name'
                                                            )
                                                          "
                                                          multiple
                                                          :items="['camelize']"
                                                        >
                                                          <template #item="{ item }">
                                                            <span class="caption">{{ item }}</span>
                                                          </template>
                                                        </v-select>
                                                      </v-col>
                                                      <v-col>
                                                        <!-- Inflection - Column name -->
                                                        <v-select
                                                          v-model="db.meta.inflection.cn"
                                                          class="caption"
                                                          :label="
                                                            $t(
                                                              'projects.ext_db.credentials.advanced.inflection.column_name'
                                                            )
                                                          "
                                                          multiple
                                                          :items="['camelize']"
                                                        >
                                                          <template #item="{ item }">
                                                            <span class="caption">{{ item }}</span>
                                                          </template>
                                                        </v-select>
                                                      </v-col>
                                                      <v-col
                                                        class="
                                                          d-flex
                                                          align-center
                                                          flex-shrink-1 flex-grow-0
                                                        "
                                                      >
                                                        <x-btn
                                                          small
                                                          btn.class="text-capitalize"
                                                          :tooltip="
                                                            $t(
                                                              'projects.ext_db.credentials.advanced.button.edit_conn_json'
                                                            )
                                                          "
                                                          outlined
                                                          @click="
                                                            $set(
                                                              showMonaco,
                                                              dbIndex,
                                                              !showMonaco[dbIndex]
                                                            )
                                                          "
                                                        >
                                                          <v-icon
                                                            small
                                                            class="mr-1"
                                                          >
                                                            mdi-database-edit
                                                          </v-icon>
                                                          <!-- Edit connection JSON -->
                                                          {{
                                                            $t(
                                                              'projects.ext_db.credentials.advanced.button.edit_conn_json'
                                                            )
                                                          }}
                                                        </x-btn>
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
                                        <!-- Test Database Connection -->
                                        <x-btn
                                          v-ge="['project', 'env-db-test-connection']"
                                          :tooltip="
                                            $t('projects.ext_db.credentials.button.test_db_conn')
                                          "
                                          outlined
                                          small
                                          @click="testConnection(db, envKey, panelIndex)"
                                        >
                                          <!-- Test Database Connection -->
                                          {{ $t('projects.ext_db.credentials.button.test_db_conn') }}
                                        </x-btn>
                                        <!-- Remove Database from environment -->
                                        <x-btn
                                          v-if="dbIndex"
                                          v-ge="['project', 'env-db-delete']"
                                          :tooltip="
                                            $t(
                                              'projects.ext_db.credentials.button.remove_db_from_env'
                                            )
                                          "
                                          text
                                          small
                                          @click="removeDBFromEnv(db, envKey, panelIndex, dbIndex)"
                                        >
                                          <v-hover v-slot="{ hover }">
                                            <v-icon
                                              :color="hover ? 'error' : 'grey'"
                                            >
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

                    <!--  <v-expansion-panel>
                        <v-expansion-panel-header disable-icon-rotate>
                          <v-tooltip bottom>
                            <template v-slot:activator="{ on }">
                              <x-btn tooltip="Add New Environment to Project" color="grey" block v-on="on" outlined
                                     v-ge="['project','env-add']"
                                     @click.stop="addNewEnvironment">
                                <v-icon>mdi-plus</v-icon>
                                Add Another Environment
                              </x-btn>
                            </template>
                            <span>Add new environment to {{ project.title }} project</span>
                          </v-tooltip>
                          <template v-slot:actions>
                            <i></i>
                          </template>
                        </v-expansion-panel-header>
                      </v-expansion-panel>-->
                  </v-expansion-panels>
                </v-col>

                <!--                <v-col cols="10" offset="1" v-show="isTitle"
                                       :class="{'mt-0 pt-0':!edit,'mt-3 pt-3':edit}">
                                  &lt;!&ndash;                  <h2 :class="{'text-center mb-2':!edit,'text-center mb-2 grey&#45;&#45;text':edit}">&ndash;&gt;
                                  &lt;!&ndash;                    Advanced Configuration</h2>&ndash;&gt;
                                  <v-expansion-panels focusable accordion="" class="elevation-20"
                                                      style="border: 1px solid grey">
                                    <v-expansion-panel
                                      @change="onAdvancePanelToggle"
                                    >
                                      <v-expansion-panel-header disable-icon-rotate>

                                        <p class="pa-0 ma-0">
                                          <v-icon class="mt-n2 " color="grey darken-1">mdi-cog</v-icon> &nbsp;
                                          <span class="grey&#45;&#45;text text&#45;&#45;darken-1">Advance Configuration</span>
                                        </p>

                                      </v-expansion-panel-header>
                                      <v-expansion-panel-content eager>
                                        <v-card class="mt-3">
                                          <v-card-title>
                                            <v-icon class="mr-2">mdi-shield-account-outline</v-icon>
                                            Authentication Configuration
                                          </v-card-title>

                                          <v-card-text>
                                            <v-container class="justify-center">
                                              <v-row>
                                                <v-col cols="12" class="py-0">
                                                  <v-select
                                                    v-model="auth.authType" hint="Choose Authentication type"
                                                    persistent-hint dense
                                                    :items="authTypes">

                                                    <template v-slot:item="{item}">
                                                  <span class="caption">
                                                    {{ item.text }}</span>
                                                    </template>

                                                  </v-select>

                                                </v-col>
                                                <v-col cols="12" class="py-0" v-if="auth.authType && auth.authType !== 'none'">
                                                  <v-text-field

                                                    v-if="auth.authType !== 'middleware'"
                                                    v-model="auth.authSecret"
                                                    label="Enter Auth Secret (Randomly generated)"
                                                    :type="showSecret ?   'text' : 'password'"
                                                  >
                                                    <template v-slot:append>
                                                      <v-icon small
                                                              @click="showSecret = !showSecret"
                                                      >{{
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

                                                  >
                                                  </v-text-field>

                                                </v-col>

                                              </v-row>
                                            </v-container>
                                          </v-card-text>
                                        </v-card>
                                        &lt;!&ndash;                      </v-expansion-panel-content>&ndash;&gt;
                                        &lt;!&ndash;                    </v-expansion-panel>&ndash;&gt;
                                        &lt;!&ndash;                  </v-expansion-panels>&ndash;&gt;
                                        &lt;!&ndash;                </v-col>&ndash;&gt;
                                        &lt;!&ndash;                <v-col cols="10" offset="1" v-show="project.title.trim().length"&ndash;&gt;
                                        &lt;!&ndash;                       :class="{'mt-0 pt-0':!edit,'mt-3 pt-3':edit}">&ndash;&gt;

                                        &lt;!&ndash;                  <v-expansion-panels v-model="smtpPanel" focusable accordion="" class="elevation-20"&ndash;&gt;
                                        &lt;!&ndash;                                      style="border: 1px solid grey">&ndash;&gt;

                                        &lt;!&ndash;                    <v-expansion-panel>&ndash;&gt;
                                        &lt;!&ndash;                      <v-expansion-panel-header disable-icon-rotate>&ndash;&gt;

                                        &lt;!&ndash;                        <p class="pa-0 ma-0">&ndash;&gt;
                                        &lt;!&ndash;                          <v-icon class="mt-n2 " color="grey darken-1">mdi-email-edit</v-icon> &nbsp;&ndash;&gt;
                                        &lt;!&ndash;                          <span class="grey&#45;&#45;text text&#45;&#45;darken-1">SMTP Configuration</span>&ndash;&gt;
                                        &lt;!&ndash;                        </p>&ndash;&gt;

                                        &lt;!&ndash;                      </v-expansion-panel-header>&ndash;&gt;
                                        &lt;!&ndash;                      <v-expansion-panel-content :eager="false">&ndash;&gt;

                                        <v-card class="mt-3">
                                          <v-card-title>
                                            <v-icon class="mr-2">mdi-email-edit</v-icon>
                                            SMTP Configuration
                                          </v-card-title>
                                          <v-card-text>

                                            <v-text-field
                                              v-model="smtpConfiguration.from"
                                              label="From address"
                                              placeholder="Company<noreply@company.com>"

                                            >
                                            </v-text-field>

                                            <label>Mailer Config Options<span class="caption"> (For connection example visit:  <a
                                              href="https://nodemailer.com/smtp/#examples">https://nodemailer.com/smtp/#examples</a>)</span></label>
                                            <monaco-json-editor
                                              ref="monacoEditor"
                                              v-model="smtpConfiguration.options"
                                              style="height: 300px; width:100% "></monaco-json-editor>
                                          </v-card-text>
                                        </v-card>
                                      </v-expansion-panel-content>
                                    </v-expansion-panel>

                                  </v-expansion-panels>

                                </v-col>

                                <v-col cols="10" offset="1" v-show="isTitle"
                                       :class="{'mt-0 pt-0':!edit,'mt-3 pt-3':edit}">

                                  <create-project-coming-soon></create-project-coming-soon>
                                </v-col>-->
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

    <dlg-ok-new
      v-model="testSuccess"
      heading="Connection was successful"
      ok-label="Ok & Save Project"
      type="success"
      :btn-attr="{ small: false }"
      @ok="createOrUpdateProject"
    />

    <textDlgSubmitCancel
      v-if="dialogGetEnvName.dialogShow"
      :dialog-show="dialogGetEnvName.dialogShow"
      :heading="dialogGetEnvName.heading"
      :mtd-dialog-submit="mtdDialogGetEnvNameSubmit"
      :mtd-dialog-cancel="mtdDialogGetEnvNameCancel"
    />

    <div v-if="isTitle && !edit" class="floating-button">
      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            v-ge="['project', 'save']"
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
        <span> Save Project </span>
      </v-tooltip>
    </div>
  </v-container>
</template>
<script>
import JSON5 from 'json5'
import readFile from '@/helpers/fileReader'

import { mapGetters, mapActions } from 'vuex'
import Vue from 'vue'

import { v4 as uuidv4 } from 'uuid'

import MonacoJsonObjectEditor from '@/components/monaco/MonacoJsonObjectEditor'
import ApiOverlay from '@/components/apiOverlay'
import colors from '@/mixins/colors'
import DlgOkNew from '@/components/utils/dlgOkNew'
import XBtn from './global/xBtn'
import dlgOk from './utils/dlgOk.vue'
import textDlgSubmitCancel from './utils/dlgTextSubmitCancel'

const { uniqueNamesGenerator, starWars, adjectives, animals } = require('unique-names-generator')

const homeDir = ''

export default {

  components: {
    DlgOkNew,
    ApiOverlay,
    MonacoJsonObjectEditor,
    XBtn,
    dlgOk,
    textDlgSubmitCancel
  },
  mixins: [colors],
  layout: 'empty',
  data () {
    return {
      testSuccess: false,
      projectCreated: false,
      allSchemas: false,
      showMonaco: [],
      smtpConfiguration: {
        from: '',
        options: ''
      },
      showSecret: false,
      loaderMessages: [
        'Setting up new database configs',
        'Inferring database schema',
        'Generating APIs.',
        'Generating APIs..',
        'Generating APIs...',
        'Generating APIs....',
        'Please wait',
        'Please wait.',
        'Please wait..',
        'Please wait...',
        'Please wait..',
        'Please wait.',
        'Please wait',
        'Please wait.',
        'Please wait..',
        'Please wait...',
        'Please wait..',
        'Please wait.',
        'Please wait..',
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
        { text: 'REST APIs', value: 'rest', icon: 'mdi-code-json', iconColor: 'green' },
        { text: 'GRAPHQL APIs', value: 'graphql', icon: 'mdi-graphql', iconColor: 'pink' }
        // {
        //   text: 'Automatic gRPC APIs on database',
        //   value: 'grpc',
        //   icon: require('@/assets/img/grpc-icon-color.png'),
        //   type: 'img'
        // },
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
      panel: 0,
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
        version: '0.6',
        folder: homeDir,
        envs: {
          dev: {
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
                    tn: ['camelize'],
                    cn: ['camelize']
                  }
                },
                ui: {
                  setup: -1,
                  ssl: {
                    key: this.$t('projects.ext_db.credentials.advanced.ssl.client_key'), // Client Key
                    cert: this.$t('projects.ext_db.credentials.advanced.ssl.client_cert'), // Client Cert
                    ca: this.$t('projects.ext_db.credentials.advanced.ssl.server_ca') // Server CA
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
        workingEnv: 'dev',
        ui: {
          envs: {
            dev: {}
          }
        },
        meta: {
          version: '0.6',
          seedsFolder: 'seeds',
          queriesFolder: 'queries',
          apisFolder: 'apis',
          projectType: 'rest',
          type: 'mvc',
          language: 'ts'
        },
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
        TiDB: {
          host: 'localhost',
          port: '4000',
          user: 'root',
          password: '',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        Yugabyte: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: '',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        CitusDB: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: '',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        CockroachDB: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: '',
          database: '_test',
          ssl: {
            ca: '',
            key: '',
            cert: ''
          }
        },
        Greenplum: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: '',
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
      dialog: {
        show: false,
        title: '',
        heading: '',
        mtdOk: this.testConnectionMethodSubmit,
        type: 'primary'
      },
      // TODO: apply i18n for sslUsage
      // See projects.ext_db.credentials.advanced.ssl.usage.no - 5 in en.json
      sslUsage: {
        No: 'No',
        Preferred: 'Preferred',
        Required: 'pg',
        'Required-CA': 'Required-CA',
        'Required-IDENTITY': 'Required-IDENTITY'
      },
      sslUse: this.$t('projects.ext_db.credentials.advanced.ssl.preferred'), // Preferred
      ssl: {
        key: this.$t('projects.ext_db.credentials.advanced.ssl.client_key'), // Client Key
        cert: this.$t('projects.ext_db.credentials.advanced.ssl.client_cert'), // Client Cert
        ca: this.$t('projects.ext_db.credentials.advanced.ssl.server_ca') // Server CA
      },
      databaseNames: {
        MySQL: 'mysql2',
        Postgres: 'pg',
        // Oracle: "oracledb",
        MsSQL: 'mssql',
        Sqlite: 'sqlite3'
        // Vitess: "mysql2",
        // TiDB: "mysql2",
        // Yugabyte: "pg",
        // CitusDB: "pg",
        // CockroachDB: "pg",
        // Greenplum: "pg"
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
        this.$t('projects.ext_db.error.invalid_char_in_folder_path'), // Invalid character in folder path
        this.$t('projects.ext_db.error.invalid_db_credentials'), // Invalid database credentials
        this.$t('projects.ext_db.error.unable_to_connect_to_db'), // Unable to connect to database, please check your database is up
        this.$t('projects.ext_db.error.user_doesnt_ve_sufficient_permission') // User does not exist or have sufficient permission to create schema
      ],
      compErrorMessage: ''
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }),
    isTitle () {
      return this.project.title && this.project.title.trim().length
    },
    envStatusValid () {
      return (
        this.project.envs &&
        Object.values(this.project.envs).every(this.getEnvironmentStatusAggregatedNew)
      )
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
    async enableAllSchemas () {
      this.$toast.info('Enabled all schemas').goAway(3000)
      this.allSchemas = true
      await this.$axios({
        url: 'demo',
        baseURL: `${this.$axios.defaults.baseURL}/dashboard`
      })
    },

    ...mapActions({
      loadProjects: 'project/loadProjects'
    }),
    onAdvancePanelToggle () {
      if (this.$refs.monacoEditor) {
        setTimeout(() => this.$refs.monacoEditor.resizeLayout(), 400)
      }
    },
    getProjectEditTooltip () {
      // return `Opens ${path.join(this.project.folder, 'config.xc.json')} and edit - its really simple`;
    },
    openJsonInSystemEditor () {
      // shell.openItem(path.join(this.project.folder, 'config.xc.json'));
    },
    readFileContent (db, obj, key, index) {
      readFile(this.$refs[`${key}FilePath`][index], (data) => {
        Vue.set(db.connection[obj], key, data)
      })
    },
    selectFile (db, obj, key, index) {
      this.$refs[key][index].click()

      // console.log(obj, key);
      // const file = dialog.showOpenDialog({
      //   properties: ["openFile"]
      // });
      // console.log(typeof file, file, typeof file[0]);
      // if (file && file[0]) {
      //   let fileName = path.basename(file[0]);
      //   db.ui[obj][key] = fileName;
      //   Vue.set(db.ui[obj], key, fileName)
      //   //db.connection[obj][key] = file[0].toString();
      //   Vue.set(db.connection[obj], key, file[0].toString())
      // }
    },
    onPanelToggle (panelIndex, envKey) {
      this.$nextTick(() => {
        if (this.panel !== undefined) {
          const panelContainer = this.$refs.panelContainer
          const panel = this.$refs[`panel${envKey}`][0].$el
          setTimeout(
            () =>
              (panelContainer.scrollTop =
                panel.getBoundingClientRect().top +
                panelContainer.scrollTop -
                panelContainer.getBoundingClientRect().top -
                50),
            500
          )
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
      console.log('Project json before creating', this.project)

      /**
       * remove UI keys within project
       */
      const xcConfig = JSON.parse(JSON.stringify(this.project))
      console.log(JSON.stringify(this.project))
      console.log('Project json after parsing', xcConfig)
      delete xcConfig.ui

      for (const env in xcConfig.envs) {
        for (let i = 0; i < xcConfig.envs[env].db.length; ++i) {
          xcConfig.envs[env].db[i].meta.api.type = this.project.projectType
          console.log('getProjectJson:', env, i, xcConfig.envs[env].db[i])
          if (
            xcConfig.envs[env].db[i].client === 'mysql' ||
            xcConfig.envs[env].db[i].client === 'mysql2'
          ) {
            xcConfig.envs[env].db[i].connection.multipleStatements = true
          }
          this.handleSSL(xcConfig.envs[env].db[i], false)
          delete xcConfig.envs[env].db[i].ui
          if (this.client[i] === 'Vitess') {
            xcConfig.envs[env].db[i].meta.dbtype = 'vitess'
          }
          if (this.client[i] === 'TiDB') {
            xcConfig.envs[env].db[i].meta.dbtype = 'tidb'
          }
          if (xcConfig.envs[env].db[i].client === 'oracledb') {
            xcConfig.envs[env].db[i].pool = {
              min: 0,
              max: 50
            }

            xcConfig.envs[env].db[i].acquireConnectionTimeout = 60000
          }

          const inflectionObj = xcConfig.envs[env].db[i].meta.inflection

          if (inflectionObj) {
            if (Array.isArray(inflectionObj.tn)) {
              inflectionObj.tn = inflectionObj.tn.join(',')
            }
            if (Array.isArray(inflectionObj.cn)) {
              inflectionObj.cn = inflectionObj.cn.join(',')
            }

            inflectionObj.tn = inflectionObj.tn || 'none'
            inflectionObj.cn = inflectionObj.cn || 'none'
          }

          if (this.allSchemas) {
            delete xcConfig.envs[env].db[i].connection.database
            xcConfig.envs[env].db[i].meta.allSchemas = true
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
          sessionStorage.setItem('masterKey', this.auth.authSecret)
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

      xcConfig.type = this.$store.state.project.projectInfo
        ? this.$store.state.project.projectInfo.type
        : 'docker'

      if (
        this.smtpConfiguration &&
        this.smtpConfiguration.from &&
        this.smtpConfiguration.options.trim()
      ) {
        try {
          xcConfig.mailer = {
            options: JSON5.parse(this.smtpConfiguration.options),
            from: this.smtpConfiguration.from
          }
        } catch (e) {}
      }

      xcConfig.meta = xcConfig.meta || {}
      xcConfig.meta.db = {
        client: 'sqlite3',
        connection: {
          filename: 'xc.db'
        }
      }

      console.log('Project json : after', xcConfig)
      return xcConfig
    },

    constructProjectJsonFromProject (project) {
      // const {projectJson: envs, ...rest} = project;

      // let p = {...rest, ...envs};
      const p = project // JSON.parse(JSON.stringify(project.projectJson));

      p.ui = {
        envs: {
          dev: {}
        }
      }
      for (const env in p.envs) {
        let i = 0
        for (const db of p.envs[env].db) {
          Vue.set(this.client, i++, this.databaseNamesReverse[db.client])

          Vue.set(db, 'ui', {
            setup: 0,
            ssl: {
              key: this.$t('projects.ext_db.credentials.advanced.ssl.client_key'), // Client Key
              cert: this.$t('projects.ext_db.credentials.advanced.ssl.client_cert'), // Client Cert
              ca: this.$t('projects.ext_db.credentials.advanced.ssl.server_ca') // Server CA
            },
            sslUse: this.$t('projects.ext_db.credentials.advanced.ssl.preferred') // Preferred
          })
        }
      }
      // delete p.projectJson;

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
      if (p.mailer) {
        this.smtpConfiguration = {
          from: p.mailer.from,
          options: JSON.stringify(p.mailer.options, 0, 2)
        }
      }
      delete p.mailer
    },

    async createOrUpdateProject () {
      const projectJson = this.getProjectJson()
      delete projectJson.folder

      let i = 0
      const toast = this.$toast.info(this.loaderMessages[0])
      const interv = setInterval(() => {
        if (this.edit) { return }
        if (i < this.loaderMessages.length - 1) { i++ }
        if (toast) {
          if (!this.allSchemas) {
            toast.text(this.loaderMessages[i])
          } else {
            toast.goAway(100)
          }
        }
      }, 1000)

      this.projectReloading = true

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
        {
          query: {
            skipProjectHasDb: 1
          }
        },
        this.edit ? 'projectUpdateByWeb' : 'projectCreateByWeb',
        {
          project: {
            title: projectJson.title,
            folder: 'config.xc.json',
            type: 'pg'
          },
          projectJson
        }
      ])

      clearInterval(interv)
      toast.goAway(100)
      console.log('project created redirect to project page', projectJson, result)

      await this.$store.dispatch('project/ActLoadProjectInfo')

      this.projectReloading = false

      if (!this.edit && !this.allSchemas) {
        this.$router.push({
          path: `/nc/${result.id}`,
          query: {
            new: 1
          }
        })
      }

      this.projectCreated = true

      this.projectReloading = false
    },

    mtdDialogGetEnvNameSubmit (envName, cookie) {
      console.log(envName)
      this.dialogGetEnvName.dialogShow = false
      if (envName in this.project.envs) {
        console.log('Environment exists')
      } else {
        Vue.set(this.project.envs, envName, {
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
                tn: 'nc_evolutions',
                dbAlias: 'db',
                inflection: {
                  tn: ['camelize'],
                  cn: ['camelize']
                },
                api: {
                  type: ''
                }
              },
              ui: {
                setup: 0,
                ssl: {
                  key: this.$t('projects.ext_db.credentials.advanced.ssl.client_key'), // Client Key
                  cert: this.$t('projects.ext_db.credentials.advanced.ssl.client_cert'), // Client Cert
                  ca: this.$t('projects.ext_db.credentials.advanced.ssl.server_ca') // Server CA
                },
                sslUse: this.$t('projects.ext_db.credentials.advanced.ssl.preferred') // Preferred
              }
            }
          ],
          apiClient: { data: [] }
        })
      }
    },
    mtdDialogGetEnvNameCancel () {
      console.log('mtdDialogGetTableNameCancel cancelled')
      this.dialogGetEnvName.dialogShow = false
    },

    addNewEnvironment () {
      this.dialogGetEnvName.dialogShow = true
    },
    addNewDB (envKey, panelIndex) {
      const len = this.project.envs[envKey].db.length
      // eslint-disable-next-line no-unused-vars
      const lastDbName = `${this.project.title}_${envKey}_${len}`
      const dbType = (this.client[len] = this.client[len] || this.client[len - 1])
      const newlyCreatedIndex = this.project.envs[envKey].db.length
      const dbAlias =
        this.project.envs[envKey].db.length <= 0
          ? 'db'
          : `db${this.project.envs[envKey].db.length + 1}`
      this.project.envs[envKey].db.push({
        client: this.databaseNames[dbType],
        connection: {
          ...this.sampleConnectionData[dbType],
          database: `${this.project.title}_${envKey}_${newlyCreatedIndex + 1}`
        },
        meta: {
          tn: 'nc_evolutions',
          dbAlias,
          inflection: {
            tn: ['camelize'],
            cn: ['camelize']
          },
          api: {
            type: ''
          }
        },
        ui: {
          setup: 0,
          sslUse: this.$t('projects.ext_db.credentials.advanced.ssl.preferred'), // Preferred
          ssl: {
            key: this.$t('projects.ext_db.credentials.advanced.ssl.client_key'), // Client Key
            cert: this.$t('projects.ext_db.credentials.advanced.ssl.client_cert'), // Client Cert
            ca: this.$t('projects.ext_db.credentials.advanced.ssl.server_ca') // Server CA
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
      // const file = dialog.showOpenDialog({
      //   properties: ['openDirectory']
      // })
      // if (file && file[0]) {
      //   this.baseFolder = file[0]
      //   this.project.folder = file[0]
      //   this.userSelectedDir = true
      // }
    },
    selectSqliteFile (db) {
      // console.log(ev)
      // const file = dialog.showOpenDialog({
      //   properties: ["openFile"]
      // });
      // if (file && file[0]) {
      //   db.connection.connection.filename = file[0];
      // }
    },

    getDbStatusColor (db) {
      switch (db.ui.setup) {
        case -1:
          return 'red'

        case 0:
          return 'orange'

        case 1:
          return 'green'

        default:
          break
      }
    },

    getDbStatusTooltip (db) {
      switch (db.ui.setup) {
        case -1:
          return 'DB Connection NOT successful'

        case 0:
          return 'MySql Database Detected - Test your connection'

        case 1:
          return 'DB Connection successful'

        default:
          break
      }
    },
    async newTestConnection (db, env, panelIndex) {
      console.log(this.project.envs[env][0])
      if (
        db.connection.host === 'localhost' &&
        !this.edit &&
        env === 'dev' &&
        this.project.envs[env].db.length === 1 &&
        this.project.envs[env].db[0].connection.user === 'postgres' &&
        this.project.envs[env].db[0].connection.database ===
          `${this.project.title}_${env}_${this.project.envs[env].length}`
      ) {
        this.handleSSL(db)
        if (db.client === 'sqlite3') {
          db.ui.setup = 1
        } else {
          const c1 = {
            connection: {
              ...db.connection,
              ...(db.client !== 'pg' ? { database: this.testDatabaseNames[db.client] } : {})
            },
            client: db.client
          }

          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            {
              query: {
                skipProjectHasDb: 1
              }
            },
            'testConnection',
            c1
          ])
          console.log('test connection result', result)

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
              //  ignore
              } else {
                console.log(this.project.envs[e])

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
              // Connection was successful
              this.dialog.heading = this.$t('projects.ext_db.dialog.success')
              this.dialog.type = 'success'
              this.dialog.show = true
            }
          } else {
            db.ui.setup = -1
            // Connection Failure:
            this.dialog.heading = this.$t('projects.ext_db.dialog.failure') + result.message
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
      console.log('sslOptions:', sslOptions)
      if (sslOptions[0]) {
        sendAdvancedConfig = true
      } else {
        console.log('no ssl options')
      }
      return sendAdvancedConfig
    },

    handleSSL (db, creating = true) {
      console.log('handleSSL', db)
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
    getDatabaseForTestConnection (dbType) {},
    async testConnection (db, env, panelIndex) {
      this.$store.commit('notification/MutToggleProgressBar', true)
      try {
        if (!(await this.newTestConnection(db, env, panelIndex))) {
          // this.activeDbNode.testConnectionStatus = false;
          //

          this.handleSSL(db)

          console.log('testconnection params', db)
          if (db.client === 'sqlite3') {
            db.ui.setup = 1
          } else {
            const c1 = {
              connection: {
                ...db.connection,
                ...(db.client !== 'pg' ? { database: this.testDatabaseNames[db.client] } : {})
              },
              client: db.client
            }

            // const result = await this.sqlMgr.testConnection(c1);
            const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                query: {
                  skipProjectHasDb: 1
                }
              },
              'testConnection',
              c1
            ])

            console.log('test connection result', result)
            if (result.code === 0) {
              db.ui.setup = 1
              // this.dialog.heading = "Connection was successful"
              // this.dialog.type = 'success';
              // this.dialog.show = true;
              this.testSuccess = true
            } else {
              db.ui.setup = -1
              // this.activeDbNode.testConnectionStatus = false;
              this.dialog.heading = this.$t('projects.ext_db.dialog.failure') + result.message
              this.dialog.type = 'error'
              this.dialog.show = true
            }

            console.log('testconnection params : after', db)
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
              connection: {
                filename: [this.project.folder, `${this.project.title}_${env}_${index + 1}`].join(
                  '/'
                )
              },
              database: [this.project.folder, `${this.project.title}_${env}_${index + 1}`].join(
                '/'
              ),
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
      console.log(db, env, panelIndex, dbIndex)

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
  fetch ({ store, params }) {},
  beforeCreated () {},
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
              // Vue.set(db.connection, 'connection', {
              //   filename: path.join(
              //     this.project.folder,
              //     `${this.project.title}_${env}_${index + 1}`
              //   )
              // })
              Vue.set(db.connection, 'database', `${this.project.title}_${env}_${index + 1}`)
            }
          }
        }
      }
    },
    'project.envs': {
      deep: true,
      handler (envs) {
        if (typeof envs === 'object' && envs) {
          Object.entries(envs).forEach(([key, env]) => {
            let res = 1
            const msg = {}
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
    }
  },
  async created () {
    this.compErrorMessage =
      this.compErrorMessages[Math.floor(Math.random() * this.compErrorMessages.length)]

    if (this.edit) {
      // this.edit = true;
      // await this.$store.dispatch('sqlMgr/instantiateSqlMgr');
      try {
        let data = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcProjectGetConfig'])
        data = JSON.parse(data.config)
        console.log('created:', data)
        this.constructProjectJsonFromProject(data)
        this.$set(this.project, 'folder', data.folder)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    } else {
      this.project = JSON.parse(JSON.stringify(this.defaultProject))
      // this.edit = false;

      /**
       *  Figure out which databases users has by scanning port numbers
       *      preference can be - pg | mysql | mssql | oracledb | sqlite
       *      create this.project based on the database
       *
       *
       */
      let dbsAvailable = [] // await PortScanner.getOpenDbPortsAsList();
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
  beforeMount () {},
  mounted () {
    this.$set(
      this.project,
      'title',
      uniqueNamesGenerator({
        dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)]
      })
        .toLowerCase()
        .replace(/[ -]/g, '_')
    )

    this.$nextTick(() => {
      const input = this.$refs.name.$el.querySelector('input')
      input.setSelectionRange(0, this.project.title.length)
      input.focus()
    })
  },
  beforeDestroy () {},
  destroy () {},
  validate ({ params }) {
    return true
  },
  head () {
    return {
      title: this.$t('projects.ext_db.head.title')
    }
  },
  props: {
    edit: {
      type: Boolean,
      default: false
    }
  },
  directives: {}
}
</script>

<style scoped>
.floating-button {
  position: fixed;
  right: 7%;
  bottom: 100px;
}

/deep/ .v-expansion-panel-header {
  padding: 0 6px;
  min-height: 50px !important;
}

/deep/ .monaco-overlay {
  align-items: stretch;
}

/deep/ .monaco-overlay .v-overlay__content {
  flex-grow: 1;
}

.monaco-overlay-close {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 999;
  cursor: pointer !important;
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
