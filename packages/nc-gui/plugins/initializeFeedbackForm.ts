import dayjs from 'dayjs'
import { defineNuxtPlugin } from '#app'

const handleFeedbackForm = async () => {
  let { feedbackForm: currentFeedbackForm } = $(useGlobal())
  if (!currentFeedbackForm) return

  const { $api } = useNuxtApp()

  const isFirstTimePolling = !currentFeedbackForm.lastFormPollDate

  const now = dayjs()
  const lastFormPolledDate = dayjs(currentFeedbackForm.lastFormPollDate)

  if (isFirstTimePolling || dayjs.duration(now.diff(lastFormPolledDate)).days() > 0) {
    $api.instance
      .get('/api/v1/feedback_form')
      .then((response) => {
        try {
          const { data: feedbackForm } = response
          if (!feedbackForm.error) {
            const isFetchedFormDuplicate = currentFeedbackForm.url === feedbackForm.url

            currentFeedbackForm = {
              url: feedbackForm.url,
              lastFormPollDate: now.toISOString(),
              createdAt: feedbackForm.created_at,
              isHidden: isFetchedFormDuplicate ? currentFeedbackForm.isHidden : false,
            }
          }
        } catch (e) {}
      })
      .catch(() => {})
  }
}

export default defineNuxtPlugin(() => {
  handleFeedbackForm()
})
