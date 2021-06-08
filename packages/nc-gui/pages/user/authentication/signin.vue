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
                >
                </v-img>
              </div>
              <!-- SIGN IN -->
              <h1 class="mt-4">{{ $t('signin.title') }}</h1>

              <div>
                <v-alert type="error" dismissible v-model="formUtil.formErr">
                  {{ formUtil.formErrMsg }}
                </v-alert>
              </div>

              <v-form
                v-if="type === 'jwt'"
                v-model="valid"
                ref="formType"
                lazy-validation
              >
                <!-- Enter your work email -->
                <v-text-field
                  v-bind:label="$t('signin.input_1')"
                  v-model="form.email"
                  :rules="formRules.email"
                  required
                >
                </v-text-field>

                <!-- Enter your password -->
                <v-text-field
                  name="input-10-2"
                  v-bind:label="$t('signin.input_2')"
                  min="8"
                  :append-icon="e3 ? 'visibility' : 'visibility_off'"
                  @click:append="() => (e3 = !e3)"
                  v-model="form.password"
                  :rules="formRules.password"
                  :type="e3 ? 'password' : 'text'"
                >
                </v-text-field>
                <!-- Forgot your password -->
                <p class="accent--text text-right caption font-weight-light">
                  <router-link to="/user/password/forgot">{{
                    $t('signin.forget_password')
                  }}</router-link>
                </p>

                <!--                <vue-recaptcha @verify="onNormalVerify" sitekey="6LfbcqMUAAAAAAb_2319UdF8m68JHSYVy_m4wPBx"-->
                <!--                               style="transform:scale(0.7);-webkit-transform:scale(0.7);transform-origin:0 0;-webkit-transform-origin:0 0;">-->

                <!--                </vue-recaptcha>-->

                <!--                <v-btn @click="MtdOnSignin" color="primary" large elevation-10 :disabled="(!recpatcha || !valid)">-->
                <!--                  <b>Sign In</b>-->
                <!--                </v-btn>-->

                <v-btn
                  @click="MtdOnSignin"
                  color="primary"
                  large
                  elevation-10
                  :disabled="false"
                  v-ge="['Sign In', '']"
                >
                  <b>Sign In</b>
                </v-btn>

                <br />
                <br />
                <br />
                <!-- Don't have an account ? -->
                <p class="caption font-weight-light">
                  {{ $t('signin.footer_text_1') }}
                  <!-- Sign Up -->
                  <router-link
                    to="/user/authentication/signup"
                    v-ge="['Don\'t have an account ?', '']"
                  >
                    {{ $t('signin.footer_text_2') }}
                  </router-link>
                </p>
                <div>
                  <v-btn
                    v-if="googleAuthEnabled"
                    :href="
                      _isDev
                        ? 'http://localhost:8080/auth/google'
                        : '../auth/google'
                    "
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
                    />
                    <b>&nbsp; &nbsp;Sign In with Google</b>
                  </v-btn>
                  <v-btn
                    v-if="githubAuthEnabled"
                    :href="
                      _isDev
                        ? 'http://localhost:8080/auth/github'
                        : '../auth/github'
                    "
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
                    />
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
                v-model="formUtil.valid1"
                ref="formType1"
                @submit="MtdOnSignup"
                elevation-20
              >
                <v-text-field
                  label="Admin Secret"
                  v-model="form.secret"
                  :rules="formRules.secret"
                  min="8"
                  :append-icon="formUtil.e4 ? 'visibility' : 'visibility_off'"
                  @click:append="() => (formUtil.e4 = !formUtil.e4)"
                  :type="formUtil.e4 ? 'password' : 'text'"
                  required
                >
                </v-text-field>

                <!---->

                <!--                <vue-recaptcha @verify="onNormalVerify" sitekey="6LfbcqMUAAAAAAb_2319UdF8m68JHSYVy_m4wPBx"-->
                <!--                               style="transform:scale(0.7);-webkit-transform:scale(0.7);transform-origin:0 0;-webkit-transform-origin:0 0;">-->

                <!--                </vue-recaptcha>-->

                <v-btn
                  @click="MtdOnSignin"
                  color="primary"
                  class="btn--large"
                  :disabled="!formUtil.recpatcha || !formUtil.valid1"
                  v-ge="['Authenticate', '']"
                >
                  Authenticate&nbsp;
                </v-btn>
              </v-form>

              <template v-else>
                <br />
                <v-alert type="warning" outlined icon="mdi-alert">
                  <!--                <v-icon color="warning">mdi-alert</v-icon>-->
                  Authentication not configured in configuration
                </v-alert>
              </template>
            </v-card>
          </v-col>
        </v-row>

        <br />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import Vue from 'vue';

// const {shell} = require("electron").remote.require(
//   "./libs"
// );
import { mapGetters, mapActions } from 'vuex';
import { VueReCaptcha } from 'vue-recaptcha-v3';
// import VueRecaptcha from 'vue-recaptcha';

export default {
  layout: 'empty',
  components: {
    // VueRecaptcha
  },

  data() {
    return {
      form: {
        email: null,
        password: null,
      },

      formRules: {
        email: [
          // E-mail is required
          (v) => !!v || this.$t('signin.form.rules.email_1'),
          // E-mail must be valid
          (v) =>
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) ||
            this.$t('signin.form.rules.email_2'),
        ],
        password: [
          // Password is required
          (v) => !!v || this.$t('signin.form.rules.password_1'),
          // You password must be atleast 8 characters
          (v) =>
            (v && v.length >= 8) || this.$t('signin.form.rules.password_2'),
        ],
      },
      formUtil: {
        formErr: false,
        formErrMsg: '',
        valid: false,
        recpatcha: true,
        e3: true,
        passwordProgress: 0,
        progressColorValue: 'red',
      },

      valid: false,
      e3: true,
      recpatcha: false,
    };
  },
  methods: {
    openGoogleSiginInBrowser(e) {
      e.preventDefault();
      shell.openExternal(process.env.auth.google.url);
    },
    openGithubSiginInBrowser(e) {
      e.preventDefault();
      shell.openExternal(process.env.auth.github.url);
    },

    onNormalVerify() {
      this.recpatcha = true;
    },

    PlusCounter() {
      this.$store.dispatch('ActPlusCounter');
    },

    async MtdOnSignin(e) {
      e.preventDefault();
      if (this.type === 'jwt') {
        if (this.$refs.formType.validate()) {
          let err = null;
          //this.$nuxt.$loading.start()
          this.form.firstName = this.form.email;
          this.form.lastName = this.form.email;
          console.log(process.env.xgene);

          // await this.$recaptchaLoaded()
          // const recaptchaToken = await this.$recaptcha('login')

          err = await this.$store.dispatch('users/ActSignIn', { ...this.form }); //, recaptchaToken});
          if (err) {
            this.formUtil.formErr = true;
            this.formUtil.formErrMsg = err.data.msg;
            return;
          }
          //this.$nuxt.$loading.finish()
        }
      } else if (this.type === 'masterKey') {
        const valid = await this.$store.dispatch(
          'users/ActVerifyMasterKey',
          this.form.secret
        );
        if (!valid) {
          this.formUtil.formErr = true;
          this.formUtil.formErrMsg = 'Invalid admin secret';
          return;
        }
        this.$store.commit('users/MutMasterKey', this.form.secret);
      }

      if ('redirect_to' in this.$route.query) {
        this.$router.push(this.$route.query.redirect_to);
      } else {
        this.$router.push('/projects');
      }
    },

    MtdOnSigninGoogle(e) {
      //e.preventDefault();
      this.$store.dispatch('users/ActAuthGoogle');
    },

    MtdOnReset() {
      //console.log('in method reset');
    },
  },
  computed: {
    counter() {
      return this.$store.getters['users/GtrCounter'];
    },
    displayName() {
      return this.$store.getters['users/GtrUser'];
    },
    type() {
      return (
        this.$store.state.project.projectInfo &&
        this.$store.state.project.projectInfo.authType
      );
    },
    googleAuthEnabled() {
      return (
        this.$store.state.project.projectInfo &&
        this.$store.state.project.projectInfo.googleAuthEnabled
      );
    },
    githubAuthEnabled() {
      return (
        this.$store.state.project.projectInfo &&
        this.$store.state.project.projectInfo.githubAuthEnabled
      );
    },
  },
  beforeCreated() {},
  async created() {
    // this.type = (await this.$store.dispatch('users/ActGetAuthType')).type;
    if (this.$route.query && this.$route.query.error) {
      this.$nextTick(() =>
        this.$toast.error(this.$route.query.error).goAway(5000)
      );
      this.$router.replace({ path: '/user/authentication/signin' });
    }
  },
  mounted() {},
  beforeDestroy() {},
  destroy() {},
  validate({ params }) {
    return true;
  },
  head() {
    return {
      title: this.$t('signin.head.title'),
      meta: [
        {
          hid: this.$t('signin.head.meta.hid'),
          name: this.$t('signin.head.meta.name'),
          content: this.$t('signin.head.meta.content'),
        },
      ],
    };
  },
  props: {},
  watch: {},
  directives: {},
};
</script>

<style scoped></style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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