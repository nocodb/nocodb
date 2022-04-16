<template>
  <v-container class="text-center" fluid>
    <v-row align="center">
      <v-col>
        <v-row align="center">
          <v-col md="4" offset-md="4">
            <v-card class="pa-10 elevation-10 mt-10" color="">
              <div
                style="
                  position: absolute;
                  top: -45px;
                  left: -moz-calc(50% - 45px);
                  left: -webkit-calc(50% - 45px);
                  left: calc(50% - 45px);
                  border-radius: 15px;
                "
                class="primary"
              >
                <v-img
                  class="mx-auto"
                  width="90"
                  height="90"
                  :src="require('~/assets/img/icons/512x512-trans.png')"
                />
              </div>
              <!-- SIGN IN -->
              <h1 class="mt-4">
                {{ $t('general.signIn') }}
              </h1>

              <div>
                <v-alert v-model="formUtil.formErr" type="error" dismissible>
                  {{ formUtil.formErrMsg }}
                </v-alert>
              </div>

              <v-form
                v-if="type === 'jwt'"
                ref="formType"
                v-model="valid"
                lazy-validation
              >
                <!-- Enter your work email -->
                <v-text-field
                  v-model="form.email"
                  :label="$t('msg.info.signUp.workEmail')"
                  :rules="formRules.email"
                  required
                />

                <!-- Enter your password -->
                <v-text-field
                  v-model="form.password"
                  name="input-10-2"
                  :label="$t('msg.info.signUp.enterPassword')"
                  min="8"
                  :append-icon="e3 ? 'visibility' : 'visibility_off'"
                  :rules="formRules.password"
                  :type="e3 ? 'password' : 'text'"
                  @keyup.enter="MtdOnSignin"
                  @click:append="() => (e3 = !e3)"
                />
                <!-- Forgot your password -->
                <p class="accent--text text-right caption font-weight-light">
                  <router-link to="/user/password/forgot">
                    {{
                      $t('msg.info.signUp.forgotPassword')
                    }}
                  </router-link>
                </p>

                <!--                <vue-recaptcha @verify="onNormalVerify" sitekey="6LfbcqMUAAAAAAb_2319UdF8m68JHSYVy_m4wPBx"-->
                <!--                               style="transform:scale(0.7);-webkit-transform:scale(0.7);transform-origin:0 0;-webkit-transform-origin:0 0;">-->

                <!--                </vue-recaptcha>-->

                <!--                <v-btn @click="MtdOnSignin" color="primary" large elevation-10 :disabled="(!recpatcha || !valid)">-->
                <!--                  <b>Sign In</b>-->
                <!--                </v-btn>-->

                <v-btn
                  v-t="['login:sign-in']"
                  v-ge="['Sign In', '']"
                  color="primary"
                  large
                  elevation-10
                  :disabled="false"
                  @click="MtdOnSignin"
                >
                  <b>{{ $t('general.signIn') }}</b>
                </v-btn>

                <br>
                <br>
                <br>
                <!-- Don't have an account ? -->
                <p class="caption font-weight-light">
                  {{ $t('msg.info.signUp.dontHaveAccount') }}
                  <!-- Sign Up -->
                  <router-link
                    v-ge="['Don\'t have an account ?', '']"
                    to="/user/authentication/signup"
                  >
                    {{ $t('general.signUp') }}
                  </router-link>
                </p>
                <div>
                  <v-btn
                    v-if="googleAuthEnabled"
                    :href="`${$axios.defaults.baseURL}/auth/google`"
                    outlined
                    large
                    elevation-10
                    block
                    color="blue"
                  >
                    <img
                      :src="require('~/assets/img/gmail.png')"
                      class="img-responsive"
                      alt="google"
                      width="24px"
                    >
                    <b>&nbsp; &nbsp;Sign In with Google</b>
                  </v-btn>
                  <v-btn
                    v-if="githubAuthEnabled"
                    :href="`${$axios.defaults.baseURL}/auth/google`"
                    outlined
                    large
                    elevation-10
                    block
                    color="blue"
                  >
                    <img
                      :src="require('~/assets/img/github.png')"
                      class="img-responsive"
                      alt="github"
                      width="24px"
                    >
                    <b>&nbsp; &nbsp;Sign In with Github</b>
                  </v-btn>

                  <!--                  <v-btn
                                      class="mt-5"
                                      @click="openGithubSiginInBrowser"
                                      outlined large elevation-10 block color="blue"
                                      v-ge="['Sign In with Github','']">
                                      <img src=""~/assets/img/github.png"
                                           class="img-responsive" alt="google"
                                           width="24px">
                                      <b>&nbsp; &nbsp;Sign In with Github</b>
                                    </v-btn>-->
                </div>
              </v-form>
              <!--              <p class="title">-->
              <!--                OR-->
              <!--              </p>-->

              <v-form
                v-else-if="type === 'masterKey'"
                ref="formType1"
                v-model="formUtil.valid1"
                elevation-20
                @submit="MtdOnSignup"
              >
                <v-text-field
                  v-model="form.secret"
                  label="Admin Secret"
                  :rules="formRules.secret"
                  min="8"
                  :append-icon="formUtil.e4 ? 'visibility' : 'visibility_off'"
                  :type="formUtil.e4 ? 'password' : 'text'"
                  required
                  @click:append="() => (formUtil.e4 = !formUtil.e4)"
                />

                <!---->

                <!--                <vue-recaptcha @verify="onNormalVerify" sitekey="6LfbcqMUAAAAAAb_2319UdF8m68JHSYVy_m4wPBx"-->
                <!--                               style="transform:scale(0.7);-webkit-transform:scale(0.7);transform-origin:0 0;-webkit-transform-origin:0 0;">-->

                <!--                </vue-recaptcha>-->

                <v-btn
                  v-ge="['Authenticate', '']"
                  color="primary"
                  class="btn--large"
                  :disabled="!formUtil.recpatcha || !formUtil.valid1"
                  @click="MtdOnSignin"
                >
                  Authenticate&nbsp;
                </v-btn>
              </v-form>

              <template v-else>
                <br>
                <v-alert type="warning" outlined icon="mdi-alert">
                  <!--                <v-icon color="warning">mdi-alert</v-icon>-->
                  Authentication not configured in configuration
                </v-alert>
              </template>
            </v-card>
          </v-col>
        </v-row>

        <br>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

// const {shell} = require("electron").remote.require(
//   "./libs"
// );
import { isEmail } from '@/helpers'
// import VueRecaptcha from 'vue-recaptcha';

export default {
  components: {
    // VueRecaptcha
  },
  directives: {},
  layout: 'empty',
  validate({ params }) {
    return true
  },
  props: {},

  data() {
    return {
      form: {
        email: null,
        password: null
      },

      formRules: {
        email: [
          // E-mail is required
          v => !!v || this.$t('msg.error.signUpRules.emailReqd'),
          // E-mail must be valid
          v => isEmail(v) ||
            this.$t('msg.error.signUpRules.emailInvalid')
        ],
        password: [
          // Password is required
          v => !!v || this.$t('msg.error.signUpRules.passwdRequired'),
          // You password must be atleast 8 characters
          v =>
            (v && v.length >= 8) || this.$t('msg.error.signUpRules.passwdLength')
        ]
      },
      formUtil: {
        formErr: false,
        formErrMsg: '',
        valid: false,
        recpatcha: true,
        e3: true,
        passwordProgress: 0,
        progressColorValue: 'red'
      },

      valid: false,
      e3: true,
      recpatcha: false
    }
  },
  head() {
    return {
      title: this.$t('title.headLogin'),
      meta: [
        {
          hid: this.$t('msg.info.loginMsg'),
          name: this.$t('msg.info.loginMsg'),
          content: this.$t('msg.info.loginMsg')
        }
      ]
    }
  },
  computed: {
    counter() {
      return this.$store.getters['users/GtrCounter']
    },
    displayName() {
      return this.$store.getters['users/GtrUser']
    },
    type() {
      return 'jwt'
      // return (
      //   this.$store.state.project.projectInfo &&
      //   this.$store.state.project.projectInfo.authType
      // )
    },
    googleAuthEnabled() {
      return (
        this.$store.state.project.projectInfo &&
        this.$store.state.project.projectInfo.googleAuthEnabled
      )
    },
    githubAuthEnabled() {
      return (
        this.$store.state.project.projectInfo &&
        this.$store.state.project.projectInfo.githubAuthEnabled
      )
    }
  },
  watch: {},
  async created() {
    // this.type = (await this.$store.dispatch('users/ActGetAuthType')).type;
    if (this.$route.query && this.$route.query.error) {
      this.$nextTick(() =>
        this.$toast.error(this.$route.query.error).goAway(5000)
      )
      this.$router.replace({ path: '/user/authentication/signin' })
    }
  },
  mounted() {
  },
  beforeDestroy() {
  },
  methods: {
    openGoogleSiginInBrowser(e) {
      e.preventDefault()
      // shell.openExternal(process.env.auth.google.url)
    },
    openGithubSiginInBrowser(e) {
      e.preventDefault()
      // shell.openExternal(process.env.auth.github.url)
    },

    onNormalVerify() {
      this.recpatcha = true
    },

    PlusCounter() {
      this.$store.dispatch('ActPlusCounter')
    },

    async MtdOnSignin(e) {
      e.preventDefault()
      if (this.type === 'jwt') {
        if (this.$refs.formType.validate()) {
          let err = null
          this.form.firstName = this.form.email
          this.form.lastName = this.form.email

          err = await this.$store.dispatch('users/ActSignIn', { ...this.form })
          if (err) {
            this.formUtil.formErr = true
            this.formUtil.formErrMsg = err.data.msg
            return
          }
        }
      } else if (this.type === 'masterKey') {
        const valid = await this.$store.dispatch(
          'users/ActVerifyMasterKey',
          this.form.secret
        )
        if (!valid) {
          this.formUtil.formErr = true
          this.formUtil.formErrMsg = 'Invalid admin secret'
          return
        }
        this.$store.commit('users/MutMasterKey', this.form.secret)
      }

      if ('redirect_to' in this.$route.query) {
        this.$router.push(this.$route.query.redirect_to)
      } else {
        this.$router.push('/projects')
      }
    },

    MtdOnSigninGoogle(e) {
      // e.preventDefault();
      this.$store.dispatch('users/ActAuthGoogle')
    },

    MtdOnReset() {
      // console.log('in method reset');
    }
  },
  beforeCreated() {
  },
  destroy() {
  }
}
</script>

<style scoped></style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
