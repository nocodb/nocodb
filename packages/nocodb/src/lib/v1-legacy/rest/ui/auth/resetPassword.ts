export default `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB - Reset Password</title>
    <link href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@mdi/font@5.x/css/materialdesignicons.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.min.css" rel="stylesheet">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">

    <script src="https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.14/vue.min.js" integrity="sha512-XdUZ5nrNkVySQBnnM5vzDqHai823Spoq1W3pJoQwomQja+o4Nw0Ew1ppxo5bhF2vMug6sfibhKWcNJsG8Vj9tg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
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
<script src="https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/axios/0.19.2/axios.min.js"></script>

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
            const res = await axios.post('<%- baseUrl %>auth/password/reset/' + this.token, {
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
        const valid = (await axios.post('<%- baseUrl %>auth/token/validate/' + this.token)).data;
        this.valid = !!valid;
      } catch (e) {
        this.valid = false;
      }
    }
  })
</script>
</body>
</html>`;
