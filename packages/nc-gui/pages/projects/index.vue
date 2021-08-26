<template>
  <v-container fluid class="text-center px-10 pt-10 nc-container">
    <!--    <sponsor-overlay v-if="overlayVisible && projects && projects.length"-->
    <!--                     @close="overlayVisible = false"></sponsor-overlay>-->
    <v-row>
      <v-col v-if="loaded" class="col-lg-6 offset-lg-3 col-12 col-md-12">
        <v-row v-show="projects" class="justify-center">
          <v-card
            row
            class="
              pa-4
              elevation-20
              text-center
              overflow-x-hidden
              flex-shrink-1
            "
            min-width="600"
          >
            <v-overlay v-if="projectStatusUpdating" />
            <v-row justify="center">
              <h1 class="text-center display-1 pa-2">
                <!--                <p v-if="screenSize" class="caption">Screen resolution : {{screenSize}}</p>-->

                <!--                <v-icon large>mdi-folder-multiple-outline</v-icon>&nbsp;-->
                <!-- My Projects -->
                <b>{{ $t('projects.my_projects') }}</b>

                <!--                <x-btn-->
                <!--                  large-->
                <!--                  text-->
                <!--                  class="text">-->
                <!-- Refresh projects -->
                <x-icon
                  small
                  color="primary grey"
                  :tooltip="$t('projects.reload_projects_tooltip')"
                  @click="projectsLoad"
                >
                  mdi-refresh
                </x-icon>&nbsp;
                <!--                </x-btn>-->
              </h1>
            </v-row>
            <v-row class="pa-4">
              <!-- Search Project -->
              <v-text-field
                ref="search1"
                v-model="search"
                v-ge="['home', 'project-search']"
                data-v-step="3"
                class="caption pt-0 mt-0"
                :placeholder="$t('projects.search_project')"
                single-line
                hide-details
                style="max-width: 200px"
              >
                <template #prepend-inner>
                  <v-icon color="grey" class="mt-1" small>
                    search
                  </v-icon>
                </template>
              </v-text-field>
              <v-spacer />
              <!-- Import NocoDB Project by uploading metadata zip file -->
              <x-btn
                vbind:tooltip="$t('projects.import_button.text')"
                outlined
                color="grey"
                @click="
                  $refs.importFile.click();
                  project_id = null;
                "
              >
                <v-icon>mdi-import</v-icon>
              </x-btn>
              <!--              <x-btn
                              btn.class="pl-1"
                              v-if="_isUIAllowed('projectCreate',true)"
                              outlined
                              data-v-step="1"
                              color="primary"
                              tooltip="Create a new project by entering database credentials"
                              v-ge="['home','project-new']"
                              @click="onCreateProject('xcdb')">
                              <v-icon class="mr-1" small>mdi-plus</v-icon>
                              Create XCDB
                            </x-btn>
                            <x-btn
                              btn.class="pl-1"
                              v-if="_isUIAllowed('projectCreate',true)"
                              outlined
                              data-v-step="1"
                              color="primary"
                              tooltip="Create a new project by entering database credentials"
                              v-ge="['home','project-new']"
                              @click="onCreateProject()">
                              <v-icon class="mr-1" small>mdi-plus</v-icon>
                              {{ $t('projects.create_new_project_button.text') }}
                            </x-btn>-->

              <template v-if="connectToExternalDB">
                <v-menu offset-y bottom open-on-hover>
                  <template #activator="{ on }">
                    <div>
                      <x-btn
                        v-if="_isUIAllowed('projectCreate',true)"
                        v-ge="['home', 'project-new']"
                        outlined
                        data-v-step="1"
                        color="primary"
                        v-on="on"
                      >
                        <!-- New Project -->
                        {{ $t('projects.create_new_project_button.text') }}
                        <v-icon class="mr-1" small>
                          mdi-menu-down
                        </v-icon>
                      </x-btn>
                    </div>
                  </template>
                  <v-list dense>
                    <v-list-item
                      class="create-xc-db-project"
                      @click="onCreateProject('xcdb')"
                    >
                      <v-list-item-icon class="mr-2">
                        <v-icon small>
                          mdi-plus
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-title>
                        <!-- Create -->
                        <span class="caption font-weight-regular">{{
                          $t('projects.create_new_project_button.subtext_1')
                        }}</span>
                      </v-list-item-title>
                      <v-spacer />
                      <v-tooltip right>
                        <template #activator="{ on }">
                          <v-icon
                            x-small
                            color="grey"
                            class="ml-4"
                            v-on="on"
                          >
                            mdi-information-outline
                          </v-icon>
                        </template>
                        <!-- Create a new project -->
                        <span class="caption">{{
                          $t('projects.create_new_project_button.subtext_1_tooltip')
                        }}</span>
                      </v-tooltip>
                    </v-list-item>
                    <v-divider />
                    <v-list-item
                      title
                      class="pt-2 create-external-db-project"
                      @click="onCreateProject()"
                    >
                      <v-list-item-icon class="mr-2">
                        <v-icon small class="">
                          mdi-power-plug-outline
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-title>
                        <!-- Create By Connecting <br>To An External Database -->
                        <span
                          class="caption font-weight-regular"
                          v-html="
                            $t('projects.create_new_project_button.subtext_2')
                          "
                        />
                      </v-list-item-title>
                      <v-spacer />
                      <v-tooltip right>
                        <template #activator="{ on }">
                          <v-icon
                            x-small
                            color="grey"
                            class="ml-4"
                            v-on="on"
                          >
                            mdi-information-outline
                          </v-icon>
                        </template>
                        <!-- Supports MySQL, PostgreSQL, SQL Server & SQLite -->
                        <span class="caption">{{
                          $t('projects.create_new_project_button.subtext_2_tooltip')
                        }}</span>
                      </v-tooltip>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </template>
              <x-btn
                v-else-if="_isUIAllowed('projectCreate',true)"
                v-ge="['home', 'project-new']"
                outlined
                data-v-step="1"
                color="primary"
                @click="onCreateProject('xcdb')"
              >
                <!-- New Project -->
                {{ $t('projects.create_new_project_button.text') }}
              </x-btn>
            </v-row>

            <v-row>
              <v-data-table
                v-if="!loadingProjects && projects && projects.length"
                fixed-header
                hide-default-header
                :height="500"
                dense
                :headers="headers"
                :items="projects"
                :search="search"
                :footer-props="{
                  'items-per-page-options': [20, -1],
                }"
                class="pa-4 text-left mx-auto "
                style="cursor: pointer"
              >
                <template #item="props">
                  <tr
                    class="project-row"
                    :class="`nc-${props.item.projectType}-project-row`"
                    @click="projectRouteHandler(props.item)"
                  >
                    <td data-v-step="2">
                      <v-icon
                        x-small
                        class="mr-2"
                        :color="
                          props.item.status === 'started'
                            ? 'green'
                            : props.item.status === 'stopped'
                              ? 'orange'
                              : 'orange'
                        "
                      >
                        mdi-moon-full
                      </v-icon>
                      <!-- Accessible via GraphQL APIs / Accessible via REST APIs -->
                      <x-icon
                        small
                        :tooltip="
                          props.item.projectType === 'graphql'
                            ? $t('projects.project_api_type_tooltip_graphql')
                            : $t('projects.project_api_type_tooltip_rest')
                        "
                        icon.class="mr-2"
                        :color="
                          props.item.projectType === 'graphql'
                            ? 'pink'
                            : 'green'
                        "
                      >
                        {{
                          props.item.projectType === 'graphql'
                            ? 'mdi-graphql'
                            : 'mdi-code-json'
                        }}
                      </x-icon>

                      <span class="title font-weight-regular">{{
                        props.item.title
                      }}</span>
                    </td>
                    <td>
                      <div
                        v-if="_isUIAllowed('projectActions',true)"
                        :class="{
                          'action-icons': !(
                            projectStatusUpdating &&
                            props.item.id === statusUpdatingProjectId
                          ),
                        }"
                      >
                        <!-- Stop Project -->
                        <x-icon
                          v-if="props.item.status === 'started'"
                          :tooltip="
                            $t('projects.stop_project')
                          "
                          class="pointer mr-2"
                          color="orange grey"
                          @click.stop="stopProject(props.item)"
                        >
                          mdi-stop-circle-outline
                        </x-icon>
                        <!-- Start Project -->
                        <x-icon
                          v-else-if="props.item.status === 'stopped'"
                          :tooltip="
                            $t('projects.start_project')
                          "
                          class="pointer mr-2"
                          color="green grey"
                          @click.stop="startProject(props.item)"
                        >
                          mdi-play-circle-outline
                        </x-icon>
                        <x-icon
                          v-if="
                            projectStatusUpdating &&
                              props.item.id === statusUpdatingProjectId
                          "
                          class="mr-1"
                        >
                          mdi-loading mdi-spin
                        </x-icon>
                        <!-- Restart Project -->
                        <x-icon
                          :tooltip="
                            $t('projects.restart_project')
                          "
                          class="pointer mr-2"
                          color="primary grey"
                          @click.stop="restartProject(props.item)"
                        >
                          mdi-restart
                        </x-icon>
                        <!-- Delete Project -->
                        <x-icon
                          :tooltip="
                            $t('projects.delete_project')
                          "
                          class="pointer mr-2"
                          color="red grey"
                          @click.stop="deleteProject(props.item)"
                        >
                          mdi-delete-circle-outline
                        </x-icon>

                        <v-menu offset-y>
                          <template #activator="{ on }">
                            <x-icon
                              color="grey"
                              v-on="on"
                            >
                              mdi-dots-vertical
                            </x-icon>
                          </template>
                          <v-list dense>
                            <v-list-item
                              dense
                              @click="
                                $refs.importFile.click();
                                project_id = props.item.id;
                              "
                            >
                              <v-list-item-icon class="mr-1">
                                <v-icon small>
                                  mdi-import
                                </v-icon>
                              </v-list-item-icon>
                              <v-list-item-title>
                                <!-- Import Metadata -->
                                <span class="caption font-weight-regular">{{
                                  $t('projects.import_metadata')
                                }}</span>
                              </v-list-item-title>
                            </v-list-item>
                            <v-list-item
                              dense
                              @click="exportMetaZip(props.item.id)"
                            >
                              <v-list-item-icon class="mr-1">
                                <v-icon small>
                                  mdi-export
                                </v-icon>
                              </v-list-item-icon>
                              <v-list-item-title>
                                <!-- Export Metadata -->
                                <span class="caption font-weight-regular">{{
                                  $t('projects.export_metadata')
                                }}</span>
                              </v-list-item-title>
                            </v-list-item>
                            <v-list-item
                              dense
                              @click="resetMeta(props.item.id)"
                            >
                              <v-list-item-icon class="mr-1">
                                <v-icon small>
                                  mdi-delete-variant
                                </v-icon>
                              </v-list-item-icon>
                              <v-list-item-title>
                                <!-- Clear Metadata -->
                                <span class="caption font-weight-regular">{{
                                  $t('projects.clear_metadata')
                                }}</span>
                              </v-list-item-title>
                            </v-list-item>
                          </v-list>
                        </v-menu>
                      </div>
                    </td>
                  </tr>
                </template>
                <!-- Your search for "{{ search }}" found no results. -->
                <template
                  #no-results
                >
                  <v-alert
                    :value="true"
                    color="error"
                    icon="warning"
                  >
                    {{ $t('projects.search.your_search_found_no_results', {search}) }}
                  </v-alert>
                </template>
                <!--                <template v-slot:no-data>-->
                <!--                  <v-alert :value="true" outlined color="success" icon="mdi-information-outline">Create a new project-->
                <!--                  </v-alert>-->
                <!--                </template>-->
              </v-data-table>
              <v-col
                v-else-if="!loadingProjects"
                style="height: 500px"
                class="d-flex align-center justify-center"
              >
                <v-alert
                  border="left"
                  dense
                  text
                  :value="true"
                  outlined
                  color="success"
                  icon="mdi-information-outline"
                >
                  <!-- Get started by creating a new project -->
                  {{ $t('projects.project_empty_message') }}
                </v-alert>
              </v-col>
            </v-row>
          </v-card>
        </v-row>

        <v-row v-cloak v-show="!projects.length && false">
          <!--          <howItWorks class="text-left"></howItWorks>-->

          <v-col cols="" class="d-flex justify-center">
            <v-card
              height="500px"
              width="500px"
              class="elevation-20 pt-4 mt-4 d-flex flex-column"
            >
              <p
                class="
                  display-1
                  flex-grow-1
                  pt-5
                  d-flex
                  align-center
                  justify-center
                "
              >
                <!-- Create By Connecting <br>To An External Database -->
                <span v-html="$t('projects.create_new_project_button.subtext_2')" />
              </p>
              <v-card-actions class="justify-center pb-10">
                <x-btn
                  tooltip="Create New Project"
                  btn.class="   ma-4 primary"
                  color="primary"
                  large
                  @click="onCreateProject"
                >
                  <v-icon color="white" class="blink_me">
                    mdi-lightbulb-on
                  </v-icon>&nbsp;
                  <!-- New Project -->
                  {{ $t('projects.create_new_project_button.text') }}
                </x-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
      <v-col
        v-if="loaded"
        class="
          col-sm-12 col-lg-3
          d-sm-none d-md-flex
          justify-center justify-lg-end
          align-start
        "
      >
        <sponsor-mini />
      </v-col>
    </v-row>
    <!--        <dlgLabelSubmitCancel-->
    <!--          type="error"-->
    <!--          v-if="dialog.show"-->
    <!--          :dialogShow="dialog.show"-->
    <!--          :actionsMtd="_projectRemove"-->
    <!--          heading="Submit will only remove project from tool. Databases & Files will remain."-->
    <!--        />-->

    <!--    <v-tour name="myTour"></v-tour>-->

    <!--    <dlg-project-create v-model="createProjectDialog"></dlg-project-create>-->

    <div v-if="projects && projects.length" class="d-flex justify-end">
      <v-list
        class="
          flex-shrink-1
          text-left
          elevation-4
          rounded-xl
          community-card
          mr-10
        "
        width="300"
        :class="{ active: showCommunity }"
        dense
      >
        <v-list-item
          dense
          href="https://github.com/nocodb/nocodb"
          target="_blank"
        >
          <v-list-item-icon>
            <v-icon class="ml-2 mt-n2">
              mdi-github
            </v-icon>
          </v-list-item-icon>
          <v-list-item-title>
            <!-- Star -->
            {{ $t('projects.show_community_star') }}
            <v-icon small>
              mdi-star-outline
            </v-icon>
            <!-- us on Github -->
            {{ $t('projects.show_community_us_on_Github') }}
          </v-list-item-title>
        </v-list-item>
        <v-divider />
        <v-list-item
          dense
          target="_blank"
          href="https://calendly.com/nocodb"
        >
          <v-list-item-icon>
            <v-icon
              class="ml-2"
              :color="textColors[3]"
            >
              mdi-calendar-month
            </v-icon>
          </v-list-item-icon>
          <!-- Book a Free DEMO -->
          <v-list-item-title>
            {{
              $t('projects.show_community_book_a_free_demo')
            }}
          </v-list-item-title>
        </v-list-item>
        <v-divider />
        <v-list-item dense href="https://discord.gg/5RgZmkW" target="_blank">
          <v-list-item-icon>
            <v-icon class="ml-2" :color="textColors[0]">
              mdi-discord
            </v-icon>
          </v-list-item-icon>
          <!-- Get your questions answered -->
          <v-list-item-title>
            {{
              $t('projects.show_community_get_your_questions_answered')
            }}
          </v-list-item-title>
        </v-list-item>
        <v-divider />
        <v-list-item dense href="https://twitter.com/NocoDB" target="_blank">
          <v-list-item-icon>
            <v-icon class="ml-2" :color="textColors[1]">
              mdi-twitter
            </v-icon>
          </v-list-item-icon>
          <!-- Follow NocoDB -->
          <v-list-item-title>
            {{
              $t('projects.show_community_follow_nocodb')
            }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </div>

    <input
      v-show="false"
      ref="importFile"
      type="file"
      accept=".zip"
      @change="importMetaZip"
    >

    <dlg-label-submit-cancel
      v-if="dialogShow"
      type="primary"
      :actions-mtd="confirmAction"
      :dialog-show="dialogShow"
      :heading="confirmMessage"
    />
  </v-container>
</template>

<script>
import dlgLabelSubmitCancel from '../../components/utils/dlgLabelSubmitCancel.vue'
import SponsorMini from '@/components/sponsorMini'
import colors from '~/mixins/colors'

export default {
  components: {
    SponsorMini,
    dlgLabelSubmitCancel
    // howItWorks,
  },
  mixins: [colors],
  $_veeValidate: {
    validator: 'new'
  },
  data() {
    return {
      overlayVisible: true,
      showCommunity: false,
      project_id: null,
      loading: null,
      dialogShow: false,
      confirmAction: null,
      confirmMessage: '',

      createProjectDialog: false,
      projectStatusUpdating: false,
      statusUpdatingProjectId: null,
      screenSize: null,
      trialAlert: true,
      dialog1: true,
      steps: [
        {
          target: '[data-v-step="1"]',
          content: 'Click here to create new Project.',
          params: {
            placement: 'top'
          }
        },
        {
          target: '[data-v-step="2"]',
          content: 'Click here to open existing project.'
        },
        {
          target: '[data-v-step="3"]',
          content: 'Click here to filter projects.'
        },
        {
          target: '[data-v-step="4"]',
          content: 'Click here to open project folder.'
        },
        {
          target: '[data-v-step="5"]',
          content: 'Click here to edit project.'
        },
        {
          target: '[data-v-step="6"]',
          content: 'Click here to delete project.'
        }
      ],
      loaded: false,
      dialog: {
        show: false,
        title: 'Confirm Deleting project',
        heading: '',
        // mtdOk: this.projectRemove,
        type: 'error'
      },
      loadingProjects: true,
      newProjectDialog: false,
      name: '',
      type: 'MySQL',
      userSelectedDir: false,
      dialogTitle: 'New',
      databases: {
        Oracle: 'oracledb',
        Postgres: 'pg',
        MySQL: 'mysql',
        MSSQL: 'mssql',
        Sqlite: 'sqlite'
      },
      headers: [
        {
          text: 'Title',
          value: 'title',
          class: 'caption'
        },
        {
          text: '',
          value: 'name',
          sortable: false,
          class: 'caption'
        }
      ],
      projects: [],
      search: '',
      deleteBtnClicked: false
    }
  },
  computed: {
    connectToExternalDB() {
      return this.$store.state.project.projectInfo.connectToExternalDB
    }
  },
  watch: {
    name() {
      if (!this.userSelectedDir) {
        this.folder = `${this.baseFolder}/${this.name}`
      }
    }
  },
  async created() {
    this.$store.commit('windows/MutToggleGaEnabled', true)
    this.$store.commit('windows/MutToggleTelemetryEnabled', true)

    // console.log(JSON.stringify(size))

    await this.$store.dispatch('users/ActGetUserDetails')
    // this.$store.commit('windows/MutIsComp', await isComp());

    // new GCP
    // let user = await this.$axios.get('/api/v1/user/me');
    // console.log('================ user', user)
    // if (user.data && user.data.email) {
    //   this.$store.commit('users/MutSetUser', user.data);
    //   await this.$store.dispatch('users/ActGetUserUiAbility');
    // } else {
    //   this.$store.commit('users/MutSetUser', null);
    // }
  },
  async mounted() {
    setTimeout(() => (this.showCommunity = true), 2000)
    // setTimeout(() => {
    //   if (this.$store.state.windows.showTour.home)
    //     this.$tours['myTour'].start();
    // }, 2000)

    // setTimeout(() => this.trialAlert = false, (30 - this.$store.getters['windows/GtrNoOfDaysLeft']) * 15000);

    console.log('=======mounted index')
    // setTimeout(() => {
    //   this.$refs.search1.$el.querySelector('input').focus()
    //   console.log(this.$refs.search1.$el.querySelector('input'))
    //   console.log('======= within nexttick')
    // }, 200)
    await this.projectsLoad()
    // await this.openProjectIfQueryParamFound()
  },
  methods: {
    async stopProject(project) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to stop the project?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.$set(project, 'status', 'stopping')
          const projectId = project.id
          this.statusUpdatingProjectId = projectId
          this.projectStatusUpdating = true
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              { project_id: projectId },
              'projectStop'
            ])
            this.$toast
              .success(`Project '${project.title}' stopped successfully`)
              .goAway(3000)
          } catch (e) {
            this.$toast
              .error(`Project '${project.title}' stopping failed`)
              .goAway(3000)
          }
          await this.projectsLoad()
          this.projectStatusUpdating = false
          this.dialogShow = false
        }
      }
    },
    async startProject(project) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to start the project?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.$set(project, 'status', 'starting')
          const projectId = project.id
          this.statusUpdatingProjectId = projectId
          this.projectStatusUpdating = true
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              { project_id: projectId },
              'projectStart'
            ])
            this.$toast
              .success(`Project '${project.title}' started successfully`)
              .goAway(3000)
          } catch (e) {
            this.$toast
              .error(`Project '${project.title}' starting failed`)
              .goAway(3000)
          }
          await this.projectsLoad()
          this.projectStatusUpdating = false
          this.dialogShow = false
        }
      }
    },
    async restartProject(project) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to restart the project?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.$set(project, 'status', 'restarting')
          const projectId = project.id
          this.statusUpdatingProjectId = projectId
          this.projectStatusUpdating = true
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              { project_id: projectId },
              'projectRestart'
            ])
            this.$toast
              .success(`Project '${project.title}' restarted successfully`)
              .goAway(3000)
          } catch (e) {
            this.$toast
              .error(`Project '${project.title}' restarting failed`)
              .goAway(3000)
          }
          await this.projectsLoad()
          this.projectStatusUpdating = false
          this.dialogShow = false
        }
      }
    },
    async deleteProject(project) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to delete the project?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.$set(project, 'status', 'deleting')
          const projectId = project.id
          this.statusUpdatingProjectId = projectId
          this.projectStatusUpdating = true
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              { project_id: projectId },
              'projectDelete'
            ])
            this.$toast
              .success(`Project '${project.title}' deleted successfully`)
              .goAway(3000)
          } catch (e) {
            this.$toast
              .error(`Project '${project.title}' restarting failed`)
              .goAway(3000)
          }
          await this.projectsLoad()
          this.projectStatusUpdating = false

          this.dialogShow = false
        }
      }
    },
    onCreateProject(xcdb) {
      if (xcdb === 'xcdb') {
        this.$router.push('/project/xcdb')
      } else {
        this.$router.push('/project/0')
      }
    },
    async importProjectFromJSON() {
    },
    onTourCompletion() {
      // this.$store.commit('windows/MutShowTour', {page: 'home'})
    },
    getDir(filePath) {
      // return path.dirname(filePath);
    },
    async projectsLoad() {
      try {
        this.loadingProjects = true
        // console.log('projects', projects)
        // this.projects = projectsData.data.list.reverse();
        this.projects = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            query: {
              skipProjectHasDb: 1
            }
          },
          'projectList'
        ])

        // todo: multiplex
        const user = this.$store.state.users.user
        if (
          !(this.projects && this.projects.length) &&
          user &&
          user.roles &&
          user.roles.owner
        ) {
          if (
            this.$store.state.project.projectInfo &&
            this.$store.state.project.projectInfo.oneClick
          ) {
            // this.$router.push({
            //   path: `/project/xcdb`
            // });
          }
          // else {
          // this.$router.push({
          //   path: `/project/0`
          // });
          // }
        }

        this.loadingProjects = false
      } catch (error) {
        console.log('Project fetch err', error)
      }
      this.loaded = true
    },
    projectRouteHandler(project) {
      if (project.status !== 'started') {
        this.$toast
          .info(
            `Project '${project.title}' is not running, please start to open it`
          )
          .goAway(5000)
        return
      }

      if (!this.deleteBtnClicked) {
        this.$router.push({
          path: `/nc/${project.id}`
        })
      }
    },
    async projectEdit(project) {
      console.log('projectEdit')
      this.$router.push({
        path: `project/0?edit=true&projectId=${project.id}`
      })
    },
    async projectOpenFolder(project) {
      console.log('projectEdit')
    },

    async exportMetaZip(projectId) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to export metadata from meta tables?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.loading = 'export-zip'
          let data
          try {
            data = await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                project_id: projectId,
                env: 'dev'
              },
              'xcMetaTablesExportDbToZip',
              null,
              null,
              {
                responseType: 'blob'
              }
            ])
            const url = window.URL.createObjectURL(
              new Blob([data], { type: 'application/zip' })
            )
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'meta.zip') // or any other extension
            document.body.appendChild(link)
            link.click()
            this.$toast
              .success('Successfully exported metadata')
              .goAway(3000)
          } catch (e) {
            this.$toast.error(e.message).goAway(3000)
          }
          this.dialogShow = false
          this.loading = null
        }
      }
    },
    async resetMeta(projectId) {
      this.dialogShow = true
      this.confirmMessage = 'Do you want to clear metadata from meta tables?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.loading = 'reset-metadata'
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: 'dev',
                project_id: projectId
              },
              'xcMetaTablesReset'
            ])
            this.$toast.success('Metadata cleared successfully').goAway(3000)
          } catch (e) {
            this.$toast.error(e.message).goAway(3000)
          }
          this.dialogShow = false
          this.loading = null
        }
      }
    },
    async importMetaZip() {
      const projectId = this.project_id
      if (
        this.$refs.importFile &&
        this.$refs.importFile.files &&
        this.$refs.importFile.files[0]
      ) {
        const zipFile = this.$refs.importFile.files[0]
        this.loading = 'import-zip'
        try {
          this.$refs.importFile.value = ''
          await this.$store.dispatch('sqlMgr/ActUpload', [
            {
              // dbAlias: 'db',
              project_id: projectId,
              env: 'dev'
            },
            'xcMetaTablesImportZipToLocalFsAndDb',
            {},
            zipFile
          ])
          this.$toast.success('Successfully imported metadata').goAway(3000)
          await this.projectsLoad()
        } catch (e) {
          this.$toast.error(e.message).goAway(3000)
        }
        this.dialogShow = false
        this.loading = null
      }
    }
  }
}
</script>
<style scoped>
.action-icons {
  opacity: 0;
  transition: 0.2s opacity;
}

tr:hover .action-icons {
  opacity: 1;
}

@media screen and (max-width: 1240px) {
  .community-card {
    display: none;
  }
}

.community-card {
  position: absolute;
  right: -300px;
  bottom: 60px;
  opacity: 0;
  transition: 2s right, 2s opacity;
}

.community-card.active {
  right: 0px;
  opacity: 1;
}

.nc-container {
  position: relative;
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
