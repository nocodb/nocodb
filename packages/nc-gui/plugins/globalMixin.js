/* eslint-disable no-undef */
import Vue from 'vue'
import device from '../mixins/device'

Vue.mixin(device)

export default async({ store }) => {
  function getListener(binding) {
    return function(e) {
      if (store.state.windows.isGaEnabled || store.state.windows.isComp) {
        const cat = window.location.hash.replace(/\d+\/(?=dashboard)/, '')
        const action = binding.value && binding.value[0]
        const label = binding.value && binding.value[1]
        try {
          if (store.state.windows.isComp) {
            ga('send', 'event', `${store.state.windows.isComp}\\${cat}`, action, label)
          }
          ga('send', 'event', cat, action, label)
        } catch {}
      }
    }
  }

  Vue.directive('ge', {
    bind(el, binding, vnode) {
      if (vnode.componentInstance) {
        vnode.componentInstance.$on('click', getListener(binding))
      } else {
        el.addEventListener('click', getListener(binding))
      }
    }
  })

  Vue.directive('xc-ver-resize', {
    bind: (el, bindings, vnode) => {
      // el.style.position = !el.style.position || el.style.position === 'static' ? 'relative' : el.style.position;
      const resizer = document.createElement('div')
      resizer.className = 'resizer'
      resizer.style.position = 'absolute'
      resizer.style.height = '100%'
      resizer.style.width = '3px'
      resizer.style.top = '0'
      resizer.style.right = '-1px'
      resizer.style.zIndex = '999'

      el.appendChild(resizer)
      resizer.addEventListener('mousedown', initDrag, false)

      // eslint-disable-next-line no-unused-vars
      let startX, startY, startWidth

      function initDrag(e) {
        document.body.style.cursor = 'col-resize'
        resizer.classList.add('primary')
        startX = e.clientX
        startY = e.clientY
        startWidth = parseInt(document.defaultView.getComputedStyle(el).width, 10)
        // startHeight = parseInt(document.defaultView.getComputedStyle(p).height, 10);
        document.documentElement.addEventListener('mousemove', doDrag, false)
        document.documentElement.addEventListener('mouseup', stopDrag, false)
      }

      let width
      const emit = (vnode, name, data) => {
        const handlers = (vnode.data && vnode.data.on) ||
          (vnode.componentOptions && vnode.componentOptions.listeners)

        if (handlers && handlers[name]) {
          handlers[name].fns(data)
        }
      }

      function doDrag(e) {
        width = (startWidth + e.clientX - startX) + 'px'
        el.style.width = width
        emit(vnode, 'xcresizing', width)
      }

      function stopDrag(e) {
        resizer.classList.remove('primary')
        document.body.style.cursor = ''
        document.documentElement.removeEventListener('mousemove', doDrag, false)
        document.documentElement.removeEventListener('mouseup', stopDrag, false)
        emit(vnode, 'xcresize', width)
        emit(vnode, 'xcresized')
      }
    }
  })
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
