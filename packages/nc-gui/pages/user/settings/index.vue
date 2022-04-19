<template>
  <v-container class="text-center">
    <v-row align="center">
      <v-col class="col-md-8 offset-md-2">
        <v-tabs
          v-model="tabs1.tab"
          background-color=""
          class="elevation-2"
        >
          <v-tabs-slider />

          <v-tab
            v-for="(t,i) in tabs1.tabs"
            :key="i"
            :href="`#tab-${i}`"
          >
            <span class="caption text-capitalize">{{ t.title }}</span>
          </v-tab>

          <v-tab-item
            v-for="(t,i) in tabs1.tabs"
            :key="i"
            :value="'tab-' + i"
          >
            <v-card
              v-if="t.type==='password'"
              class="py-10 "
              flat
              tile
            >
              <br>
              <div v-if="isAdmin">
                <h1>You are an Admin too!</h1>
                <h2 class="title is-2">
                  You are admin as well
                </h2>
                <router-link to="/user/admin">
                  User list
                </router-link>
              </div>

              <v-row align="center">
                <v-col md="8" offset-md="2">
                  <!--                  <p class="title">
                    Change Password
                  </p>-->

                  <div>
                    <v-alert v-model="formUtil.formErr" type="error" dismissible>
                      {{ formUtil.formErrMsg }}
                    </v-alert>
                  </div>

                  <v-card class="pa-5 elevation-10" color="">
                    <v-form ref="formType" v-model="valid" lazy-validation>
                      <v-text-field
                        v-model="passwordDetails.currentPassword"
                        dense
                        class="caption"
                        name="input-10-2"
                        label="Currrent password"
                        :append-icon="e3 ? 'visibility' : 'visibility_off'"
                        :rules="formRules.password[0]"
                        :type="e3 ? 'password' : 'text'"
                        @click:append="() => (e3 = !e3)"
                      />

                      <v-text-field
                        v-model="passwordDetails.newPassword"
                        dense
                        class="caption"
                        name="input-10-2"
                        label="New password"
                        :append-icon="e4 ? 'visibility' : 'visibility_off'"
                        :rules="formRules.password[1]"
                        :type="e4 ? 'password' : 'text'"
                        @click:append="() => (e4 = !e4)"
                      />

                      <v-text-field
                        v-model="passwordDetails.verifyPassword"
                        dense
                        class="caption"
                        name="input-10-2"
                        label="Confirm new password"
                        :append-icon="e5 ? 'visibility' : 'visibility_off'"
                        :rules="formRules.password[2]"
                        :type="e5 ? 'password' : 'text'"
                        @click:append="() => (e5 = !e5)"
                      />

                      <v-btn
                        class="caption"
                        color="primary"
                        :disabled="!valid"
                        @click="resetUserPassword"
                      >
                        SAVE PASSWORD
                      </v-btn>
                    </v-form>
                  </v-card>
                </v-col>
              </v-row>
            </v-card>
          </v-tab-item>
        </v-tabs>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { isEmail } from '@/helpers'

export default {
  directives: {},
  components: {},
  validate({ params }) {
    return true
  },
  props: {},
  data() {
    return {
      user: {
        provider: 'local'
      },
      tabs: 3,
      tabs1: {
        tab: null,
        tabs: [{
          type: 'password',
          title: 'Change Password'
        }
        ]
      },

      subscriptions: [],

      passwordDetails: {
        newPassword: null,
        verifyPassword: null,
        currentPassword: null
      },
      formUtil: {
        formErr: false,
        formErrMsg: ''
      },
      e3: true,
      e4: true,
      e5: true,
      valid: true,
      formRules: {
        email: [
          // E-mail is required
          v => !!v || this.$t('msg.error.signUpRules.emailReqd'),
          // E-mail must be valid
          v => isEmail(v) ||
            this.$t('msg.error.signUpRules.emailInvalid')
        ],
        password: [
          // Current Password
          [
            // Password is required
            v => !!v || this.$t('msg.error.signUpRules.passwdRequired')
          ],
          // New Password
          [
            // Password is required
            v => !!v || this.$t('msg.error.signUpRules.passwdRequired'),
            // You password must be atleast 8 characters
            v => (v && v.length >= 8) || this.$t('msg.error.signUpRules.passwdLength')
          ],
          // Confirm Password
          [
            // Password is required
            v => !!v || this.$t('msg.error.signUpRules.passwdRequired'),
            // TODO: i18n
            v => v === this.passwordDetails.newPassword || 'Confirm password should match',
            // You password must be atleast 8 characters
            v => (v && v.length >= 8) || this.$t('msg.error.signUpRules.passwdLength')
          ]
        ]
      }
    }
  },
  head() {
    return {}
  },
  computed: {
    isAdmin() {
      if (this.$store.state.users.user) {
        // console.log(this.$store.state.users.user.roles.indexOf('creator'));
        return 'creator' in this.$store.state.users.user.roles
      }
      return false
    },

    isEmailAuth() {
      if (this.$store.state.users.user) {
        // console.log(this.$store.state.users.user.roles.indexOf('creator'));
        return (this.$store.state.users.user.provider === 'local')
      }
      return false
    }

  },
  watch: {},
  created() {
  },
  mounted() {
    this.getSubscriptions()
  },
  beforeDestroy() {
  },
  methods: {
    test() {
      // console.log('test method');
    },

    async resetUserPassword(e) {
      e.preventDefault()
      if (this.$refs.formType[0].validate()) {
        // console.log('passworDetails',this.passwordDetails);
        const err = await this.$store.dispatch('users/ActPostPasswordChange', this.passwordDetails)
        if (err) {
          this.formUtil.formErr = true
          this.formUtil.formErrMsg = err.data.msg
        } else {
          this.$toast.success('Password changed successfully.').goAway(3000)
          this.$refs.formType[0].reset()
        }
      }
    },

    async getSubscriptions(e) {
    }
  },
  beforeCreated() {
  },
  destroy() {
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
