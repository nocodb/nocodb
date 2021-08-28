<template>
  <div class="main  justify-center d-flex" style="min-height: 600px;overflow: auto">
    <!--    <v-toolbar>-->
    <!--      <v-spacer></v-spacer>-->
    <!--      <v-spacer></v-spacer>-->
    <!--    </v-toolbar>-->

    <v-form ref="form" v-model="valid" @submit.prevent="createProject">
      <v-card style="width:530px;margin-top: 100px" class="mx-auto">
        <div
          style="position: absolute;top:-33px;
                  left:-moz-calc(50% - 33px);
                  left:-webkit-calc(50% - 33px);
                  left:calc(50% - 33px);
                  border-radius: 15px;
                  "
          class="primary"
        >
          <v-img
            class="mx-auto"
            width="66"
            height="66"
            :src="require('~/assets/img/icons/512x512-trans.png')"
          />
        </div>

        <v-container fluid class="pb-10 px-12" style="padding-top: 43px !important;">
          <h1 class="mt-4 mb-4 text-center">
            Create Project
          </h1>
          <div class="mx-auto" style="width:350px">
            <v-text-field
              ref="name"
              v-model="name"
              autofocus
              :full-width="false"
              class="nc-metadb-project-name"
              label="Enter Project Name"
              :rules="[v => !!v || 'Project name required']"
            />

            <div class="wrapper mb-5 mt-5">
              <v-container fluid>
                <label class="grey--text ml-1 d-block my-2">Access Project Via</label>

                <v-radio-group v-model="projectType" hide-details dense class="mb-0 mt-0">
                  <v-radio
                    v-for="(type,i) in projectTypes"
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
              </v-container>
            </div>
          </div>
          <!--  <v-select
              outlined
              label="API type"
              v-model="projectType" persistent-hint dense
              class="caption mt-3"
              :items="projectTypes">
              <template v-slot:prepend-inner>
                <img v-if="typeIcon.type === 'img'" :src="typeIcon.icon" style="width: 25px">
                <v-icon v-else :color="typeIcon.iconColor" size="25">{{ typeIcon.icon }}</v-icon>
              </template>
              <template v-slot:item="{item}">
                        <span class="caption d-flex align-center">
                        <img v-if="item.type === 'img'" :src="item.icon" style="width: 30px">
                          <v-icon v-else :color="item.iconColor">{{ item.icon }}</v-icon> &nbsp; {{ item.text }}</span>
              </template>

            </v-select>-->

          <div class="text-center">
            <v-btn
              class="mt-3"
              large
              :loading="loading"
              color="primary"
              @click="createProject"
            >
              <v-icon class="mr-1 mt-n1">
                mdi-rocket-launch-outline
              </v-icon>
              <span class="mr-1">Create</span>
            </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-form>
  </div>
</template>

<script>
import colors from '@/mixins/colors'

export default {
  name: 'Name',
  mixins: [colors],
  data: () => ({
    valid: null,
    name: '',
    loading: false,
    projectType: 'rest',
    projectTypes: [
      { text: 'REST APIs', value: 'rest', icon: 'mdi-code-json', iconColor: 'green' },
      { text: 'GRAPHQL APIs', value: 'graphql', icon: 'mdi-graphql', iconColor: 'pink' }
      /*   {
           text: 'Automatic gRPC APIs on database',
           value: 'grpc',
           icon: require('@/assets/img/grpc-icon-color.png'),
           type: 'img'
         }, */
    ]
  }),
  computed: {
    typeIcon() {
      if (this.projectType) {
        return this.projectTypes.find(({ value }) => value === this.projectType)
      } else {
        return { icon: 'mdi-server', iconColor: 'primary' }
      }
    }
  },
  mounted() {
    setTimeout(() => {
      this.$refs.name.$el.querySelector('input').focus()
    }, 100)
  },
  methods: {
    async createProject() {
      if (this.$refs.form.validate()) {
        this.loading = true
        try {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectCreateByWebWithXCDB', {
            title: this.name,
            projectType: this.projectType
          }])

          await this.$store.dispatch('project/ActLoadProjectInfo')

          this.projectReloading = false

          if (this.$store.state.project.projectInfo.firstUser || this.$store.state.project.projectInfo.authType === 'masterKey') {
            return this.$router.push({
              path: '/user/authentication/signup'
            })
          }

          this.$router.push({
            path: `/nc/${result.id}`,
            query: {
              new: 1
            }
          })
        } catch (e) {
          this.$toast.error(e.message).goAway(3000)
        }
        this.loading = false
      } else {
        // this.$toast.
      }
    }
  }
}
</script>

<style scoped>
/deep/ label {
  font-size: .75rem;
}

.wrapper {
  border: 2px solid var(--v-backgroundColor-base);
  border-radius: 4px;
}

.main {
  height: calc(100vh - 40px)
}
</style>
