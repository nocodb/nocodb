import { mapGetters } from 'vuex'

export default {
  data() {
    return {
      isHydrated: false,
      drawer: null

    }
  },
  computed: {
    dashboardUrl() {
      return `${location.origin}${location.pathname || ''}`
    },
    isDark() {
      return this.$vuetify && this.$vuetify.theme && this.$vuetify.theme.dark
    },
    isLight() {
      return this.$vuetify && this.$vuetify.theme && this.$vuetify.theme.light
    },
    isThisMobile() { // just an example, could be one specific value if that's all you need
      return this.isHydrated ? this.$vuetify && this.$vuetify.breakpoint && this.$vuetify.breakpoint.smAndDown : false
    },

    isTool() {
      return process.env && process.env.tool
    },
    isDashboard() {
      return this.$route &&
        this.$route.path &&
        (this.$route.path === '/nc' || this.$route.path === '/nc/' || this.$route.path.startsWith('/nc/'))
    },

    _meta() {
      return this._isMac ? '⌘' : '^'
    },
    _isMac() {
      return process.platform === 'darwin'
    },
    _isWindows() {
      return process.platform === 'win32'
    },
    _isDev() {
      return process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase().startsWith('dev')
    },
    _isEE() {
      return process.env.EE
    },
    _isZh() {
      const zhLan = ['zh', 'zh-cn', 'zh-hk', 'zh-mo', 'zh-sg', 'zh-tw']
      const browserLan = (navigator.languages || [navigator.language || navigator.userLanguage || 'en']).map(v => v.toLowerCase())
      return zhLan.some(l => browserLan.includes(l))
    },
    ...mapGetters({
      _isUIAllowed: 'users/GtrIsUIAllowed'
    })
  },
  mounted() {
    // this.isHydrated = true
    // if (!this.$vuetify.breakpoint.smAndDown) {
    //   //console.log('setting drawer to false');
    //   this.drawer = true;
    // } else {
    //   //console.log('setting drawer to false');
    //   this.drawer = false;
    // }
    // console.log('this.items', this.$store.getters.GtrPaidUser);
    // this.items[1].show = !this.$store.getters.GtrPaidUser;
  },
  // methods: {
  //   _isUIAllowed(page) {
  //     const user = this.$store.state.users.user;
  //     let roles = user && user.roles;
  //
  //     if (this.$store.state.users.previewAs) {
  //       roles = {
  //         [this.$store.state.users.previewAs]: true
  //       }
  //     }
  //     return user && user.roles && Object.entries(roles).some(([name, hasRole]) => {
  //       return hasRole && rolePermissions[name] && (rolePermissions[name] === '*' || rolePermissions[name][page])
  //     })
  //   }
  // },
  methods: {
    _extractRowId(row, meta) {
      return meta.columns.filter(c => c.pk).map(c => row[c.title]).join('___')
    },
    upgradeToEE() {
      this.$toast.info('Upgrade to Enterprise Edition').goAway(3000)
    },
    comingSoon() {
      this.$toast.info('Coming soon').goAway(3000)
    },
    async sqlOp(args, op, opArgs, cusHeaders, cusAxiosOptions, queryParams) {
      return this.$store.dispatch('sqlMgr/ActSqlOp', [args, op, opArgs, cusHeaders, cusAxiosOptions, queryParams])
    },
    async _extractSdkResponseError(e) {
      if (!e || !e.response) { return e }
      let msg
      if (e.response.data instanceof Blob) {
        try {
          msg = JSON.parse(await e.response.data.text()).msg
        } catch {
          msg = 'Some internal error occurred'
        }
      } else {
        msg = e.response.data.msg || 'Some internal error occurred'
      }
      const err = new Error(msg)
      err.response = e.response
      return err
    },
    async _extractSdkResponseErrorMsg(e) {
      if (!e || !e.response) { return e.message }
      let msg
      if (e.response.data instanceof Blob) {
        try {
          msg = JSON.parse(await e.response.data.text()).msg
        } catch {
          msg = 'Some internal error occurred'
        }
      } else {
        msg = e.response.data.msg || 'Some internal error occurred'
      }
      return msg || 'Some error occurred'
    }
  }
}
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
