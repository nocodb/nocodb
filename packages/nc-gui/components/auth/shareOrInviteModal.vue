<template>
  <v-dialog v-model="userEditDialog" :width="invite_token ? 700 :700" @close="invite_token = null">
    <v-card v-if="selectedUser" style="min-height: 100%" class="elevation-0">
      <v-card-title>
        {{ $t('activity.share') }} : {{ $store.getters['project/GtrProjectName'] }}

        <div class="nc-header-border" />
      </v-card-title>

      <v-card-text>
        <div>
          <v-icon small>
            mdi-account-outline
          </v-icon>
          <template v-if="invite_token">
            Copy Invite Token
          </template>
          <template v-else-if="selectedUser.id">
            Edit User
          </template>
          <template v-else>
            <!-- Invite Team -->
            {{ $t('activity.inviteTeam') }}
          </template>
        </div>
        <div class="pa-4 nc-invite-container">
          <div v-if="invite_token" class="mt-6  align-center">
            <v-alert
              v-ripple
              type="success"
              outlined

              class="pointer"
              @click="clipboard(inviteUrl); $toast.success('Copied invite url to clipboard').goAway(3000)"
            >
              <template #append>
                <v-icon color="green" class="ml-2">
                  mdi-content-copy
                </v-icon>
              </template>
              <div class="ellipsis d-100">
                {{ inviteUrl }}
              </div>
            </v-alert>

            <p class="caption grey--text mt-3">
              {{ $t('msg.info.userInviteNoSMTP') }}
              <!-- Looks like you have not configured mailer yet! <br>Please copy above -->
              <!-- invite -->
              <!-- link and send it to -->
              {{ invite_token && (invite_token.email || invite_token.emails && invite_token.emails.join(', ')) }}.
            </p>

            <div class="text-right">
              <!--tooltip="Invite more users"-->
              <x-btn
                :tooltip="$t('tooltip.inviteMore')"
                small
                outlined
                btn.class="grey--text"
                @click="clickInviteMore"
              >
                <v-icon small color="grey" class="mr-1">
                  mdi-account-multiple-plus-outline
                </v-icon>
                <!--Invite more-->
                {{ $t('activity.inviteMore') }}
              </x-btn>
            </div>

            <!--          todo: show error message if failed-->
          </div>
          <template v-else>
            <v-form ref="form" v-model="valid" @submit.prevent="saveUser">
              <v-row class="my-0">
                <v-col cols="8" class="py-0">
                  <!--hint="You can add multiple comma(,) separated emails"-->
                  <v-text-field
                    ref="email"
                    v-model="selectedUser.email"
                    :disabled="!!selectedUser.id"
                    dense
                    validate-on-blur
                    outlined
                    :rules="emailRules"
                    class="caption"
                    :hint="$t('msg.info.addMultipleUsers')"
                    label="Email"
                    @input="edited=true"
                  >
                    <template #label>
                      <span class="caption">
                        <!-- Email -->
                        {{ $t('labels.email') }}
                      </span>
                    </template>
                  </v-text-field>
                </v-col>
                <v-col cols="4" class="py-0">
                  <!--label="Select User Role"-->
                  <v-combobox
                    v-model="selectedRoles"
                    outlined
                    :rules="roleRules"
                    class="role-select caption"
                    hide-details="auto"
                    :items="roles"
                    :label="$t('labels.selectUserRole')"
                    dense
                    deletable-chips
                    @change="edited = true"
                  >
                    <template #selection="{item}">
                      <v-chip small :color="rolesColors[item]">
                        {{ item }}
                      </v-chip>
                    </template>
                    <template #item="{item}">
                      <div>
                        <div>{{ item }}</div>
                        <div class="mb-2 caption grey--text">
                          {{ roleDescriptions[item] }}
                        </div>
                      </div>
                    </template>
                  </v-combobox>
                </v-col>
              </v-row>
            </v-form>
            <div class="text-center mt-0">
              <x-btn
                v-ge="['rows','save']"
                :tooltip="$t('tooltip.saveChanges')"
                color="primary"

                btn.class="nc-invite-or-save-btn"
                @click="saveUser"
              >
                <v-icon small left>
                  {{ selectedUser.id ? 'save' : 'mdi-send' }}
                </v-icon>
                {{ selectedUser.id ? $t('general.save') : $t('activity.invite') }}
              </x-btn>
            </div>
          </template>
          <!--        </v-card-actions>-->
        </div>
      </v-card-text>
      <v-card-text>
        <share-base />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { isEmail } from '~/helpers'
import { enumColor } from '~/components/project/spreadsheet/helpers/colors'
import ShareBase from '~/components/base/shareBase'

export default {
  name: 'ShareOrInviteModal',
  components: { ShareBase },
  props: {
    value: Boolean
  },
  data: () => ({
    roles: ['creator', 'editor', 'commenter', 'viewer'],
    selectedUser: {},
    invite_token: null,
    valid: null,
    emailRules: [
      v => !!v || 'E-mail is required',
      (v) => {
        const invalidEmails = (v || '').split(/\s*,\s*/).filter(e => !isEmail(e))
        return !invalidEmails.length || `"${invalidEmails.join(', ')}" - invalid email`
      }
    ],
    roleRules: [
      v => !!v || 'User Role is required',
      v => ['creator', 'editor', 'commenter', 'viewer'].includes(v) || 'invalid user role'
    ],
    userList: [],
    roleDescriptions: {},
    deleteUserType: ''
  }),
  computed: {
    userEditDialog: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    },
    inviteUrl() {
      return this.invite_token ? `${location.origin}${location.pathname}#/user/authentication/signup/${this.invite_token.invite_token}` : null
    },
    rolesColors() {
      const colors = this.$store.state.windows.darkTheme ? enumColor.dark : enumColor.light
      return this.roles.reduce((o, r, i) => {
        o[r] = colors[i % colors.length]
        return o
      }, {})
    },

    selectedRoles: {
      get() {
        return (this.selectedUser && this.selectedUser.roles ? this.selectedUser.roles.split(',') : []).sort((a, b) => this.roleNames.indexOf(a) - this.roleNames.indexOf(a))[0]
      },
      set(roles) {
        if (this.selectedUser) {
          this.selectedUser.roles = roles // .filter(Boolean).join(',')
        }
      }
    }
  },
  methods: {

    async saveUser() {
      this.validate = true
      await this.$nextTick()
      if (this.loading || !this.$refs.form.validate() || !this.selectedUser) {
        return
      }
      this.$tele.emit(`user-mgmt:add:${this.selectedUser.roles}`)

      if (!this.edited) {
        this.userEditDialog = false
      }

      try {
        let data
        if (this.selectedUser.id) {
          await this.$api.auth.projectUserUpdate(this.$route.params.project_id, this.selectedUser.id, {
            roles: this.selectedUser.roles,
            email: this.selectedUser.email,
            project_id: this.$route.params.project_id,
            projectName: this.$store.getters['project/GtrProjectName']
          })
        } else {
          data = (await this.$api.auth.projectUserAdd(this.$route.params.project_id, {
            ...this.selectedUser,
            project_id: this.$route.params.project_id,
            projectName: this.$store.getters['project/GtrProjectName']
          }))
        }
        this.$toast.success('Successfully updated the user details').goAway(3000)
        this.$emit('saved')
        if (data && data.invite_token) {
          this.invite_token = data
          // todo: bring anim
          // this.simpleAnim()
          return
        }
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
      }

      this.userEditDialog = false
    },

    clickInviteMore() {
      this.$tele.emit('user-mgmt:invite-more')
      this.invite_token = null
      this.selectedUser = { roles: 'editor' }
    },
    clipboard(str) {
      const el = document.createElement('textarea')
      el.addEventListener('focusin', e => e.stopPropagation())
      el.value = str
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)

      this.$tele.emit('user-mgmt:copy-url')
    }
  }
}
</script>

<style scoped>

</style>
