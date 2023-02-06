export default `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB - Verify Email</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">
    <link href="/css/fonts.roboto.css" rel="stylesheet">
    <link href="/css/materialdesignicons.5.x.min.css" rel="stylesheet">
    <link href="/css/vuetify.2.x.min.css" rel="stylesheet">
    <script src="/js/vue.2.6.14.min.js"></script>
</head>
<body>
<div id="app">
    <v-app>
    <v-container>
        <v-row class="justify-center">
            <v-col class="col-12 col-md-6">
                <v-alert v-if="valid" type="success">
                    Email verified successfully!
                </v-alert>
                <v-alert v-else-if="errMsg" type="error">
                    {{errMsg}}
                </v-alert>

                <template v-else>

                    <v-skeleton-loader type="heading"></v-skeleton-loader>

                </template>
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
      errMsg: null,
      validForm: false,
      token: <%- token %>,
      greeting: 'Password Reset',
      formdata: {
        password: '',
        newPassword: ''
      },
      success: false
    },
    methods: {},
    async created() {
      try {
        const valid = (await axios.post('<%- baseUrl %>/api/v1/auth/email/validate/' + this.token)).data;
        this.valid = !!valid;
      } catch (e) {
        this.valid = false;
        if(e.response && e.response.data && e.response.data.msg){
          this.errMsg = e.response.data.msg;
        }else{
          this.errMsg = 'Some error occurred';
        }
      }
    }
  })
</script>
</body>
</html>`;
