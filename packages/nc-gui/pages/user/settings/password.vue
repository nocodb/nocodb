<template>
  <v-container class="text-center">
    <v-row align="center">
      <v-col md="6" offset-md="3">
        <h1>Change Password</h1>
        <br>

        <v-card class="pa-5 elevation-10" color="">
          <v-form ref="formType" v-model="valid" lazy-validation>
            <v-text-field
              v-model="passwordDetails.currentPassword"
              name="input-10-2"
              label="Currrent password"
              :append-icon="e3 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e3 = !e3)"
              :rules="formRules.password"
              :type="e3 ? 'password' : 'text'"
            />

            <v-text-field
              v-model="passwordDetails.newPassword"
              name="input-10-2"
              label="New password"
              :append-icon="e4 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e4 = !e4)"
              :rules="formRules.password"
              :type="e4 ? 'password' : 'text'"
            />

            <v-text-field
              v-model="passwordDetails.verifyPassword"
              name="input-10-2"
              label="Confirm new password"
              :append-icon="e5 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e5 = !e5)"
              :rules="formRules.password"
              :type="e5 ? 'password' : 'text'"
            />

            <v-btn
              color="primary"
              large
              :disabled="!valid"
              @click="resetUserPassword"
            >
              SAVE PASSWORD
            </v-btn>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

</template>

<script>
import { isEmail } from '@/helpers'

export default {
  directives: { },
  components: { },
  validate({ params }) { return true },
  props: { },
  data() {
    return {
      passwordDetails: {
        newPassword: null,
        verifyPassword: null,
        currentPassword: null,
        oldPassword: null
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
          v => !!v || 'Password is required'
        ]
      }

    }
  },
  head() { return {} },
  computed: {
  },
  watch: { },
  created() { },
  mounted() {},
  beforeDestroy() {},
  methods: {

    async resetUserPassword(e) {
      e.preventDefault()
      // console.log('passworDetails',this.passwordDetails);
      await this.$store.dispatch('ActPostPasswordChange', this.passwordDetails)
    }

  },
  beforeCreated() {},
  destroy() {}
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
