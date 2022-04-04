<template>
  <v-container class="text-center" fluid>
    <v-row align="center">
      <v-col md="6" offset-md="3">
        <v-card v-if="showMsg" class="pa-5 ma-5">
          <v-alert type="success" :value="true" outline>
            <p class="display-1">
              {{ $t('msg.info.passwordRecovery.success') }}
            </p>
          </v-alert>
        </v-card>

        <v-card v-else class="pa-5 elevation-10" color="">
          <h1>{{ $t('title.resetPassword') }}</h1>

          <br>
          <p>{{ $t('msg.info.passwordRecovery.message_1') }}</p>
          <p>{{ $t('msg.info.passwordRecovery.message_2') }}</p>

          <div>
            <v-alert v-model="formUtil.formErr" type="error" dismissible>
              {{ formUtil.formErrMsg }}
            </v-alert>
          </div>

          <v-form ref="formType" v-model="valid" lazy-validation>
            <v-text-field
              v-model="form.email"
              label="E-mail"
              :rules="formRules.email"
              required
            />

            <v-btn
              color="primary"
              large
              :disabled="!valid"
              @click="resetPasswordHandle"
            >
              {{ $t('activity.sendEmail') }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
// import VueRecaptcha from 'vue-recaptcha'
import { isEmail } from '@/helpers'

export default {
  directives: {},
  components: {
    // VueRecaptcha
  },
  validate({ params }) {
    return true
  },
  props: {},

  data() {
    return {
      recpatcha: false,
      showMsg: false,

      form: {
        email: ''
      },

      formRules: {
        email: [
          v => !!v || this.$t('msg.error.signUpRules.emailReqd'),
          v => isEmail(v) || this.$t('msg.error.signUpRules.emailInvalid')
        ]
      },
      formUtil: {
        formErr: false,
        formErrMsg: ''
      },

      valid: true,
      e3: false

    }
  },
  head() {
    return {}
  },
  computed: {},
  watch: {},
  created() {
  },
  mounted() {
  },
  beforeDestroy() {
  },
  methods: {

    onNormalVerify() {
      this.recpatcha = true
    },

    async resetPasswordHandle(e) {
      if (this.$refs.formType.validate()) {
        e.preventDefault()
        // await this.$recaptchaLoaded()
        // const recaptchaToken = await this.$recaptcha('login')

        const err = await this.$store.dispatch('users/ActPasswordForgot', { ...this.form })// recaptchaToken});
        if (err) {
          this.formUtil.formErr = true
          this.formUtil.formErrMsg = err.data.msg
        } else {
          this.showMsg = true
        }
      }
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
 * @author Alejandro Moreno <info@pixplix.com>
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
