export default async({ store, redirect, $axios, $toast, $api, route }) => {
  // if (!route.path || !route.path.startsWith('/nc/')) { await store.dispatch('plugins/pluginPostInstall', 'Branding') }
  if (window.location.search &&
    /\bscope=|\bstate=/.test(window.location.search) &&
    /\bcode=/.test(window.location.search)) {
    try {
      const tokenData = await $axios.create({
        baseURL: $axios.defaults.baseURL
      }).post(`/auth/${window.location.search.includes('state=github') ? 'github' : 'google'}/genTokenByCode${window.location.search}`)

      store.commit('users/MutSetToken', tokenData.data.token)
      await store.dispatch('users/ActGetUserDetails')
    } catch (e) {
      if (e.response && e.response.data && e.response.data.msg) {
        $toast.error(e.response.data.msg).goAway(3000)
      }
    }
    const newURL = window.location.href.split('?')[0]
    window.history.pushState('object', document.title, newURL)
  }

  const icons = {
    success: {
      message: ' successful',
      class: 'success',
      icon: 'check_circle'
    },
    error: {
      message: ' failed',
      class: 'error',
      icon: 'error'
    }
  }

  store.watch(
    (state) => {
      return state.notification.list && state.notification.list[0] && state.notification.list[0].status
    },
    () => {
      // console.log(store.state.notification.list)
      const n = store.state.notification.list.length && store.state.notification.list[0]
      if (n && n.status !== 'pending' && n.type !== 'List') {
        const msg = `${n.type} ${n.module} ${icons[n.status].message}`
        $toast[n.status](msg, {
          duration: 2000,
          icon: icons[n.status].icon
        })
      }
    }
  )

  try {
    await store.dispatch('project/ActLoadProjectInfo')
    if (!store.state.project.appInfo.projectHasDb) {
      redirect('/')
    } else if (store.state.project.appInfo.projectHasAdmin === false) {
      redirect('/')
    }
  } catch (e) {
    console.log(e)
  }

  // fetch latest release info
  const fetchReleaseInfo = async() => {
    try {
      const releaseInfo = await $api.utils.appInfo()
      const latestRelease = await $api.utils.appVersion()
      if (releaseInfo && latestRelease && releaseInfo.version) {
        store.commit('app/MutReleaseVersion', releaseInfo.version)
        store.commit('app/MutLatestRelease', latestRelease.releaseVersion || null)
      } else {
        store.commit('app/MutReleaseVersion', null)
        store.commit('app/MutLatestRelease', null)
      }
    } catch (e) {
      // ignore
    }
  }

  fetchReleaseInfo().then(() => {
  })
  setInterval(fetchReleaseInfo, 10 * 60 * 1000)
  handleFeedbackForm({ store, $axios })
}

const handleFeedbackForm = async({ store, $axios }) => {
  const fetchFeedbackForm = async() => {
    try {
      const { data: feedbackForm } = await $axios.get('/api/v1/feedback_form')
      const currentFeedbackForm = store.state.settings.feedbackForm

      if (
        feedbackForm.url !== currentFeedbackForm.url ||
        feedbackForm.valid_till !== currentFeedbackForm.validTill
      ) {
        store.commit('settings/MutFeedbackForm', {
          url: feedbackForm.url,
          validTill: feedbackForm.valid_till,
          createdAt: feedbackForm.created_at,
          isHidden: false
        })
      }
    } catch (e) {
      // ignore
    }
  }

  const lastFeedbackFormExpirationDate = new Date(store.state.settings.feedbackForm.validTill)
  const isDateValid = date => date instanceof Date && !isNaN(date.getTime())

  if (
    !isDateValid(lastFeedbackFormExpirationDate) ||
    Date.now() > lastFeedbackFormExpirationDate.getTime()
  ) {
    fetchFeedbackForm()
  }
}
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
