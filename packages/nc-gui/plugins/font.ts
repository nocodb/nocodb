import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin(() => {
  // Listen when 'Material Symbols' font is loaded
  // and remove 'nc-fonts-not-loaded' class from <html> element

  try {
    document.documentElement?.classList.add('nc-fonts-not-loaded')

    const fontFaces = [...document.fonts.values()]
    const materialFont = fontFaces.find((fontFace) => fontFace.family === 'Material Symbols')

    if (!materialFont || !materialFont?.loaded) {
      document.documentElement?.classList.remove('nc-fonts-not-loaded')
      return
    }

    materialFont?.loaded
      .then(function () {
        document.documentElement?.classList.remove('nc-fonts-not-loaded')
      })
      .catch(function (error) {
        document.documentElement?.classList.remove('nc-fonts-not-loaded')
        console.error(error)
      })
  } catch (error) {
    document.documentElement?.classList.remove('nc-fonts-not-loaded')
    console.error(error)
  }
})
