export default `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB - Reset Password</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">
    <link href="<%- ncPublicUrl %>/css/fonts.roboto.css" rel="stylesheet">
    <link href="<%- ncPublicUrl %>/css/materialdesignicons.5.x.min.css" rel="stylesheet">
    <link href="<%- ncPublicUrl %>/css/vuetify.2.x.min.css" rel="stylesheet">
    <script src="<%- ncPublicUrl %>/js/vue.2.6.14.min.js"></script>
</head>
<body>
<div id="app">
    <v-app>
        <v-container>
            <v-row class="justify-center">
                <v-col class="col-12 col-md-6">
                    <v-alert v-if="success" type="success">
                        Password reset successful!
                    </v-alert>
                    <template v-else>

                        <v-form ref="form" v-model="validForm" v-if="valid === true" ref="formType" class="ma-auto"
                                lazy-validation>


                            <v-text-field
                                    name="input-10-2"
                                    label="New password"
                                    type="password"
                                    v-model="formdata.password"
                                    :rules="[v => !!v ||  'Password is required']"
                            ></v-text-field>

                            <v-text-field
                                    name="input-10-2"
                                    type="password"
                                    label="Confirm new password"
                                    v-model="formdata.newPassword"
                                    :rules="[v => !!v ||  'Password is required', v =>  v === formdata.password  || 'Password mismatch']"
                            ></v-text-field>

                            <v-btn
                                    :disabled="!validForm"
                                    large
                                    @click="resetPassword"
                            >
                                RESET PASSWORD
                            </v-btn>

                        </v-form>
                        <div v-else-if="valid === false">Not a valid url</div>
                        <div v-else>
                            <v-skeleton-loader type="actions"></v-skeleton-loader>
                        </div>
                    </template>
                </v-col>
            </v-row>
        </v-container>
    </v-app>
</div>
<script src="<%- ncPublicUrl %>/js/vuetify.2.x.min.js"></script>
<script src="<%- ncPublicUrl %>/js/axios.0.19.2.min.js"></script>

<script>
  var app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
      valid: null,
      validForm: false,
      token: <%- token %>,
      greeting: 'Password Reset',
      formdata: {
        password: '',
        newPassword: ''
      },
      success: false
    },
    methods: {
      async resetPassword() {
        if (this.$refs.form.validate()) {
          try {
            const res = await axios.post('<%- baseUrl %>api/v1/db/auth/password/reset/' + this.token, {
              ...this.formdata
            });
            this.success = true;
          } catch (e) {
            if (e.response && e.response.data && e.response.data.msg) {
              alert('Failed to reset password: ' + e.response.data.msg)
            } else {
              alert('Some error occurred')
            }
          }
        }
      }
    },
    async created() {
      try {
        const valid = (await axios.post('<%- baseUrl %>api/v1/db/auth/token/validate/' + this.token)).data;
        this.valid = !!valid;
      } catch (e) {
        this.valid = false;
      }
    }
  })
</script>
</body>
</html>`;
