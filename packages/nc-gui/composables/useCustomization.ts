import { useNuxtApp, useHead, extractSdkResponseErrorMsg, useApi } from '#imports'

export async function useCustomization() {
  
  const { hooks } = useNuxtApp()
  const { api } = useApi()

  let css = ''
  let js = ''

  const loadCustomization = async () => {
    try {
      const response = await api.orgCustomization.get()
      css = response.css!
      js = response.js!
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  await loadCustomization()

  useHead({
    style: [
      { children: css }
    ]
  })

  hooks.hook('page:finish', () => {
    /**
     * Kinda fix console error due to transitions see https://github.com/nuxt/nuxt/issues/13309 ,
     * without the if statement the hook fires once for the transition where the document is empty and once more when the document is loaded
    */
    if(document.querySelector('section') !== null){
        try {
          eval(js)
        } catch (e: any) {
            console.warn('Custom JS Error: ' + e.message)
        }
    }
  })

}