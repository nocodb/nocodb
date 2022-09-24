import dayjs from 'dayjs'
import { defineNuxtPlugin, useGlobal, useNuxtApp } from '#imports'

const handleFeedbackForm = async () => {
  const { feedbackForm: currentFeedbackForm, signedIn } = useGlobal()

  if (!currentFeedbackForm.value || !signedIn.value) return

  const { $api } = useNuxtApp()

  const isFirstTimePolling = !currentFeedbackForm.value.lastFormPollDate

  const now = dayjs()

  const lastFormPolledDate = dayjs(currentFeedbackForm.value.lastFormPollDate)

  if (isFirstTimePolling || dayjs.duration(now.diff(lastFormPolledDate)).days() > 0) {
    $api.instance
      .get('/api/v1/feedback_form')
      .then((response) => {
        try {
          const { data: feedbackForm } = response
          if (!feedbackForm.error) {
            const isFetchedFormDuplicate = currentFeedbackForm.value.url === feedbackForm.url

            currentFeedbackForm.value = {
              url: feedbackForm.url,
              lastFormPollDate: now.toISOString(),
              createdAt: feedbackForm.created_at,
              isHidden: isFetchedFormDuplicate ? currentFeedbackForm.value.isHidden : false,
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
