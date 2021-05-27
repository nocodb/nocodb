// import moment from 'moment';
import themes from "../helpers/themes";

// const {machineId} = require('electron').remote.require('./libs');

const defaultTheme = {
  "primary": "#0989ff",
  "secondary": "#9575CD",
  "accent": "#FF4081",
  "info": "#2196F3",
  "success": "#4CAF50",
  "warning": "#FB8C00",
  error: '#ff0100',
};

export const state = () => ({
  treeWindow: true,
  logWindow: true,
  outputWindow: true,
  darkTheme: false,
  clientDisabledLogWindow: false,
  theme: {},
  themeName: 'default',
  isGaEnabled: true,
  isErrorReportingEnabled: true,
  customTheme: {},
  language: 'en',
  showTour: {
    home: true,
    dashboard: true
  },
  startedDate: new Date(),//moment().format(),
  scaffoldOnSave: false,
  pollingFailedMaxRetry: 0,
  stats: {
    tableCount: 0,
    viewCount: 0,
    relationCount: 0,
  },
  version: '0.0.0',
  checkForUpdate: true,
  downloadAndUpdateRelease: true,
  isComp: false,
  metatables: false,
  nc: true,
  miniSponsorCard: 0
});

export const mutations = {
  MutToggleLogWindow(state, show) {
    state.logWindow = !state.logWindow;
  }, MutToggleDarkMode(state, status) {
    if (typeof status !== 'boolean') status = !state.darkTheme;
    state.darkTheme = status;
  }, MutToggleGaEnabled(state, isEnabled) {
    state.isGaEnabled = isEnabled;
  }, MutToggleErrorReportingEnabled(state, isEnabled) {
    state.isErrorReportingEnabled = isEnabled;
  }, MutToggleTelemetryEnabled(state, isEnabled) {
    state.isTelemetryEnabled = isEnabled;
  }, MutSetTheme(state, {theme, themeName}) {
    state.themeName = themeName;
    state.theme = theme;
  }, MutToggleTheme(state) {
    const keys = Object.keys(themes);
    const index = keys.indexOf(state.themeName) + 1;
    state.themeName = keys[index];
    state.theme = themes[state.themeName];
  }, MutSetCustomTheme(state, theme) {
    state.customTheme = theme;
  }, MutSetLanguage(state, language) {
    state.language = language;
  },
  MutToggleTreeviewWindow(state, show) {
    state.treeWindow = !state.treeWindow;
  },
  MutToggleOutputWindow(state, show) {
    state.outputWindow = !state.outputWindow;
  },
  MutToggleLogWindowFromTab(state, {client, status}) {
    if (client) {
      state.clientDisabledLogWindow = status;
      state.logWindow = false;
    } else {
      if (state.clientDisabledLogWindow) {
        state.logWindow = true;
      }
    }
  },
  MutShowTour(state, {page, status = false}) {
    state.showTour = {...state.showTour, [page]: status};
  },
  MutStartedDate(state, date) {
    state.expiryDate = date;
  },
  MutPollingIncrementBy(state, val = 1) {
    state.pollingFailedMaxRetry += val;
  },
  MutPollingSet(state, val = 0) {
    state.pollingFailedMaxRetry = val;
  },
  MutToggleScaffoldOnSave(state, status) {
    if (typeof status === 'boolean') {
      state.scaffoldOnSave = status
    } else {
      state.scaffoldOnSave = !state.scaffoldOnSave;
    }
  },
  MutStat(state, stats) {
    for (const key in stats) stats[key] += state.stats[key] || 0;
    state.stats = {...state.stats, ...stats}
  },
  MutResetStats(state) {
    for (const key in state.stats) state.stats[key] = 0;
    state.stats = {...state.stats}
  },
  MutVersion(state, version) {
    state.version = version;
  },

  MutCheckForUpdate(state, checkForUpdate) {
    state.checkForUpdate = checkForUpdate;
  },
  MutDownloadAndUpdateRelease(state, downloadAndUpdateRelease) {
    state.downloadAndUpdateRelease = downloadAndUpdateRelease;
  },
  MutIsComp(state, isComp) {
    state.isComp = isComp;
  },
  MutMetatables(state, show) {
    state.metatables = show;
  },
  MutNc(state, nc) {
    state.nc = nc;
  },
  MutMiniSponsorCard(state, miniSponsorCard) {
    state.miniSponsorCard = miniSponsorCard;
  }
};

export const getters = {
  GtrNoOfDaysLeft(state) {
    // const passedDays = moment().diff(state.startedDate, 'days');
    // return passedDays > 30 ? 0 : 30 - passedDays;
  },
  GtrHasTrialPeriodExpired(state) {
    // const passedDays = moment().diff(state.startedDate, 'days');
    // return passedDays > 30;
  },
  GtrMaxPollingRetryExceeded(state) {
    return state.pollingFailedMaxRetry >= process.env.pollingFailedMaxRetry;
  },
  GtrShouldWork(state) {
    return () => state.isComp ? Math.floor(Math.random() * 1000) % 5 === 0 : true;
  }
};

export const actions = {
  ActGetExpiryDate({state, commit}, args) {
    // if (!state.startedDate) {
    //   commit('MutStartedDate', moment().format())
    // }
    // return moment().diff(state.startedDate, 'days') // 1
  },
  ActToggleDarkMode({state, commit, rootState}, status) {
    //
    // const prepareToastMessage = () => {
    //   if (rootState.users.user && rootState.users.user.email) {
    //     return `Get free lifetime access to Dark theme click <a href="#/referral" style="color: white;font-weight: bold;">HERE</a>`
    //   } else {
    //     return `Sign up and refer to get Dark theme`
    //   }
    // };
    //
    // if (status && !rootState.users.ui_ability.rules.darkTheme) {
    //   setTimeout(() => {
    //     if (state.darkTheme) {
    //
    //
    //       this.commit('snackbar/setSnack', prepareToastMessage())
    //
    //       commit('MutToggleDarkMode', false)
    //     }
    //   }, process.env.darkThemeResetInSeconds)
    // }
    commit('MutToggleDarkMode', status)
  }
  ,
  ActCheckMaxTable({state, commit, rootState}, {tableIndex}) {
    const prepareToastMessage = () => {
      return `You are allowed to access only ${rootState.users.ui_ability.rules.maxTables} tables.<br/>
You can either upgrade or <a href="#/referral" style="color: white;font-weight: bold;">refer</a> us. `
    };


    if (process.env.ui_ability) {
      if (tableIndex > rootState.users.ui_ability.rules.maxTables) {
        this.commit('snackbar/setSnack', prepareToastMessage())
        return false;
      }
    }
    return true;
  },
  async ActSyncStats({state, commit}, stats) {
    commit('MutStats', stats);
    try {
      let res = await this.$axios.post('/api/v1/user/stats', {...stats, id: await machineId()})
      commit('MutResetStats', stats);
    } catch (e) {

    }

  },
  async ActSetTheme({state, commit, rootState}, {theme, themeName, custom}) {
//
//     if (!rootState.users.ui_ability.rules.darkTheme && themeName !== 'Default') {
//       setTimeout(() => {
//         this.commit('snackbar/setSnack', `Custom theme is not available for your profile. <br/>
// You can either upgrade or <a href="#/referral" style="color: white;font-weight: bold;">refer</a> us.`)
//         commit('MutSetTheme', {theme: defaultTheme, themeName: 'Default'});
//       }, process.env.darkThemeResetInSeconds);
//     }
    if (custom) {
      commit('MutSetCustomTheme', theme);
    } else {
      commit('MutSetTheme', {theme, themeName});
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
