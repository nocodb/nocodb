import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { defineNuxtPlugin } from '#app'

const handleFeedbackForm = async () => {
  let { feedbackForm: currentFeedbackForm } = $(useGlobal())
  if (!currentFeedbackForm) return

  const { $api } = useNuxtApp()

  const fetchFeedbackForm = async (now: Dayjs) => {
    try {
      const { data: feedbackForm } = await $api.instance.get('/api/v1/feedback_form')
      const isFetchedFormDuplicate = currentFeedbackForm.url === feedbackForm.url

      currentFeedbackForm = {
        url: feedbackForm.url,
        lastFormPollDate: now.toISOString(),
        createdAt: feedbackForm.created_at,
        isHidden: isFetchedFormDuplicate ? currentFeedbackForm.isHidden : false,
      }
    } catch (e) {
      console.error(e)
    }
  }

  const isFirstTimePolling = !currentFeedbackForm.lastFormPollDate

  const now = dayjs()
  const lastFormPolledDate = dayjs(currentFeedbackForm.lastFormPollDate)

  if (isFirstTimePolling || dayjs.duration(now.diff(lastFormPolledDate)).days() > 0) {
    await fetchFeedbackForm(now)
  }
}

export default defineNuxtPlugin(async () => {
  await handleFeedbackForm()
})
