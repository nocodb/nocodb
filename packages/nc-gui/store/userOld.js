/* eslint-disable  */
// import Vue from "vue";
//
// import treeViewDataSerializer from "~/helpers/treeViewDataSerializer";
// import deepFind from "~/helpers/deepFind";
// import deepSet from "~/helpers/deepSet";

export const state = () => ({
  user: null,
  counter: 0,
  social_auth_called: false
});

export const mutations = {
  MutPlusCounter(state, todos) {
    //console.log('in MutPlusCounter');
    state.counter += 1
  },

  MutSetUser(state, user) {
    //console.log('in MutPlusCounter', user);
    state.user = user;
  },

  MutSetSocialAuthCalled(state, called) {
    //console.log('in MutPlusCounter', user);
    state.social_auth_called = called;
  },

  MutSetProjectToNull(state) {
    state.project = null;
    state.projectTree = null;
  }

};

export const getters = {
  GtrCounter(state) {
    return state.counter;
  },

  GtrUser(state) {
    return state.user;
  },

  GtrSocialAuthCalled(state) {
    return state.social_auth_called;
  }
};


export const actions = {

  ActPlusCounter({commit}) {
    //console.log('in action');
    commit('MutPlusCounter')
  },


  /**************** START : authentication ****************/
  async ActSignUp({commit}, data) {
    let err = null;

    try {
      let userPromise = await this.axios.post('/api/auth/signup', data);
      //console.log(userPromise);
      commit('MutSetUser', userPromise.data);
    } catch (e) {
      console.log('ActSignUp error', e.response);
      err = e.response;
    }

    return err;

  },

  async ActSignIn({commit}, data) {
    console.log('in action signin',data);
    let err = null;
    // try {
    //   let userPromise = await axios.post('/api/auth/signin', data);
    //   //console.log('userPromise', userPromise);
    //   commit('MutSetUser', userPromise.data);
    // } catch (e) {
    //   err = e.response;
    // }
    // console.log('err', err);
    return err;
  },

  async ActSignOut({commit}) {

    //console.log('in action signout');

    let err = null;

    try {
      let err = await axios.get('/api/auth/signout');
      //console.log(err);
      commit('MutSetUser', null);
      commit('MutSetProjectToNull',null)
    } catch (e) {
      err = e;
      console.log(e);
    }

    return err;

  },
  /**************** END : authentication ****************/

  /**************** START : password reset-recovery ****************/
  async ActPasswordForgot({commit}, data) {

    //console.log('in action signout');

    try {
      let forgot = await axios.post('/api/auth/forgot', data);
      //console.log(forgot);
    } catch (e) {

    }

  },

  async ActGetPasswordReset({commit}, query) {

    //console.log('in action ActGetPasswordReset', query);

    try {
      let result = await axios.get('/api/auth/reset/' + query.token);
      console.log(result);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }

  },

  async ActPostPasswordReset({commit}, data) {
    //console.log('in action signout', data);

    try {
      let resetPromise = await axios.post('/api/auth/reset/' + data.token, data);
      //console.log(resetPromise);
      commit('MutSetUser', resetPromise.data);
    } catch (e) {
      console.log(e);
    }

  },

  async ActPostPasswordChange({commit}, data) {
    //console.log('in action signout', data);

    try {
      let changePassword = await this.axios.post('/api/users/password/', data);
      //console.log(changePassword);
      this.$router.push('/');
    } catch (e) {
      console.log(e);
    }

  },
  /**************** END : password reset-recovery ****************/

  /**************** START : social auth ****************/
  ActAuthFb({commit}) {
    //console.log('in action signout');
  },

  ActAuthFbCbk({commit}) {
    //console.log('in action signout');
  },

  async ActAuthGoogle({commit, rootState}) {

    //console.log('in action ActAuthGoogle', rootState);

    try {
      let url = '/api/auth/google';
      //console.log(url);

      let gProimise = await axios.get(url
        , JSON.stringify({
          headers: {
            crossDomain: true,
            withCredentials: true,
            credentials: 'same-origin'
          }
        })
      );


      //console.log('after actauthgoogle');


      //console.log(gProimise);
      // this.$router.push(rootState.route.from.path)
      // this.$router.push(url)
    } catch (e) {
      console.log(e);
    }

  },

  ActAuthGoogleCbk({commit}) {
    //console.log('in action signout');
  },

  ActAuthPaypal({commit}) {
    //console.log('in action signout');
  },

  ActAuthPaypalCbk({commit}) {
    //console.log('in action signout');
  },

  ActAuthTwitter({commit}) {
    //console.log('in action signout');
  },

  ActAuthTwitterCbk({commit}) {
    //console.log('in action signout');
  },

  // ActAuthLinkedin({commit}) {
  //   //console.log('in action signout');
  // },
  //
  // ActAuthLinkedinCbk({commit}) {
  //   console.log('in action signout');
  // },
  //
  // ActAuthLinkedin({commit}) {
  //   console.log('in action signout');
  // },
  //
  // ActAuthLinkedinCbk({commit}) {
  //   console.log('in action signout');
  // },
  /**************** END : social auth ****************/
};
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
