export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('xc-ver-resize', {
    created: (el: Element) => {
      // create resizer element
      const resizer = document.createElement('div')
      resizer.className = 'resizer'
      resizer.style.position = 'absolute'
      resizer.style.height = '100%'
      resizer.style.width = '3px'
      resizer.style.top = '0'
      resizer.style.right = '-1px'
      resizer.style.zIndex = '999'
      resizer.style.touchAction = 'none' // Prevent browser touch handling

      // add resizer to element
      el.appendChild(resizer)
      resizer.addEventListener('pointerdown', initDrag, false)

      const instance = getCurrentInstance()

      const emit =
        instance?.emit ??
        ((arg, data) => {
          const event = new CustomEvent(arg, { detail: data })
          ;(<HTMLElement>el).dispatchEvent(event)
        })

      let startX: number
      let startWidth: number

      // bind event handlers - uses Pointer Events for unified input handling
      function initDrag(e: PointerEvent) {
        if (el.classList.contains('no-resize')) {
          return
        }

        document.body.style.cursor = 'col-resize'
        startX = e.clientX
        startWidth = parseInt(document.defaultView?.getComputedStyle(el)?.width || '0', 10)
        document.documentElement.addEventListener('pointermove', doDrag, false)
        document.documentElement.addEventListener('pointerup', stopDrag, false)
        document.documentElement.addEventListener('pointercancel', stopDrag, false)
        emit('xcstartresizing', startWidth)
      }

      ;(el as any).initDrag = initDrag

      let width: number | string

      // emit event on dragging
      function doDrag(e: PointerEvent) {
        width = `${startWidth + e.clientX - startX}px`
        emit('xcresizing', width)
      }

      // remove handlers and emit events on drag end
      function stopDrag() {
        resizer.classList.remove('primary')
        document.body.style.cursor = ''
        document.documentElement.removeEventListener('pointermove', doDrag, false)
        document.documentElement.removeEventListener('pointerup', stopDrag, false)
        document.documentElement.removeEventListener('pointercancel', stopDrag, false)
        emit('xcresize', width)
        emit('xcresized')
      }
    },
    beforeUnmount: (el: Element) => {
      const resizer = el.querySelector('.resizer')

      if (resizer) {
        resizer.removeEventListener('pointerdown', (el as any).initDrag, false)
      }
    },
  })
})
