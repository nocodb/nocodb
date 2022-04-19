<template>
  <v-container class="text-center" fluid>
    <v-row class="fluid" align="center">
      <v-col class="align-center">
        <v-row align="center">
          <v-col md="4" offset-md="4">
            <v-card class="pa-10 elevation-10 mt-10" color="">
              <div
                style="position: absolute;top:-45px;
                  left:-moz-calc(50% - 45px);
                  left:-webkit-calc(50% - 45px);
                  left:calc(50% - 45px);
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

              <h1 class="mt-4">
                {{ $t('general.signUp') }}
                {{ $route.query.redirect_to === '/referral' ? '& REFER' : '' }}
                {{ $route.query.redirect_to === '/pricing' ? '& BUY' : '' }}
              </h1>
              <div>
                <v-alert v-model="formUtil.formErr" type="error" dismissible>
                  {{ formUtil.formErrMsg }}
                </v-alert>
              </div>
              <v-form v-if=" type === 'jwt'" ref="formType" v-model="formUtil.valid" elevation-20 @submit="MtdOnSignup">
                <p v-if="firstUser" class="success--text">
                  <!-- You will be the 'Super Admin' -->
                  {{ $t('msg.info.signUp.superAdmin') }}
                </p>

                <v-text-field
                  v-model="form.email"
                  :label="$t('msg.info.signUp.workEmail')"
                  :rules="formRules.email"
                  required
                />

                <v-text-field
                  v-model="form.password"
                  name="input-10-2"
                  :label="$t('msg.info.signUp.enterPassword')"
                  min="8"
                  :append-icon="formUtil.e3 ? 'visibility' : 'visibility_off'"
                  :rules="formRules.password"
                  :type="formUtil.e3 ? 'password' : 'text'"
                  required
                  @click:append="() => (formUtil.e3 = !formUtil.e3)"
                >
                  <template #progress />
                </v-text-field>

                <v-btn
                  v-ge="['Sign Up ','']"
                  color="primary"
                  class="btn--large"
                  :disabled="!formUtil.recpatcha || !formUtil.valid"
                  @click="MtdOnSignup"
                >
                  &nbsp; {{ $t('general.signUp') }} &nbsp;
                  <v-progress-circular
                    class="pb-3 pt-0 mt-0"
                    :value="formUtil.passwordProgress"
                    width="2"
                    size="18"
                    small
                    color="success"
                  />
                </v-btn>

                <br>
                <br>
                <div class="d-flex align-center justify-center mb-2">
                  <v-switch v-model="subscribe" dense hide-details class="mt-0  pt-0" />
                  <label class="caption font-weight-light">Subscribe to our weekly newsletter</label>
                </div>
                <p v-ge="['Already have an account ?','']" class="font-weight-light caption">
                  {{ $t('msg.info.signUp.alreadyHaveAccount') }}
                  <router-link to="/user/authentication/signin">
                    {{ $t('general.signIn') }}
                  </router-link>
                </p>

                <v-btn

                  v-if="googleAuthEnabled"
                  :href="`${$axios.defaults.baseURL}/auth/google?state=${token}`"
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
              </v-form>
              <!--              <p class="title">-->
              <!--                OR-->
              <!--              </p>-->

              <v-form
                v-else-if=" type === 'masterKey'"
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
                  v-ge="['Authenticate','']"
                  color="primary"
                  class="btn--large"
                  :disabled="!formUtil.recpatcha || !formUtil.valid1"
                  @click="MtdOnSignup"
                >
                  Authenticate&nbsp;
                </v-btn>

                <br>

                <!--              <div>-->

                <!--                <v-btn

                  v-if="googleAuthEnabled"
                  :href="`${$axios.defaults.baseURL}/auth/google?state=${token}`" outlined
                  large elevation-10
                  block
                  color="blue">
                  <img :src="require('~/assets/img/gmail.png')"
                       class="img-responsive" alt="google"
                       width="24px">
                  <b>&nbsp; &nbsp;Sign In with Google</b>
                </v-btn>-->
                <!--                <v-btn
                                  class="mt-5"
                                  @click="openGithubSiginInBrowser"
                                  outlined large elevation-10 block color="blue"
                                  v-ge="['Sign In with Github','']">
                                  <img src="github.png"
                                       class="img-responsive" alt="google"
                                       width="24px">
                                  <b>&nbsp; &nbsp;Sign In with Github</b>
                                </v-btn>-->

                <!--              </div>-->
              </v-form>
              <template v-else-if="type==='none'">
                <br>
                <v-alert type="warning" outlined icon="mdi-alert">
                  <!--                <v-icon color="warning">mdi-alert</v-icon>-->
                  Authentication not configured in configuration
                </v-alert>
              </template>
            </v-card>

            <br>

            <v-row justify="center">
              <p class="text-right grey--text font-weight-light caption">
                By signing up, you agree to
                <span class="grey--text pointer" @click="openUrl('https://nocodb.com/policy-nocodb')"><u>Terms of service</u></span>
              </p> &nbsp;

              <!--              <div class="d-flex align-center mb-4 justify-center">
                <v-checkbox v-model="subscribe" color="grey" dense hide-details class="mt-0  pt-0" />
                <label class="caption grey&#45;&#45;text font-weight-light">Subscribe to our weekly newsletter</label>
              </div>-->
            </v-row>

            <!--<br>-->
            <!--<h3>OR</h3>-->
            <!--<br>-->

            <!--<v-card class="pa-3 elevation-10" color="">-->
            <!--<p>or sign up with one of these services</p>-->
            <!--<a href="/api/auth/google?redirect_to=/"><img src="/btn_google_signin_dark_normal_web@2x.png"-->
            <!--class="img-responsive" alt="google" wifth="128px"></a>-->
            <!--&lt;!&ndash;<br>&ndash;&gt;-->
            <!--&lt;!&ndash;<a href="/api/auth/facebook?redirect_to=/"><img src="/facebook.png" class="img-responsive" alt="facebook"></a>&ndash;&gt;-->
            <!--</v-card>-->
            <!--<br>-->
            <!--<br>-->
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

// const {shell} = require("electron").remote.require(
//   "./libs"
// );
import { isEmail } from '@/helpers'
import passwordValidateMixin from '@/pages/user/authentication/passwordValidateMixin'
// import VueRecaptcha from 'vue-recaptcha';

export default {
  components: {
    // VueRecaptcha
  },
  directives: {},
  mixins: [passwordValidateMixin],
  layout: 'empty',
  validate() {
    return true
  },
  props: {},

  data() {
    return {
      subscribe: false,
      isDev: (process.env.NODE_ENV === 'dev'),

      dialog: false,
      form: {
        email: null,
        password: null
      },

      formRules: {
        email: [
          v => !!v || 'E-mail is required',
          v => isEmail(v) || 'E-mail must be valid'
        ],
        password: [
          v => (this.PasswordValidate(v)) || this.passwordValidateMsg
        ],
        secret: [
          v => !!v || 'Required'
        ]
      },
      formUtil: {
        formErr: false,
        formErrMsg: '',
        valid: false,
        valid1: false,
        recpatcha: true,
        e3: true,
        e4: true,
        passwordProgress: 0,
        progressColorValue: 'red'
      },

      googleAuthUrl: '/api/auth/google',
      facebookAuthUrl: '/api/auth/facebook'
    }
  },
  head() {
    return {
      title: 'Sign Up | Noco',
      meta: [
        { hid: 'Sign Up To Noco', name: 'Sign Up To Noco', content: 'Sign Up To Noco' }
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
      return this.$store.state.project.projectInfo && this.$store.state.project.projectInfo.authType
    },
    firstUser() {
      return this.$store.state.project.projectInfo && this.$store.state.project.projectInfo.firstUser
    },
    googleAuthEnabled() {
      return this.$store.state.project.projectInfo && this.$store.state.project.projectInfo.googleAuthEnabled
    },
    token() {
      return this.$route.params.token
    }
  },
  watch: {},
  async created() {

    // const type = await this.$store.dispatch('users/ActGetAuthType');
    // this.type = type.type;
    // this.firstUser = type.firstUser;
    // let ckeditor = document.createElement('script');
    // ckeditor.setAttribute('src',"https://www.google.com/recaptcha/api.js");
    // document.head.appendChild(ckeditor);
  },
  mounted() {
    // console.log(this.$route.query);

    if ('buy' in this.$route.query) {
      this.googleAuthUrl += '?redirect_to=/'
      this.facebookAuthUrl += '?redirect_to=/'
    } else {
      this.googleAuthUrl += '?redirect_to=/'
      this.facebookAuthUrl += '?redirect_to=/'
    }
  },
  beforeDestroy() {
  },
  methods: {
    openUrl(url) {
      window.open(url, '_blank')
    },
    openGoogleSiginInBrowser(e) {
      e.preventDefault()
    },
    openGithubSiginInBrowser(e) {
      e.preventDefault()
      // shell.openExternal(process.env.auth.github.url)
    },
    onNormalVerify() {
      this.formUtil.recpatcha = true
      // this.formUtil.recpatcha = false;
    },

    progressColor(num) {
      this.formUtil.progressColorValue = ['error', 'warning', 'info', 'success'][Math.floor(num / 25)]
      return this.formUtil.progressColorValue
    },

    /*  PasswordValidate(p) {
      if (!p) {
        this.passwordProgress = 0
        this.passwordValidateMsg = 'Atleast 8 letters with one Uppercase, one number and one special letter'
        return false
      }

      let msg = ''
      let validation = true
      let progress = 0

      if (!(p.length >= 8)) {
        msg += 'Atleast 8 letters. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      if (!(p.match(/.*[A-Z].*!/))) {
        msg += 'One Uppercase Letter. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      if (!(p.match(/.*[0-9].*!/))) {
        msg += 'One Number. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      if (!(p.match(/[$&+,:;=?@#|'<>.^*()%!-]/))) {
        msg += 'One special letter. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      this.formUtil.passwordProgress = progress
      // console.log('progress', progress);
      // console.log('color', this.progressColor(this.formUtil.passwordProgress));
      this.progressColorValue = this.progressColor(this.formUtil.passwordProgress)

      this.formUtil.passwordValidateMsg = msg

      // console.log('msg', msg, validation);

      return validation
    }, */

    PlusCounter() {
      this.$store.dispatch('ActPlusCounter')
    },

    async MtdOnSignup(e) {
      e.preventDefault()
      if (this.type === 'jwt') {
        if (this.$refs.formType.validate()) {
          // this.$nuxt.$loading.start()
          // console.log('hello', this.form);
          this.form.firstName = this.form.username
          this.form.lastName = this.form.username
          //
          // await this.$recaptchaLoaded()
          // const recaptchaToken = await this.$recaptcha('login')
          const err = await this.$store.dispatch('users/ActSignUp', {
            ...this.form,
            token: this.$route.params.token,
            ignore_subscribe: !this.subscribe
          })// recaptchaToken});

          // console.log('in method signup', err);

          await this.$store.dispatch('project/ActLoadProjectInfo')

          if (err) {
            this.formUtil.formErr = true
            this.formUtil.formErrMsg = err.data.msg
            return
          }

          // this.$nuxt.$loading.finish()
        }
      } else if (this.type === 'masterKey') {
        const valid = await this.$store.dispatch('users/ActVerifyMasterKey', this.form.secret)
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
        this.$router.push('/projects?toast')
      }
    },

    MtdOnReset() {
      // console.log('in method reset');
    },

    async MtdOnSignupGoogle(e) {
      await this.$store.dispatch('users/ActAuthGoogle')
      // console.log('MtdOnSignupGoogle', err);
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
