export default `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB - Sign Up</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">
    <link href="/css/fonts.roboto.css" rel="stylesheet">
    <link href="/css/materialdesignicons.5.x.min.css" rel="stylesheet">
    <link href="/css/vuetify.2.x.min.css" rel="stylesheet">
    <script src="/js/vue.global.js"></script>
</head>
<body>
<div id="app">
    <v-app>
        <v-container>
            <v-row class="justify-center">
                <v-col class="col-12 col-md-6">
                    <v-form ref="form" v-model="validForm" ref="formType" class="ma-auto"
                            lazy-validation>


                        <v-text-field
                                name="input-10-2"
                                label="First Name"
                                type="text"
                                v-model="formdata.firstname"
                                :rules="[v => !!v ||  'First Name is required']"
                        ></v-text-field>

                        <v-text-field
                                name="input-10-2"
                                label="Last Name"
                                type="text"
                                v-model="formdata.lastname"
                                :rules="[v => !!v ||  'Last Name is required']"
                        ></v-text-field>

                        <v-text-field
                                name="input-10-2"
                                label="email"
                                type="email"
                                v-model="formdata.email"
                                :rules="[v => !!v ||  'Email is required']"
                        ></v-text-field>

                        <v-text-field
                                name="input-10-2"
                                type="password"
                                label="Password"
                                v-model="formdata.password"
                                :rules="[v => !!v ||  'Password is required']"
                        ></v-text-field>

                        <v-btn
                                :disabled="!validForm"
                                large
                                @click="signin"
                        >
                            Sign Up
                        </v-btn>

                    </v-form>

                    <br>
                    <pre style="overflow: auto" v-if="success" v-html="success"></pre>
                    <v-alert v-else-if="errMsg" type="error">
                        {{errMsg}}
                    </v-alert>


                </v-col>
            </v-row>
        </v-container>
    </v-app>
</div>
<script src="/js/vuetify.2.x.min.js"></script>
<script src="/js/axios.0.19.2.min.js"></script>

<script>
  var app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
      valid: null,
      validForm: false,
      greeting: 'Password Reset',
      formdata: {
        password: '',
        newPassword: ''
      },
      success: false,
      errMsg: null
    },
    methods: {
      async signin() {
        if (this.$refs.form.validate()) {
          try {
            const res = await axios.post('<%- baseUrl %>auth/signup', this.formdata);
            this.success = res.data;
          } catch (e) {
            if (e.response && e.response.data && e.response.data.msg) {
              this.errMsg = e.response.data.msg;
            } else {
              this.errMsg = 'Some error occurred';
            }
          }
        }
      }
    }
  })
</script>
</body>
</html>`;
