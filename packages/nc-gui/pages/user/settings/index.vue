<template>
  <v-container class="text-center">
    <v-row align="center">
      <v-col class="col-md-8 offset-md-2">
        <v-tabs
          v-model="tabs1.tab"
          background-color=""
          class="elevation-2"
          dark>

          <v-tabs-slider></v-tabs-slider>

          <v-tab
            v-for="(t,i) in tabs1.tabs"
            :key="i"
            :href="`#tab-${i}`">
            {{t.title}}
          </v-tab>

          <v-tab-item
            v-for="(t,i) in tabs1.tabs"
            :key="i"
            :value="'tab-' + i">
            <v-card
              class="py-10 "
              flat
              tile v-if="t.type==='password'">
              <br>
              <div v-if="isAdmin">
                <h1>You are an Admin too!</h1>
                <h2 class="title is-2">You are admin as well</h2>
                <router-link to="/user/admin">User list</router-link>
              </div>

              <v-row align="center">
                <v-col md="8" offset-md="2">

                  <p class="display-1">Change Password</p>


                  <div>
                    <v-alert type="error" dismissible v-model="formUtil.formErr">
                      {{formUtil.formErrMsg}}
                    </v-alert>
                  </div>

                  <br>

                  <v-card class="pa-5 elevation-10" color="">
                    <v-form v-model="valid" ref="formType" lazy-validation>

                      <v-text-field
                        name="input-10-2"
                        label="Currrent password"
                        :append-icon="e3 ? 'visibility' : 'visibility_off'"
                        @click:append="() => (e3 = !e3)"
                        v-model="passwordDetails.currentPassword"
                        :rules="formRules.password[0]"
                        :type="e3 ? 'password' : 'text'"
                      ></v-text-field>

                      <v-text-field
                        name="input-10-2"
                        label="New password"
                        :append-icon="e4 ? 'visibility' : 'visibility_off'"
                        @click:append="() => (e4 = !e4)"
                        v-model="passwordDetails.newPassword"
                        :rules="formRules.password[1]"
                        :type="e4 ? 'password' : 'text'"
                      ></v-text-field>

                      <v-text-field
                        name="input-10-2"
                        label="Confirm new password"
                        :append-icon="e5 ? 'visibility' : 'visibility_off'"
                        @click:append="() => (e5 = !e5)"
                        v-model="passwordDetails.verifyPassword"
                        :rules="formRules.password[2]"
                        :type="e5 ? 'password' : 'text'"
                      ></v-text-field>


                      <v-btn
                        @click="resetUserPassword"
                        color="primary"
                        large
                        :disabled="!valid">
                        SAVE PASSWORD
                      </v-btn>

                    </v-form>
                  </v-card>
                </v-col>
              </v-row>

            </v-card>
            <v-card
              class="py-10 px-4"
              flat
              tile v-if="t.type==='subscription'">
              <br>
              <p class="display-1">
                Your subscriptions
              </p>

              <v-simple-table class="mt-10 mb-4">
                <template v-slot:default>
                  <thead>
                  <tr>
                    <th class="text-center">Plan</th>
                    <th class="text-center">Created On</th>
                    <th class="text-center">Expires On</th>
                  </tr>
                  </thead>
                  <tbody>
                  <template v-if="subscriptions && subscriptions.length">
                    <tr v-for="(s,i) in subscriptions" :key="i">
                      <td>{{s.plan_id}}</td>
                      <td>{{new Date(s.created_at).toLocaleDateString()}}</td>
                      <td>{{new Date(JSON.parse(s.api_response).subscription.current_term_end *
                        1000).toLocaleDateString()}}
                      </td>
                    </tr>
                  </template>
                  <tr v-else class="grey--text">
                    <td colspan="3"> No subscription found.</td>
                  </tr>
                  </tbody>
                </template>
              </v-simple-table>

              <v-row class="text-center">
                <v-btn @click="getSubscriptions" class="mx-auto orange-gradient white--text">
                  <v-icon>mdi-refresh</v-icon>&nbsp; Refresh
                </v-btn>
              </v-row>


              <!--            <v-btn @click.prevent="getSubscriptions">Show Subscriptions</v-btn>-->
              <!--            <pre v-if="subscriptions.length">-->
              <!--              <div v-for="(s,i) in subscriptions" :key="i">-->
              <!--              plan : {{s.plan_id}}-->
              <!--              subscription : {{s.subscription_id}}-->
              <!--                users_id : {{s.fk_users_id}}-->
              <!--                created : {{s.created_at}}-->
              <!--                s : {{JSON.parse(s.api_response).subscription}}-->
              <!--                s : {{new Date(JSON.parse(s.api_response).subscription.current_term_end * 1000).toLocaleDateString()}}-->
              <!--              </div>-->
              <!--            </pre>-->
            </v-card>
          </v-tab-item>
        </v-tabs>
      </v-col>
    </v-row>
  </v-container>


</template>

<script>
  import {isEmail} from "@/helpers";

  export default {
    data() {
      return {
        user: {
          provider: 'local',
        },
        tabs: 3,
        tabs1: {
          tab: null,
          tabs: [{
            type: 'password',
            title: 'Change Password',
          }, {
            type: 'subscription',
            title: 'Subscriptions',
          }]
        },

        subscriptions: [],

        passwordDetails: {
          newPassword: null,
          verifyPassword: null,
          currentPassword: null
        },
        formUtil: {
          formErr: false,
          formErrMsg: '',
        },
        e3: true,
        e4: true,
        e5: true,
        valid: true,
        formRules: {
          email: [
            v => !!v || 'E-mail is required',
            v => isEmail(v) || 'E-mail must be valid'
          ],
          password: [
            [v => !!v || 'Password is required'],
            [v => !!v || 'New Password is required'],
            [v => v === this.passwordDetails.newPassword || 'Confirm password should match'],
          ],
        },


      }
    },
    computed: {
      isAdmin() {
        if (this.$store.state.users.user) {
          //console.log(this.$store.state.users.user.roles.indexOf('creator'));
          return 'creator' in this.$store.state.users.user.roles;
        }
        return false;
      },

      isEmailAuth() {

        if (this.$store.state.users.user) {
          //console.log(this.$store.state.users.user.roles.indexOf('creator'));
          return (this.$store.state.users.user.provider === 'local');
        }
        return false;

      }

    },
    methods: {
      test() {
        //console.log('test method');
      },

      async resetUserPassword(e) {
        e.preventDefault();
        if (this.$refs.formType[0].validate()) {
          //console.log('passworDetails',this.passwordDetails);
          const err = await this.$store.dispatch('users/ActPostPasswordChange', this.passwordDetails)
          if (err) {
            this.formUtil.formErr = true;
            this.formUtil.formErrMsg = err.data.msg;
          } else {
            this.$toast.success('Password changed successfully.').goAway(3000);
            this.$refs.formType[0].reset();
          }
        }
      },

      async getSubscriptions(e) {
        console.log('get subs');
        let data = await this.$store.dispatch('users/ActGetSubscriptionsList')
        this.subscriptions = data;
      }
    },
    beforeCreated() {
    },
    created() {
    },
    mounted() {
      this.getSubscriptions();
    },
    beforeDestroy() {
    },
    destroy() {
    },
    validate({params}) {
      return true
    },
    head() {
      return {}
    },
    props: {},
    watch: {},
    directives: {},
    components: {}
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
