export const useScripts = createSharedComposable(() => {
  const isScriptsEnabled = ref(false)

  const { $api } = useNuxtApp()

  const execScript = async (code: string) => {
    const data = $api.scripts.scriptExec({
      body: { code },
    })

    console.log(data)

    return data
  }

  return { isScriptsEnabled, execScript }
})
