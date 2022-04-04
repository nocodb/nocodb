<template>
  <div>
    <v-toolbar>
      <v-spacer />
      Create New Project
      <v-spacer />
    </v-toolbar>
    <v-container>
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
          <!--
          <v-select
            v-model="projectType"
            outlined
            label="API type"
            persistent-hint
            dense
            class="caption mt-3"
            :items="projectTypes"
          >
            <template #prepend-inner>
              <img v-if="typeIcon.type === 'img'" :src="typeIcon.icon" style="width: 25px">
              <v-icon v-else :color="typeIcon.iconColor" size="25">
                {{ typeIcon.icon }}
              </v-icon>
            </template>
            <template #item="{item}">
              <span class="caption d-flex align-center">
                <img v-if="item.type === 'img'" :src="item.icon" style="width: 30px">
                <v-icon v-else :color="item.iconColor">{{ item.icon }}</v-icon> &nbsp; {{ item.text }}</span>
            </template>
          </v-select>-->

          <!-- Create Project -->
          <div class="text-center">
            <v-btn
              :loading="loading"
              :disabled="!valid"
              small
              color="primary"
              @click="createProject"
            >
              {{ $t('activity.createProject') }}
            </v-btn>
          </div>
        </div>
      </v-form>
    </v-container>
  </div>
</template>

<script>
export default {
  name: 'Name',
  data: () => ({
    valid: null,
    name: '',
    loading: false,
    projectType: 'rest',
    projectTypes: [
      { text: 'Automatic REST APIs on database', value: 'rest', icon: 'mdi-code-json', iconColor: 'green' },
      { text: 'Automatic GRAPHQL APIs on database', value: 'graphql', icon: 'mdi-graphql', iconColor: 'pink' },
      {
        text: 'Automatic gRPC APIs on database',
        value: 'grpc',
        icon: require('@/assets/img/grpc-icon-color.png'),
        type: 'img'
      }
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
          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectCreateByOneClick', {
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
      }
    }
  }
}
</script>

<style scoped>
/deep/ label {
  font-size: .75rem;
}
</style>
