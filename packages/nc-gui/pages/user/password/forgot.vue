<template>
  <v-container class="text-center" fluid>
    <v-row align="center">
      <v-col md="6" offset-md="3">

        <v-card v-if="showMsg" class="pa-5 ma-5">

          <v-alert type="success" :value="true" outline>
            <p class="display-1">
              Please check your email to reset the password
            </p>
          </v-alert>
        </v-card>

        <v-card class="pa-5 elevation-10" color="" v-else>

          <h1>Reset your password</h1>


          <br>
          <p>Please provide the email address you used when you signed up.</p>
          <p>We will send you an email with a link to reset your password.</p>


          <div>
            <v-alert type="error" dismissible v-model="formUtil.formErr">
              {{formUtil.formErrMsg}}
            </v-alert>
          </div>


          <v-form v-model="valid" ref="formType" lazy-validation>

            <v-text-field
              label="E-mail"
              v-model="form.email"
              :rules="formRules.email"
              required
            ></v-text-field>

<!--            <vue-recaptcha @verify="onNormalVerify" sitekey="6LfbcqMUAAAAAAb_2319UdF8m68JHSYVy_m4wPBx"-->
<!--                           style="transform:scale(0.7);-webkit-transform:scale(0.7);transform-origin:0 0;-webkit-transform-origin:0 0;">-->

<!--            </vue-recaptcha>-->


            <v-btn
              @click="resetPasswordHandle"
              color="primary"
              large
              :disabled="!valid"
            >
              SEND EMAIL
            </v-btn>

          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

</template>

<script>
  import VueRecaptcha from 'vue-recaptcha';
  import {isEmail} from "@/helpers";

  export default {

    data() {
      return {
        recpatcha: false,
        showMsg: false,

        form: {
          email: '',
        },

        formRules: {
          email: [
            v => !!v || 'E-mail is required',
            v => isEmail(v) || 'E-mail must be valid'
          ],
        },
        formUtil: {
          formErr: false,
          formErrMsg: ''
        },

        valid: true,
        e3: false,

      }
    },
    computed: {},
    methods: {

      onNormalVerify() {
        this.recpatcha = true;
      },


      async resetPasswordHandle(e) {
        if (this.$refs.formType.validate()) {
          e.preventDefault();
          // await this.$recaptchaLoaded()
          // const recaptchaToken = await this.$recaptcha('login')

          let err = await this.$store.dispatch('users/ActPasswordForgot', {...this.form,});// recaptchaToken});
          if (err) {
            this.formUtil.formErr = true;
            this.formUtil.formErrMsg = err.data.msg;
          } else {
            this.showMsg = true;
          }
        }
      }

    },
    beforeCreated() {
    },
    created() {
    },
    mounted() {
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
    components: {VueRecaptcha},
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
