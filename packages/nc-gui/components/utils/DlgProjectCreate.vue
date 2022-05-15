<template>
  <v-dialog :value="value" width="600px">
    <v-card>
      <v-container fluid>
        <v-form ref="form" v-model="valid">
          <div style="width:500px" class="mx-auto mt-10">
            <v-text-field
              ref="input"
              v-model="name"
              outlined
              :full-width="false"
              class="caption"
              dense
              label="Project name"
              :rules="[v => !!v || 'Project name required']"
              @keyup.enter="createProject"
            />

            <div v-for="type in projectTypes" :key="type.text">
              <v-radio-group v-model="projectType" hide-details dense>
                <v-radio :value="type.value">
                  <template #label>
                    <v-icon small :color="type.iconColor">
                      {{ type.icon }}
                    </v-icon>
                    <span class="caption">{{ type.text }}</span>
                  </template>
                </v-radio>
              </v-radio-group>
            </div>

            <!-- Create Project -->
            <div class="text-center">
              <v-btn
                :loading="loading"
                :disabled="!valid"
                color="primary"
                @click="createProject"
              >
                {{ $t('activity.createProject') }}
              </v-btn>
            </div>
          </div>
        </v-form>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'DlgProjectCreate',
  props: {
    value: Boolean
  },
  data: () => ({
    valid: null,
    name: '',
    loading: false,
    projectType: 'rest',
    projectTypes: [
      { text: 'Automatic REST APIs on database', value: 'rest', icon: 'mdi-code-json', iconColor: 'green' },
      { text: 'Automatic GRAPHQL APIs on database', value: 'graphql', icon: 'mdi-graphql', iconColor: 'pink' }
      /*      {
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
      this.$refs.input.$el.querySelector('input').focus()
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
          this.$emit('change', false)
        } catch (e) {
          this.$toast.error(e.message).goAway(3000)
        }
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>

</style>
