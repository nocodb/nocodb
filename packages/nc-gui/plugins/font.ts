export default defineNuxtPlugin(() => {
  // Listen when 'Material Symbols' font is loaded
  // and remove 'nc-fonts-not-loaded' class from <html> element

  try {
    document.documentElement?.classList.add('nc-fonts-not-loaded')

    const fontFaces = [...document.fonts.values()]
    const materialFont = fontFaces.find((fontFace) => fontFace.family === 'Material Symbols')

    if (!materialFont || !materialFont.loaded) {
      document.documentElement?.classList.remove('nc-fonts-not-loaded')
      return
    }

    materialFont.loaded
      .then(function () {
        document.documentElement?.classList.remove('nc-fonts-not-loaded')
      })
      .catch(function (error) {
        document.documentElement?.classList.remove('nc-fonts-not-loaded')
        console.error(error)
      })

    // Safari issue where loaded promise is always in pending state.
    // So we need to poll for font status to be 'unloaded'
    let intervalId: any

    function poll() {
      const fontFaces = [...document.fonts.values()]
      const materialFont = fontFaces.find((fontFace) => fontFace.family === 'Material Symbols')

      if (materialFont?.status === 'unloaded') {
        document.documentElement?.classList.remove('nc-fonts-not-loaded')
        stopPolling()
      } else if (materialFont?.status === 'loaded') {
        stopPolling()
      }
    }

    function startPolling(interval: number) {
      intervalId = setInterval(poll, interval)
    }

    function stopPolling() {
      clearInterval(intervalId)
    }

    startPolling(200)
  } catch (error) {
    document.documentElement?.classList.remove('nc-fonts-not-loaded')
    console.error(error)
  }
})
