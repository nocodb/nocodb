<template>
  <div>
    <v-snackbar v-model="show" :top="true" color="info">
      <p ref="message" class="title" v-html="message" />
      <v-btn @click.native="show = false">
        <!-- Close -->
        {{ $t('general.close') }}
      </v-btn>
    </v-snackbar>
  </div>
</template>

<script>

export default {
  data() {
    return {
      show: false,
      message: '',

      notification: {
        show: false,
        icons: {
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
        },
        data: null
      }
    }
  },
  computed: {
    notification1() {
      return this.$store.state.notification.snackbar
    }
  },
  watch: {
    message() {
      this.$nextTick(() => {
        // get all links which starts with http and on click open them in external browser
        this.$refs.message && this.$refs.message.querySelectorAll('a[href^="http"]').forEach(ele =>
          ele.addEventListener('click', (e) => {
            e.preventDefault()
            // shell.openExternal(ele.getAttribute('href'))
          })
        )
      })
    }
  },
  created() {
    this.$store.watch(
      state => state.snackbar.snack,
      () => {
        const msg = this.$store.state.snackbar.snack
        if (msg !== '') {
          this.show = true
          this.message = this.$store.state.snackbar.snack
          this.$store.commit('snackbar/setSnack', '')
        }
      }
    )
  }
}

</script>
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
