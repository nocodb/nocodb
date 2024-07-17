const jobsState = createGlobalState(() => {
  const baseJobs = ref<Record<string, JobType[]>>({})
  return { baseJobs }
})

interface JobType {
  id: string
  job: string
  status: string
  result: Record<string, any>
  fk_user_id: string
  fk_workspace_id: string
  base_id: string
  created_at: Date
  updated_at: Date
  extension_id: string
}

export const useJobs = createSharedComposable(() => {
  const { baseJobs } = jobsState()

  const { $api } = useNuxtApp()

  const { base } = storeToRefs(useBase())

  const activeBaseJobs = computed(() => {
    if (!base.value || !base.value.id) {
      return null
    }
    return baseJobs.value[base.value.id]
  })

  const jobList = computed<JobType[]>(() => {
    return activeBaseJobs.value || []
  })

  const getJobsForBase = (baseId: string) => {
    return baseJobs.value[baseId] || []
  }

  const loadJobsForBase = async (baseId?: string) => {
    if (!baseId) {
      baseId = base.value.id

      if (!baseId) {
        return
      }
    }

    const jobs: JobType[] = await $api.jobs.list(baseId, {})

    if (baseJobs.value[baseId]) {
      baseJobs.value[baseId] = jobs || baseJobs.value[baseId]
    } else {
      baseJobs.value[baseId] = jobs || []
    }
  }

  return {
    jobList,
    loadJobsForBase,
    getJobsForBase,
  }
})
