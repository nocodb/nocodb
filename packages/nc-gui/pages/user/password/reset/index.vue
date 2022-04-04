<template>
  <v-row class="text-center">
    <v-row v-if="resetSuccess" align="center">
      <v-col md="6" offset-md="3">
        <v-card class="pa-5 elevation-10" color="">
          <h1 class="text-center" color="accent">
            RESET PASSWORD
          </h1>
          <br>

          <v-form ref="formType" v-model="valid" lazy-validation>
            <v-text-field
              v-model="passwordDetails.newPassword"
              name="input-10-2"
              label="New password"
              :append-icon="e3 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e3 = !e3)"
              :rules="formRules.password"
              :type="e3 ? 'password' : 'text'"
            />

            <v-text-field
              v-model="passwordDetails.verifyPassword"
              name="input-10-2"
              label="Confirm new password"
              :append-icon="e3 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e3 = !e3)"
              :rules="formRules.password1"
              :type="e3 ? 'password' : 'text'"
            />

            <v-btn
              large
              color="primary"
              @click="resetUserPassword"
            >
              RESET PASSWORD
            </v-btn>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-else>
      <v-alert v-model="alert" type="warning" dismissible>
        <h1 class="title is-2">
          Invalid RESET token - make sure you have opened right reset link
        </h1>
      </v-alert>
    </v-row>
  </v-row>
</template>

<script>
import { isEmail } from '@/helpers'
import passwordValidateMixin from '@/pages/user/authentication/passwordValidateMixin'

export default {
  directives: {},
  components: {},
  mixins: [passwordValidateMixin],
  validate({ params }) {
    // console.log('validate');
    return true
  },
  props: {},
  data() {
    return {
      resetSuccess: true,
      passwordDetails: {
        newPassword: '',
        verifyPassword: null,
        token: null
      },

      formRules: {
        email: [
          v => !!v || 'E-mail is required',
          v => isEmail(v) || 'E-mail must be valid'
        ],
        password: [
          v => (this.PasswordValidate(v)) || this.passwordValidateMsg
        ],
        password1: [
          v => (this.PasswordValidate1(v)) || 'Confirm password should match'
        ]
      },
      passwordProgress: 0,
      passwordValidateMsg: '',
      valid: true,
      e3: true,
      alert: true

    }
  },
  head() {
    // console.log('head');
    return {}
  },
  computed: {},
  watch: {},
  created() {
    // console.log('created');
  },
  async mounted() {
    // console.log('mounted', this.$route.query);
    this.resetSuccess = await this.$store.dispatch('users/ActGetPasswordReset', this.$route.query)
    // this.resetSuccess =  true;
    // console.log('mounted', this.resetSuccess);
  },
  beforeDestroy() {
    // console.log('beforeDestroy');
  },
  methods: {
    async resetUserPassword(e) {
      if (this.$refs.formType.validate()) {
        e.preventDefault()
        this.passwordDetails.token = this.$route.query.token
        // console.log('passworDetails', this.passwordDetails);

        await this.$recaptchaLoaded()
        const recaptchaToken = await this.$recaptcha('login')

        await this.$store.dispatch('users/ActPostPasswordReset', { ...this.passwordDetails, recaptchaToken })
        this.$router.push('/')
      }
    },
    PasswordValidate1(confirmPassword) {
      if (confirmPassword) {
        return this.passwordDetails.newPassword.startsWith(confirmPassword)
      }
      return false
    }
  },
  beforeCreated() {
    // console.log('beforeCreate');
  },
  destroy() {
    // console.log('destroy');
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
