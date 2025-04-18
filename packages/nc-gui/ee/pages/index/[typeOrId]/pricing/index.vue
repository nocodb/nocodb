<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'
import Underline from '~/assets/img/underline.png'
import YesSvg from '~/assets/img/Yes.svg'
import NoSvg from '~/assets/img/No.svg'

const route = useRoute()

const router = useRouter()

const { hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

useStripe()

const { navigateToBilling } = useEeConfig()

const {
  activeWorkspace,
  activeSubscription,
  activePlan,
  paymentMode,
  isLoyaltyWorkspace,
  loadPlans,
  plansAvailable,
  onSelectPlan,
} = useProvidePaymentStore()

onMounted(() => {
  hideSidebar.value = true
  showTopbar.value = true
})

onBeforeUnmount(() => {
  hideSidebar.value = false
  showTopbar.value = false
})

const onBilling = () => {
  navigateToBilling()
}

const onCheckout = (planTitle: string) => {
  const plan = plansAvailable.value.find((plan) => plan.title === planTitle)

  if (!plan) return

  if (activeSubscription.value?.period === paymentMode.value) {
    paymentMode.value = paymentMode.value === 'month' ? 'year' : 'month'
  }

  onSelectPlan(plan)
}

onMounted(async () => {
  await loadPlans()
})

const ncCompareFeatureRef = ref<HTMLElement>()

const activeBtnPlanTitle = ref('')

watch(
  [() => route?.query?.activeBtn, () => route?.query?.autoScroll],
  async ([activeBtn, autoScroll]) => {
    const { activeBtn: _activeBtn, autoScroll: _autoScroll, ...restQuery } = route.query as Record<string, string>

    if (autoScroll === 'planDetails') {
      await until(() => !!ncCompareFeatureRef.value).toBeTruthy()

      await ncDelay(300)

      ncCompareFeatureRef.value?.scrollIntoView({ behavior: 'smooth' })
    }

    if (!activeBtn || !Object.values(PlanTitles).includes(activeBtn as PlanTitles)) {
      if (autoScroll) {
        router.replace({ query: { ...restQuery } })
      }

      return
    }

    activeBtnPlanTitle.value = activeBtn as string

    router.replace({ query: { ...restQuery } })
  },
  {
    immediate: true,
  },
)
const openNewTab = (url: string) => {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
  if (newWindow) newWindow.opener = null
}
</script>

<template>
  <LazyPaymentPlansUpgradePlanModal />
  <div class="overflow-visible">
    <section style="padding-right: 24px; padding-left: 24px; gap: 16px; box-sizing: border-box; display: block">
      <div
        style="
          padding: 20px 0 80px 0;
          flex-flow: column nowrap;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 1200px;
          display: flex;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
        "
      >
        <div class="flex w-full">
          <NcButton type="text" size="small" inner-class="!gap-1" class="!hover:text-brand-600" @click="onBilling">
            <template #icon>
              <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
            </template>
            <div>Back to billing</div>
          </NcButton>
        </div>
        <div
          style="
            gap: 24px;
            padding-bottom: 20px;
            position: relative;
            flex-flow: column nowrap;
            justify-content: center;
            align-self: stretch;
            align-items: center;
            display: flex;
            box-sizing: border-box;
          "
        >
          <img
            :src="Underline"
            loading="lazy"
            sizes="(max-width: 643px) 100vw, 643px"
            alt=""
            style="
              width: 174px;
              position: absolute;
              top: 45px;
              left: 441px;
              max-width: 100%;
              display: block;
              vertical-align: middle;
              box-sizing: border-box;
              border: 0px none rgb(51, 51, 51);
            "
          />
          <h1
            style="
              color: rgb(16, 16, 21);
              text-align: center;
              margin-top: 0px;
              margin-bottom: 0px;
              font-size: 50px;
              line-height: 64px;
              font-weight: 700;
              box-sizing: border-box;
              margin: 0px;
            "
          >
            Unlimited Seats
          </h1>
          <span v-if="activePlan" class="text-base text-nc-content-gray-muted"
            >The {{ activeWorkspace?.title || 'Workspace' }} workspace is currently on the
            {{ activePlan.title === PlanTitles.FREE ? '' : activeSubscription?.period === 'month' ? 'monthly ' : 'yearly '
            }}{{ activePlan.title }} plan.</span
          >
        </div>
        <PaymentLoyaltyBadge v-if="isLoyaltyWorkspace" class="my-4" />
        <div
          style="
            gap: 24px;
            flex-flow: column nowrap;
            grid-template-rows: auto;
            grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
            grid-auto-columns: 1fr;
            justify-content: center;
            align-items: center;
            width: 100%;
            max-width: 1312px;
            transition: 0.2s;
            display: flex;
            position: relative;
            box-sizing: border-box;
          "
        >
          <div
            data-current="Annually"
            data-easing="ease"
            data-duration-in="0"
            data-duration-out="0"
            style="
              flex-flow: column nowrap;
              justify-content: flex-start;
              align-self: center;
              align-items: center;
              width: 100%;
              display: flex;
              position: relative;
              box-sizing: border-box;
            "
          >
            <div
              role="tablist"
              style="
                background-color: rgb(231, 231, 233);
                border-radius: 8px;
                justify-content: center;
                align-items: center;
                margin-bottom: 24px;
                padding: 4px;
                display: flex;
                position: relative;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  color: rgb(31, 41, 58);
                  box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                  gap: 8px;
                  border-radius: 6px;
                  justify-content: center;
                  align-items: center;
                  padding: 6px 8px;
                  font-size: 14px;
                  line-height: 20px;
                  display: flex;
                  text-decoration: none solid rgb(31, 41, 58);
                  vertical-align: top;
                  text-align: left;
                  cursor: pointer;
                  position: relative;
                  max-width: 100%;
                  box-sizing: border-box;
                "
                :class="{
                  'bg-white font-bold': paymentMode === 'year',
                }"
                @click="paymentMode = 'year'"
              >
                <div style="font-size: 14px; line-height: 20px; box-sizing: border-box">Yearly</div>
                <div
                  style="
                    background-color: rgb(236, 255, 242);
                    color: rgb(23, 128, 61);
                    border-radius: 6px;
                    padding: 2px 8px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  20% off
                </div>
              </div>
              <div
                style="
                  gap: 8px;
                  color: rgb(74, 82, 104);
                  border-radius: 6px;
                  justify-content: center;
                  align-items: center;
                  padding: 6px 8px;
                  font-size: 14px;
                  line-height: 20px;
                  display: flex;
                  text-decoration: none solid rgb(74, 82, 104);
                  vertical-align: top;
                  text-align: left;
                  cursor: pointer;
                  position: relative;
                  max-width: 100%;
                  box-sizing: border-box;
                "
                :class="{
                  'bg-white font-bold': paymentMode === 'month',
                }"
                @click="paymentMode = 'month'"
              >
                <div style="line-height: 20px; box-sizing: border-box">Monthly</div>
              </div>
            </div>
            <div
              style="
                width: 100%;
                padding-top: 4px;
                padding-bottom: 4px;
                overflow: visible;
                display: block;
                position: relative;
                box-sizing: border-box;
              "
            >
              <div v-if="paymentMode === 'year'" style="display: block; position: relative; box-sizing: border-box">
                <div
                  style="
                    gap: 20px;
                    justify-content: center;
                    align-items: flex-start;
                    width: 100%;
                    display: flex;
                    box-sizing: border-box;
                  "
                >
                  <div
                    user-limit="3"
                    style="
                      border: 1px solid rgb(231, 231, 233);
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Free
                    </h3>
                    <div
                      style="
                        gap: 4px;
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          price-per-unit="35"
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 2px;
                            font-size: 20px;
                            font-weight: 600;
                            line-height: 32px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >$</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 0px;
                            font-size: 36px;
                            font-weight: 700;
                            line-height: 36px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >0</span
                        >
                      </div>
                      <div
                        style="
                          color: rgb(106, 113, 132);
                          margin-left: 4px;
                          font-size: 12px;
                          font-weight: 500;
                          line-height: 18px;
                          box-sizing: border-box;
                        "
                      >
                        per user / month
                      </div>
                    </div>
                    <div
                      style="
                        width: fit-content;
                        opacity: 0;
                        background-color: rgb(55, 65, 81);
                        gap: 4px;
                        color: rgb(41, 82, 204);
                        border-radius: 6px;
                        padding: 4px 6px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          width: fit-content;
                          flex: 1 1 0%;
                          justify-content: space-between;
                          align-items: center;
                          font-size: 14px;
                          font-weight: 600;
                          line-height: 20px;
                          box-sizing: border-box;
                        "
                      >
                        Pricing Capped at $0
                      </div>
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    >
                      Free for upto 3 users.<br style="box-sizing: border-box" />
                    </div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For personal applications
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">3 Editors</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000 records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1 GB attachments</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100 automation runs / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000 API calls / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">No credit card required</div>
                      </div>
                    </div>
                    <div
                      v-if="activePlan?.title === PlanTitles.FREE"
                      href="#"
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        border: none;
                        box-sizing: border-box;
                      "
                    >
                      Current Plan
                    </div>
                    <a
                      v-else
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        background-color: rgb(255, 255, 255);
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                      "
                      @click="onCheckout(PlanTitles.FREE)"
                      >Choose Free</a
                    >
                  </div>
                  <div
                    plan-card=""
                    style="
                      border: 1px solid rgb(231, 231, 233);
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                      "
                    >
                      Team
                    </h3>
                    <div
                      style="
                        gap: 4px;
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          price-per-unit="35"
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 2px;
                            font-size: 20px;
                            font-weight: 600;
                            line-height: 32px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >$</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 0px;
                            font-size: 36px;
                            font-weight: 700;
                            line-height: 36px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >12</span
                        >
                      </div>
                      <div
                        style="
                          color: rgb(106, 113, 132);
                          margin-left: 4px;
                          font-size: 12px;
                          font-weight: 500;
                          line-height: 18px;
                          box-sizing: border-box;
                        "
                      >
                        per user / month, <br style="box-sizing: border-box" />billed annually
                      </div>
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    >
                      Pay for
                      <span
                        style="
                          color: rgb(31, 41, 58);
                          font-size: 14px;
                          font-weight: 700;
                          line-height: 20px;
                          box-sizing: border-box;
                        "
                        >9</span
                      >
                      users, <br style="box-sizing: border-box" />‍<span
                        style="color: rgb(23, 128, 61); font-size: 14px; font-weight: 700; box-sizing: border-box"
                        >Unlimited free</span
                      >
                      users after.
                    </div>
                    <div
                      style="
                        width: fit-content;
                        background: rgba(0, 0, 0, 0)
                          linear-gradient(45deg, rgb(51, 102, 255) 0%, rgb(125, 38, 205) 15%, rgb(173, 194, 255) 30%) repeat
                          scroll 0.0309679% 50% / 400% 400% padding-box border-box;
                        animation: 5s ease 0s infinite normal none running gradientBG;
                        border-radius: 8px;
                        margin-top: 16px;
                        padding: 2px;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          width: fit-content;
                          gap: 4px;
                          background-color: rgb(240, 243, 255);
                          color: rgb(41, 82, 204);
                          border-radius: 6px;
                          padding: 4px 6px;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <div style="width: 20px; height: 20px; box-sizing: border-box">
                          <svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style="box-sizing: border-box; overflow: hidden"
                          >
                            <path
                              d="M5.0013 13.3337C9.16797 13.3337 10.8346 6.66699 15.0013 6.66699C15.8854 6.66699 16.7332 7.01818 17.3583 7.6433C17.9834 8.26842 18.3346 9.11627 18.3346 10.0003C18.3346 10.8844 17.9834 11.7322 17.3583 12.3573C16.7332 12.9825 15.8854 13.3337 15.0013 13.3337C10.8346 13.3337 9.16797 6.66699 5.0013 6.66699C4.11725 6.66699 3.2694 7.01818 2.64428 7.6433C2.01916 8.26842 1.66797 9.11627 1.66797 10.0003C1.66797 10.8844 2.01916 11.7322 2.64428 12.3573C3.2694 12.9825 4.11725 13.3337 5.0013 13.3337Z"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              style="box-sizing: border-box"
                            ></path>
                          </svg>
                        </div>
                        <div
                          v-if="isLoyaltyWorkspace"
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited at <span class="line-through decoration-red-500 font-bold mr-1">$108</span>
                          <span class="font-bold">$48</span>
                        </div>
                        <div
                          v-else
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited seats at just <span class="font-bold">$108</span>
                        </div>
                      </div>
                    </div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For small teams
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited seats</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100,000 records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">20 GB attachments</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">25,000 automation runs / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100,000 API calls / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">SAML based Single Sign-On 🚀</div>
                        <div
                          style="
                            z-index: -1;
                            opacity: 0.2;
                            backdrop-filter: blur(5px);
                            background-image: linear-gradient(
                              225deg,
                              rgb(255, 255, 255) 10%,
                              rgb(252, 58, 198) 50%,
                              rgb(255, 255, 255) 90%
                            );
                            border-radius: 20px;
                            width: 169px;
                            position: absolute;
                            top: 0px;
                            bottom: 0px;
                            left: 26px;
                            box-sizing: border-box;
                          "
                        ></div>
                      </div>
                    </div>
                    <div
                      v-if="activePlan?.title === PlanTitles.TEAM && activeSubscription.period === paymentMode"
                      href="#"
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        border: none;
                        box-sizing: border-box;
                      "
                    >
                      Current Plan
                    </div>
                    <a
                      v-else
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        background-color: rgb(255, 255, 255);
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                      "
                      @click="onCheckout(PlanTitles.TEAM)"
                      >Choose Team</a
                    >
                  </div>
                  <div
                    plan-card=""
                    style="
                      border-color: rgb(51, 102, 255);
                      box-shadow: rgba(41, 82, 204, 0.08) 0px 0px 0px 4px;
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Business
                    </h3>
                    <div
                      style="
                        gap: 4px;
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          price-per-unit="35"
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 2px;
                            font-size: 20px;
                            font-weight: 600;
                            line-height: 32px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >$</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 0px;
                            font-size: 36px;
                            font-weight: 700;
                            line-height: 36px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >24</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      ></div>
                      <div
                        style="
                          color: rgb(106, 113, 132);
                          margin-left: 4px;
                          font-size: 12px;
                          font-weight: 500;
                          line-height: 18px;
                          box-sizing: border-box;
                        "
                      >
                        per user / month, <br style="box-sizing: border-box" />billed annually
                      </div>
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    >
                      Pay for
                      <span
                        style="
                          color: rgb(31, 41, 58);
                          font-size: 14px;
                          font-weight: 700;
                          line-height: 20px;
                          box-sizing: border-box;
                        "
                        >9</span
                      >
                      users, <br style="box-sizing: border-box" />‍<span
                        style="color: rgb(23, 128, 61); font-size: 14px; font-weight: 700; box-sizing: border-box"
                        >Unlimited free</span
                      >
                      users after.
                    </div>
                    <div
                      style="
                        width: fit-content;
                        background: rgba(0, 0, 0, 0)
                          linear-gradient(45deg, rgb(51, 102, 255) 0%, rgb(125, 38, 205) 15%, rgb(173, 194, 255) 30%) repeat
                          scroll 0.0309679% 50% / 400% 400% padding-box border-box;
                        animation: 5s ease 0s infinite normal none running gradientBG;
                        border-radius: 8px;
                        margin-top: 16px;
                        padding: 2px;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          width: fit-content;
                          gap: 4px;
                          background-color: rgb(240, 243, 255);
                          color: rgb(41, 82, 204);
                          border-radius: 6px;
                          padding: 4px 6px;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <div style="width: 20px; height: 20px; box-sizing: border-box">
                          <svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style="box-sizing: border-box; overflow: hidden"
                          >
                            <path
                              d="M5.0013 13.3337C9.16797 13.3337 10.8346 6.66699 15.0013 6.66699C15.8854 6.66699 16.7332 7.01818 17.3583 7.6433C17.9834 8.26842 18.3346 9.11627 18.3346 10.0003C18.3346 10.8844 17.9834 11.7322 17.3583 12.3573C16.7332 12.9825 15.8854 13.3337 15.0013 13.3337C10.8346 13.3337 9.16797 6.66699 5.0013 6.66699C4.11725 6.66699 3.2694 7.01818 2.64428 7.6433C2.01916 8.26842 1.66797 9.11627 1.66797 10.0003C1.66797 10.8844 2.01916 11.7322 2.64428 12.3573C3.2694 12.9825 4.11725 13.3337 5.0013 13.3337Z"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              style="box-sizing: border-box"
                            ></path>
                          </svg>
                        </div>
                        <div
                          v-if="isLoyaltyWorkspace"
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            font-weight: 600;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited at <span class="line-through decoration-red-500 font-bold mr-1">$216</span>
                          <span class="font-bold">$96</span>
                        </div>
                        <div
                          v-else
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited seats at just <span class="font-bold">$216</span>
                        </div>
                      </div>
                    </div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For scaling businesses
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited seats</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000,000 records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100 GB attachments</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100,000 automation runs / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000,000 API calls / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Audit Logs 🚀</div>
                        <div
                          style="
                            width: 67px;
                            z-index: -1;
                            opacity: 0.2;
                            backdrop-filter: blur(5px);
                            background-image: linear-gradient(
                              225deg,
                              rgb(255, 255, 255) 10%,
                              rgb(252, 58, 198) 50%,
                              rgb(255, 255, 255) 90%
                            );
                            border-radius: 20px;
                            position: absolute;
                            top: 0px;
                            bottom: 0px;
                            left: 26px;
                            box-sizing: border-box;
                          "
                        ></div>
                      </div>
                    </div>
                    <div
                      v-if="activePlan?.title === PlanTitles.BUSINESS && activeSubscription.period === paymentMode"
                      href="#"
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        border: none;
                        box-sizing: border-box;
                      "
                    >
                      Current Plan
                    </div>
                    <a
                      v-else
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                        background-color: rgb(51, 102, 255);
                        color: rgb(255, 255, 255);
                      "
                      @click="onCheckout(PlanTitles.BUSINESS)"
                      >Choose Business</a
                    >
                  </div>
                  <div
                    style="
                      border: 1px solid rgb(231, 231, 233);
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Enterprise
                    </h3>
                    <div
                      style="
                        color: rgb(31, 41, 58);
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        font-size: 24px;
                        flex-flow: row nowrap;
                        margin-bottom: 0px;
                        font-weight: 700;
                        line-height: 36px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      Schedule a Call
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        margin-top: 16px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      Starting at $1000 / month
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    ></div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For establised organizations
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited workspaces</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited seats</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">On premise installation</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Air gapped installation</div>
                      </div>
                    </div>
                    <a
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        background-color: rgb(255, 255, 255);
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                      "
                      @click="openNewTab('https://cal.com/nocodb')"
                      >Get Quota</a
                    >
                  </div>
                </div>
              </div>
              <div v-if="paymentMode === 'month'" style="display: block; position: relative; box-sizing: border-box">
                <div
                  style="
                    gap: 20px;
                    justify-content: center;
                    align-items: flex-start;
                    width: 100%;
                    display: flex;
                    box-sizing: border-box;
                  "
                >
                  <div
                    user-limit="3"
                    style="
                      border: 1px solid rgb(231, 231, 233);
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Free
                    </h3>
                    <div
                      style="
                        gap: 4px;
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          price-per-unit="35"
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 2px;
                            font-size: 20px;
                            font-weight: 600;
                            line-height: 32px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >$</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 0px;
                            font-size: 36px;
                            font-weight: 700;
                            line-height: 36px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >0</span
                        >
                      </div>
                      <div
                        style="
                          color: rgb(106, 113, 132);
                          margin-left: 4px;
                          font-size: 12px;
                          font-weight: 500;
                          line-height: 18px;
                          box-sizing: border-box;
                        "
                      >
                        per user / month
                      </div>
                    </div>
                    <div
                      style="
                        width: fit-content;
                        opacity: 0;
                        background-color: rgb(55, 65, 81);
                        gap: 4px;
                        color: rgb(41, 82, 204);
                        border-radius: 6px;
                        padding: 4px 6px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          width: fit-content;
                          flex: 1 1 0%;
                          justify-content: space-between;
                          align-items: center;
                          font-size: 14px;
                          font-weight: 600;
                          line-height: 20px;
                          box-sizing: border-box;
                        "
                      >
                        Pricing Capped at $0
                      </div>
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    >
                      Free for upto 3 users.<br style="box-sizing: border-box" />
                    </div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For personal applications
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">3 Editors</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000 records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1 GB attachments</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100 automation runs / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000 API calls / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">No credit card required</div>
                      </div>
                    </div>
                    <div
                      v-if="activePlan?.title === PlanTitles.FREE"
                      href="#"
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        border: none;
                        box-sizing: border-box;
                      "
                    >
                      Current Plan
                    </div>
                    <a
                      v-else
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        background-color: rgb(255, 255, 255);
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                      "
                      @click="onCheckout(PlanTitles.FREE)"
                      >Choose Free</a
                    >
                  </div>
                  <div
                    plan-card=""
                    style="
                      border: 1px solid rgb(231, 231, 233);
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Team
                    </h3>
                    <div
                      style="
                        gap: 4px;
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          price-per-unit="35"
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 2px;
                            font-size: 20px;
                            font-weight: 600;
                            line-height: 32px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >$</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 0px;
                            font-size: 36px;
                            font-weight: 700;
                            line-height: 36px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >15</span
                        >
                      </div>
                      <div
                        style="
                          color: rgb(106, 113, 132);
                          margin-left: 4px;
                          font-size: 12px;
                          font-weight: 500;
                          line-height: 18px;
                          box-sizing: border-box;
                        "
                      >
                        per user / month, <br style="box-sizing: border-box" />billed monthly
                      </div>
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    >
                      Pay for
                      <span
                        style="
                          color: rgb(31, 41, 58);
                          font-size: 14px;
                          font-weight: 700;
                          line-height: 20px;
                          box-sizing: border-box;
                        "
                        >9</span
                      >
                      users, <br style="box-sizing: border-box" />‍<span
                        style="color: rgb(23, 128, 61); font-size: 14px; font-weight: 700; box-sizing: border-box"
                        >Unlimited free</span
                      >
                      users after.
                    </div>
                    <div
                      style="
                        width: fit-content;
                        background: rgba(0, 0, 0, 0)
                          linear-gradient(45deg, rgb(51, 102, 255) 0%, rgb(125, 38, 205) 15%, rgb(173, 194, 255) 30%) repeat
                          scroll 0% 50% / 400% 400% padding-box border-box;
                        animation: 5s ease 0s infinite normal none running gradientBG;
                        border-radius: 8px;
                        margin-top: 16px;
                        padding: 2px;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          width: fit-content;
                          gap: 4px;
                          background-color: rgb(240, 243, 255);
                          color: rgb(41, 82, 204);
                          border-radius: 6px;
                          padding: 4px 6px;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <div style="width: 20px; height: 20px; box-sizing: border-box">
                          <svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style="box-sizing: border-box; overflow: hidden"
                          >
                            <path
                              d="M5.0013 13.3337C9.16797 13.3337 10.8346 6.66699 15.0013 6.66699C15.8854 6.66699 16.7332 7.01818 17.3583 7.6433C17.9834 8.26842 18.3346 9.11627 18.3346 10.0003C18.3346 10.8844 17.9834 11.7322 17.3583 12.3573C16.7332 12.9825 15.8854 13.3337 15.0013 13.3337C10.8346 13.3337 9.16797 6.66699 5.0013 6.66699C4.11725 6.66699 3.2694 7.01818 2.64428 7.6433C2.01916 8.26842 1.66797 9.11627 1.66797 10.0003C1.66797 10.8844 2.01916 11.7322 2.64428 12.3573C3.2694 12.9825 4.11725 13.3337 5.0013 13.3337Z"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              style="box-sizing: border-box"
                            ></path>
                          </svg>
                        </div>
                        <div
                          v-if="isLoyaltyWorkspace"
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            font-weight: 600;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited at <span class="line-through decoration-red-500 font-bold mr-1">$135</span>
                          <span class="font-bold">$60</span>
                        </div>
                        <div
                          v-else
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited seats at just <span class="font-bold">$135</span>
                        </div>
                      </div>
                    </div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For small teams
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited seats</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100,000 records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">20 GB attachments</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">25,000 automation runs / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100,000 API calls / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">SAML based Single Sign-On 🚀</div>
                        <div
                          style="
                            z-index: -1;
                            opacity: 0.2;
                            backdrop-filter: blur(5px);
                            background-image: linear-gradient(
                              225deg,
                              rgb(255, 255, 255) 10%,
                              rgb(252, 58, 198) 50%,
                              rgb(255, 255, 255) 90%
                            );
                            border-radius: 20px;
                            width: 169px;
                            position: absolute;
                            top: 0px;
                            bottom: 0px;
                            left: 26px;
                            box-sizing: border-box;
                          "
                        ></div>
                      </div>
                    </div>
                    <div
                      v-if="activePlan?.title === PlanTitles.TEAM && activeSubscription.period === paymentMode"
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        border: none;
                        box-sizing: border-box;
                      "
                    >
                      Current Plan
                    </div>
                    <a
                      v-else
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        background-color: rgb(255, 255, 255);
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                      "
                      @click="onCheckout(PlanTitles.TEAM)"
                      >Choose Team</a
                    >
                  </div>
                  <div
                    plan-card=""
                    style="
                      border-color: rgb(51, 102, 255);
                      box-shadow: rgba(41, 82, 204, 0.08) 0px 0px 0px 4px;
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Business
                    </h3>
                    <div
                      style="
                        gap: 4px;
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          price-per-unit="35"
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 2px;
                            font-size: 20px;
                            font-weight: 600;
                            line-height: 32px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >$</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <span
                          style="
                            color: rgb(16, 16, 21);
                            flex-flow: row nowrap;
                            justify-content: flex-start;
                            align-items: center;
                            margin-bottom: 0px;
                            font-size: 36px;
                            font-weight: 700;
                            line-height: 36px;
                            display: flex;
                            box-sizing: border-box;
                          "
                          >30</span
                        >
                      </div>
                      <div
                        style="
                          justify-content: flex-start;
                          align-items: center;
                          font-weight: 700;
                          display: flex;
                          box-sizing: border-box;
                        "
                      ></div>
                      <div
                        style="
                          color: rgb(106, 113, 132);
                          margin-left: 4px;
                          font-size: 12px;
                          font-weight: 500;
                          line-height: 18px;
                          box-sizing: border-box;
                        "
                      >
                        per user / month, <br style="box-sizing: border-box" />billed monthly
                      </div>
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    >
                      Pay for
                      <span
                        style="
                          color: rgb(31, 41, 58);
                          font-size: 14px;
                          font-weight: 700;
                          line-height: 20px;
                          box-sizing: border-box;
                        "
                        >9</span
                      >
                      users, <br style="box-sizing: border-box" />‍<span
                        style="color: rgb(23, 128, 61); font-size: 14px; font-weight: 700; box-sizing: border-box"
                        >Unlimited free</span
                      >
                      users after.
                    </div>
                    <div
                      style="
                        width: fit-content;
                        background: rgba(0, 0, 0, 0)
                          linear-gradient(45deg, rgb(51, 102, 255) 0%, rgb(125, 38, 205) 15%, rgb(173, 194, 255) 30%) repeat
                          scroll 0% 50% / 400% 400% padding-box border-box;
                        animation: 5s ease 0s infinite normal none running gradientBG;
                        border-radius: 8px;
                        margin-top: 16px;
                        padding: 2px;
                        box-sizing: border-box;
                      "
                    >
                      <div
                        style="
                          width: fit-content;
                          gap: 4px;
                          background-color: rgb(240, 243, 255);
                          color: rgb(41, 82, 204);
                          border-radius: 6px;
                          padding: 4px 6px;
                          display: flex;
                          box-sizing: border-box;
                        "
                      >
                        <div style="width: 20px; height: 20px; box-sizing: border-box">
                          <svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style="box-sizing: border-box; overflow: hidden"
                          >
                            <path
                              d="M5.0013 13.3337C9.16797 13.3337 10.8346 6.66699 15.0013 6.66699C15.8854 6.66699 16.7332 7.01818 17.3583 7.6433C17.9834 8.26842 18.3346 9.11627 18.3346 10.0003C18.3346 10.8844 17.9834 11.7322 17.3583 12.3573C16.7332 12.9825 15.8854 13.3337 15.0013 13.3337C10.8346 13.3337 9.16797 6.66699 5.0013 6.66699C4.11725 6.66699 3.2694 7.01818 2.64428 7.6433C2.01916 8.26842 1.66797 9.11627 1.66797 10.0003C1.66797 10.8844 2.01916 11.7322 2.64428 12.3573C3.2694 12.9825 4.11725 13.3337 5.0013 13.3337Z"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              style="box-sizing: border-box"
                            ></path>
                          </svg>
                        </div>
                        <div
                          v-if="isLoyaltyWorkspace"
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            font-weight: 600;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited at <span class="line-through decoration-red-500 font-bold mr-1">$270</span>
                          <span class="font-bold">$120</span>
                        </div>
                        <div
                          v-else
                          style="
                            width: fit-content;
                            flex: 1 1 0%;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 14px;
                            line-height: 20px;
                            box-sizing: border-box;
                          "
                        >
                          Unlimited seats at just <span class="font-bold">$270</span>
                        </div>
                      </div>
                    </div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For scaling businesses
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited seats</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000,000 records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100 GB attachments</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">100,000 automation runs / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">1,000,000 API calls / month</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Audit Logs 🚀</div>
                        <div
                          style="
                            width: 67px;
                            z-index: -1;
                            opacity: 0.2;
                            backdrop-filter: blur(5px);
                            background-image: linear-gradient(
                              225deg,
                              rgb(255, 255, 255) 10%,
                              rgb(252, 58, 198) 50%,
                              rgb(255, 255, 255) 90%
                            );
                            border-radius: 20px;
                            position: absolute;
                            top: 0px;
                            bottom: 0px;
                            left: 26px;
                            box-sizing: border-box;
                          "
                        ></div>
                      </div>
                    </div>
                    <div
                      v-if="activePlan?.title === PlanTitles.BUSINESS && activeSubscription.period === paymentMode"
                      href="#"
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        border: none;
                        box-sizing: border-box;
                      "
                    >
                      Current Plan
                    </div>
                    <a
                      v-else
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                        background-color: rgb(51, 102, 255);
                        color: rgb(255, 255, 255);
                      "
                      @click="onCheckout(PlanTitles.BUSINESS)"
                      >Choose Business</a
                    >
                  </div>
                  <div
                    style="
                      border: 1px solid rgb(231, 231, 233);
                      border-radius: 16px;
                      align-self: stretch;
                      width: 100%;
                      padding: 20px;
                      position: relative;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                    "
                  >
                    <h3
                      style="
                        color: rgb(31, 41, 58);
                        flex: 1 1 0%;
                        margin-top: 0px;
                        margin-bottom: 0px;
                        font-size: 20px;
                        line-height: 32px;
                        font-weight: 700;
                        box-sizing: border-box;
                      "
                    >
                      Enterprise
                    </h3>
                    <div
                      style="
                        color: rgb(31, 41, 58);
                        justify-content: flex-start;
                        align-items: center;
                        margin-top: 16px;
                        font-size: 24px;
                        flex-flow: row nowrap;
                        margin-bottom: 0px;
                        font-weight: 700;
                        line-height: 36px;
                        display: flex;
                        box-sizing: border-box;
                      "
                    >
                      Schedule a Call
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        margin-top: 16px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      Starting at $1000 / month
                    </div>
                    <div
                      style="
                        color: rgb(106, 113, 132);
                        width: 100%;
                        min-height: 48px;
                        margin-bottom: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        line-height: 24px;
                        display: none;
                        box-sizing: border-box;
                      "
                    ></div>
                    <div
                      style="
                        flex: 1 1 0%;
                        margin-top: 16px;
                        margin-bottom: 0px;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 20px;
                        box-sizing: border-box;
                      "
                    >
                      For establised organizations
                    </div>
                    <div
                      style="
                        flex-flow: column nowrap;
                        width: 100%;
                        margin-top: 16px;
                        display: flex;
                        box-sizing: border-box;
                        flex-grow: 1;
                      "
                    >
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited workspaces</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited seats</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Unlimited records</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">On premise installation</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Air gapped installation</div>
                      </div>
                      <div
                        style="
                          gap: 12px;
                          justify-content: flex-start;
                          align-items: center;
                          width: 100%;
                          margin-top: 6px;
                          display: flex;
                          position: relative;
                          box-sizing: border-box;
                        "
                      >
                        <img
                          loading="lazy"
                          :src="YesSvg"
                          alt="Yes"
                          style="
                            max-width: 100%;
                            display: block;
                            vertical-align: middle;
                            box-sizing: border-box;
                            border: 0px none rgb(51, 51, 51);
                          "
                        />
                        <div style="font-size: 13px; box-sizing: border-box">Air gapped installation</div>
                      </div>
                    </div>
                    <a
                      style="
                        height: 40px;
                        margin-top: 24px;
                        gap: 8px;
                        border-style: solid;
                        border-width: 1px;
                        border-top-color: rgb(231, 231, 233);
                        border-right-color: rgb(231, 231, 233);
                        border-bottom-color: rgb(231, 231, 233);
                        border-left-color: rgb(231, 231, 233);
                        background-color: rgb(255, 255, 255);
                        color: rgb(31, 41, 58);
                        user-select: none;
                        border-radius: 8px;
                        justify-content: center;
                        align-items: center;
                        padding: 6px 8px;
                        font-weight: 600;
                        display: flex;
                        box-shadow: rgba(0, 0, 0, 0.02) 0px 5px 3px -2px, rgba(0, 0, 0, 0.06) 0px 3px 1px -2px;
                        text-decoration: none solid rgb(31, 41, 58);
                        line-height: 20px;
                        cursor: pointer;
                        border: 1px solid rgb(231, 231, 233);
                        box-sizing: border-box;
                      "
                      @click="openNewTab('https://cal.com/nocodb')"
                      >Get Quota</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style="
            gap: 4px;
            color: rgb(31, 41, 58);
            justify-content: center;
            align-items: center;
            width: 100%;
            margin-top: 40px;
            font-size: 12px;
            line-height: 18px;
            display: flex;
            box-sizing: border-box;
          "
        >
          <div style="width: 16px; height: 16px; box-sizing: border-box">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style="box-sizing: border-box; overflow: hidden"
            >
              <path
                d="M11.8889 7.4502H4.11111C3.49746 7.4502 3 7.94766 3 8.56131V12.4502C3 13.0638 3.49746 13.5613 4.11111 13.5613H11.8889C12.5025 13.5613 13 13.0638 13 12.4502V8.56131C13 7.94766 12.5025 7.4502 11.8889 7.4502Z"
                stroke="#3366FF"
                stroke-width="1.33"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="box-sizing: border-box"
              ></path>
              <path
                d="M11 7.4502V5.4502C11 3.79334 9.65685 2.4502 8 2.4502C6.34315 2.4502 5 3.79334 5 5.4502V7.4502"
                stroke="#3366FF"
                stroke-width="1.33"
                style="box-sizing: border-box"
              ></path>
            </svg>
          </div>
          <div style="font-size: 13px; box-sizing: border-box">100% secure payment, powered by</div>
          <div style="height: 16px; box-sizing: border-box">
            <svg
              width="39"
              height="16"
              viewBox="0 0 39 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style="box-sizing: border-box; overflow: hidden"
            >
              <g clip-path="url(#clip0_1089_21441)" style="box-sizing: border-box">
                <path
                  d="M38.5 8.23028C38.5 5.50812 37.1911 3.36017 34.6894 3.36017C32.1772 3.36017 30.6572 5.50812 30.6572 8.20901C30.6572 11.4097 32.4517 13.026 35.0272 13.026C36.2833 13.026 37.2333 12.7389 37.9511 12.3348V10.2081C37.2333 10.5696 36.41 10.7929 35.365 10.7929C34.3411 10.7929 33.4333 10.4314 33.3172 9.17666H38.4789C38.4789 9.03842 38.5 8.48548 38.5 8.23028ZM33.2856 7.2201C33.2856 6.01853 34.0139 5.51875 34.6789 5.51875C35.3228 5.51875 36.0089 6.01853 36.0089 7.2201H33.2856ZM26.5828 3.36017C25.5483 3.36017 24.8833 3.8493 24.5139 4.18957L24.3767 3.5303H22.0544V15.9289L24.6933 15.3653L24.7039 12.3561C25.0839 12.6325 25.6433 13.026 26.5722 13.026C28.4617 13.026 30.1822 11.4947 30.1822 8.12395C30.1717 5.04025 28.43 3.36017 26.5828 3.36017ZM25.9494 10.6866C25.3267 10.6866 24.9572 10.4633 24.7039 10.1868L24.6933 6.24183C24.9678 5.93346 25.3478 5.72079 25.9494 5.72079C26.91 5.72079 27.575 6.8054 27.575 8.19838C27.575 9.62326 26.9206 10.6866 25.9494 10.6866ZM18.4233 2.73279L21.0728 2.15859V0L18.4233 0.563572V2.73279ZM18.4233 3.54093H21.0728V12.8452H18.4233V3.54093ZM15.5839 4.32781L15.415 3.54093H13.135V12.8452H15.7739V6.53956C16.3967 5.72079 17.4522 5.86966 17.7794 5.98663V3.54093C17.4417 3.41333 16.2067 3.1794 15.5839 4.32781ZM10.3061 1.23348L7.73056 1.78642L7.72 10.3038C7.72 11.8776 8.89167 13.0366 10.4539 13.0366C11.3194 13.0366 11.9528 12.8771 12.3011 12.6857V10.5271C11.9633 10.6653 10.2956 11.1545 10.2956 9.58073V5.80586H12.3011V3.54093H10.2956L10.3061 1.23348ZM3.17056 6.24183C3.17056 5.82712 3.50833 5.66762 4.06778 5.66762C4.87 5.66762 5.88333 5.91219 6.68556 6.34816V3.8493C5.80944 3.4984 4.94389 3.36017 4.06778 3.36017C1.925 3.36017 0.5 4.48731 0.5 6.36943C0.5 9.30426 4.51111 8.83639 4.51111 10.1018C4.51111 10.5909 4.08889 10.7504 3.49778 10.7504C2.62167 10.7504 1.50278 10.3889 0.616111 9.89973V12.4305C1.59778 12.8558 2.59 13.0366 3.49778 13.0366C5.69333 13.0366 7.20278 11.9414 7.20278 10.038C7.19222 6.8692 3.17056 7.43277 3.17056 6.24183Z"
                  fill="#635BFF"
                  style="box-sizing: border-box"
                ></path>
              </g>
              <defs style="box-sizing: border-box">
                <clipPath style="box-sizing: border-box">
                  <rect width="38" height="16" fill="white" transform="translate(0.5)" style="box-sizing: border-box"></rect>
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </section>
    <section
      style="
        gap: 40px;
        background-color: rgb(249, 249, 250);
        flex-flow: column nowrap;
        justify-content: center;
        align-items: center;
        padding-left: 24px;
        padding-right: 24px;
        box-sizing: border-box;
        display: block;
      "
    >
      <div
        style="
          flex-flow: column nowrap;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 1200px;
          padding: 120px 0px 80px;
          display: flex;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
        "
      >
        <h2
          style="
            color: rgb(74, 82, 104);
            max-width: 800px;
            font-size: 16px;
            font-weight: 500;
            line-height: 24px;
            text-align: center;
            margin-top: 0px;
            margin-bottom: 0px;
            box-sizing: border-box;
          "
        >
          Trusted by 11,000+ Organisations
        </h2>
        <div
          style="
            gap: 16px;
            flex-flow: row wrap;
            grid-template-rows: auto auto;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            grid-auto-columns: 1fr;
            justify-content: center;
            align-items: center;
            max-width: 100%;
            margin-top: 60px;
            display: flex;
            box-sizing: border-box;
          "
        >
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="54"
                height="41"
                viewBox="0 0 54 41"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <path
                  d="M5.58859 34.9426C5.85799 34.9543 5.97512 34.9543 6.1391 34.9543C8.16546 34.9543 9.25477 33.6893 9.25477 31.2647C9.25477 29.215 8.36458 28.1139 6.72475 28.1139C6.45535 28.1139 6.16253 28.1491 5.58859 28.2193M36.3353 27.0246C34.6369 27.294 33.7701 28.5473 33.7701 30.7611C33.7701 32.9748 34.9297 34.4624 36.6984 34.4624C37.5183 34.4624 38.2679 34.193 39.8492 33.4199V35.212C37.9634 36.0788 36.8507 36.3482 35.328 36.3482C33.6764 36.3482 32.5168 35.9148 31.5681 34.9426C30.5959 33.9704 30.1157 32.6937 30.1157 31.2647C30.1157 28.0905 32.47 25.9353 35.9019 25.9353C38.186 25.9353 39.7555 26.9778 39.7555 28.5122C39.7555 29.4961 39.0293 30.1754 37.94 30.1754C37.3895 30.1754 36.9327 30.0349 36.347 29.6952V27.0246H36.3353ZM27.9605 31.2647C29.4832 29.3438 30.022 28.5707 30.022 27.6337C30.022 26.6966 29.284 25.947 28.2884 25.947C27.6794 25.947 27.1289 26.2398 26.8595 26.5327V30.4331L24.3646 33.7596V26.193H21.9985L18.063 32.7289V26.193H16.6925L13.1201 27.0598V27.9734L15.0761 28.1725V36.1842H17.5944L21.3778 29.9763V36.1842H24.142L27.9605 31.2647ZM5.58859 39.3116L7.22841 39.6747V40.6H0.809674V39.6747L2.2738 39.3116V28.1139H0.645691V27.1535L4.56956 25.9587H5.58859V27.294C7.42754 26.2047 8.06004 26.0056 8.99708 26.0056C11.1757 26.0056 12.7804 28.0085 12.7804 30.7962C12.7804 34.0056 10.6369 36.1725 7.26355 36.1725C6.87702 36.1725 6.24452 36.1491 5.58859 36.0788V39.335V39.3116Z"
                  fill="#010101"
                  style="box-sizing: border-box"
                ></path>
                <path d="M53.284 12.8752H50.8594V17.783H53.284V12.8752Z" fill="#F0659D" style="box-sizing: border-box"></path>
                <path d="M53.3543 12.8752H53.2957V17.783H53.3543V12.8752Z" fill="#6C529C" style="box-sizing: border-box"></path>
                <path d="M45.8931 2.521H43.9722V5.50782H45.8931V2.521Z" fill="#FAB483" style="box-sizing: border-box"></path>
                <path
                  d="M43.9722 0.611816H34.1801V2.52104H43.9722V0.611816Z"
                  fill="#F7952F"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M43.9722 0.600098H34.1801V0.611811H43.9722V0.600098Z"
                  fill="#6C7047"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M34.1801 12.8753V2.521H43.9722V5.50782H34.1801V12.8753Z"
                  fill="#F47628"
                  style="box-sizing: border-box"
                ></path>
                <path d="M50.8595 5.50781H45.8931V12.8753H50.8595V5.50781Z" fill="#FDB823" style="box-sizing: border-box"></path>
                <path d="M50.8595 12.8752H45.8931V17.783H50.8595V12.8752Z" fill="#F1562A" style="box-sizing: border-box"></path>
                <path d="M45.8931 5.50781H43.9722V12.8753H45.8931V5.50781Z" fill="#F78C26" style="box-sizing: border-box"></path>
                <path d="M45.8931 12.8752H43.9722V17.783H45.8931V12.8752Z" fill="#EF4624" style="box-sizing: border-box"></path>
                <path
                  d="M43.9722 12.8753H40.306V10.4156H34.1801V12.8753V5.50781H43.9722V12.8753Z"
                  fill="#F26224"
                  style="box-sizing: border-box"
                ></path>
                <path d="M43.9722 12.8752H40.306V17.783H43.9722V12.8752Z" fill="#EE3725" style="box-sizing: border-box"></path>
                <path d="M40.306 10.4158H34.1801V12.8755H40.306V10.4158Z" fill="#C54B27" style="box-sizing: border-box"></path>
                <path d="M40.306 12.8752H34.1801V17.783H40.306V12.8752Z" fill="#C32D27" style="box-sizing: border-box"></path>
                <path d="M34.1801 17.783H24.3646V20.2427H34.1801V17.783Z" fill="#C32D27" style="box-sizing: border-box"></path>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="80"
                height="36"
                viewBox="0 0 80 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <path
                  d="M25.1266 26.9749V17.043H26.6251V25.6849H31.1255V26.9749H25.1266ZM35.4321 17.043H37.1343L39.7288 21.5579H39.8355L42.43 17.043H44.1322L40.529 23.0759V26.9749H39.0354V23.0759L35.4321 17.043ZM49.644 26.9749V17.043H53.1842C53.9536 17.043 54.5921 17.1756 55.0997 17.4407C55.6105 17.7058 55.992 18.0727 56.2442 18.5415C56.4964 19.0071 56.6224 19.5454 56.6224 20.1564C56.6224 20.7642 56.4948 21.2993 56.2394 21.7616C55.9872 22.2207 55.6057 22.5779 55.0949 22.8334C54.5872 23.0888 53.9487 23.2165 53.1793 23.2165H50.4975V21.9265H53.0435C53.5284 21.9265 53.9229 21.857 54.2268 21.718C54.5339 21.579 54.7587 21.3769 54.9009 21.1118C55.0431 20.8467 55.1142 20.5282 55.1142 20.1564C55.1142 19.7814 55.0415 19.4564 54.8961 19.1816C54.7538 18.9068 54.5291 18.6967 54.222 18.5512C53.918 18.4025 53.5187 18.3282 53.0241 18.3282H51.1425V26.9749H49.644ZM54.5468 22.4939L57.0007 26.9749H55.2937L52.8883 22.4939H54.5468ZM64.0413 17.043V26.9749H62.5428V17.043H64.0413ZM73.5357 26.9749H70.3205V17.043H73.6376C74.6107 17.043 75.4465 17.2419 76.1448 17.6395C76.8431 18.0339 77.3782 18.6013 77.7501 19.3417C78.1249 20.0788 78.3123 20.963 78.3123 21.9944C78.3123 23.029 78.1233 23.9181 77.7454 24.6616C77.3702 25.4053 76.827 25.9775 76.1157 26.3784C75.4044 26.776 74.5445 26.9749 73.5357 26.9749ZM71.819 25.6655H73.4533C74.2098 25.6655 74.8387 25.5233 75.3398 25.2387C75.8409 24.951 76.2159 24.5356 76.4649 23.9924C76.7139 23.446 76.8383 22.7801 76.8383 21.9944C76.8383 21.2153 76.7139 20.5541 76.4649 20.0109C76.2191 19.4678 75.8522 19.0556 75.364 18.7743C74.8758 18.493 74.2697 18.3524 73.5454 18.3524H71.819V25.6655Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M3.90308 31.8449L13.9883 13.2518L23.8911 12.53L33.6817 9.232L26.1082 4.5498L23.8901 12.531L16.0445 30.1359L3.90308 31.8449Z"
                  stroke="#6F36BC"
                  stroke-width="1.5"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M25.9863 5.94283C27.0637 5.94283 27.9372 5.06938 27.9372 3.99192C27.9372 2.91446 27.0637 2.04102 25.9863 2.04102C24.9088 2.04102 24.0354 2.91446 24.0354 3.99192C24.0354 5.06938 24.9088 5.94283 25.9863 5.94283Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M25.9861 5.69875C26.9289 5.69875 27.6931 4.93448 27.6931 3.99171C27.6931 3.04894 26.9289 2.28467 25.9861 2.28467C25.0434 2.28467 24.2791 3.04894 24.2791 3.99171C24.2791 4.93448 25.0434 5.69875 25.9861 5.69875Z"
                  stroke="#6F36BC"
                  stroke-width="1.6"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M33.7899 10.82C34.8674 10.82 35.7408 9.94656 35.7408 8.86916C35.7408 7.79168 34.8674 6.91821 33.7899 6.91821C32.7124 6.91821 31.839 7.79168 31.839 8.86916C31.839 9.94656 32.7124 10.82 33.7899 10.82Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M33.7897 10.576C34.7325 10.576 35.4968 9.81171 35.4968 8.86895C35.4968 7.9262 34.7325 7.16187 33.7897 7.16187C32.847 7.16187 32.0827 7.9262 32.0827 8.86895C32.0827 9.81171 32.847 10.576 33.7897 10.576Z"
                  stroke="#6F36BC"
                  stroke-width="1.6"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M3.5509 33.2553C4.62836 33.2553 5.50181 32.3819 5.50181 31.3045C5.50181 30.227 4.62836 29.3535 3.5509 29.3535C2.47346 29.3535 1.60001 30.227 1.60001 31.3045C1.60001 32.3819 2.47346 33.2553 3.5509 33.2553Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M3.55094 33.0117C4.49371 33.0117 5.25798 32.2475 5.25798 31.3047C5.25798 30.3619 4.49371 29.5977 3.55094 29.5977C2.60817 29.5977 1.8439 30.3619 1.8439 31.3047C1.8439 32.2475 2.60817 33.0117 3.55094 33.0117Z"
                  stroke="#6F36BC"
                  stroke-width="1.6"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M15.2564 32.28C16.3338 32.28 17.2072 31.4065 17.2072 30.329C17.2072 29.2516 16.3338 28.3782 15.2564 28.3782C14.1789 28.3782 13.3054 29.2516 13.3054 30.329C13.3054 31.4065 14.1789 32.28 15.2564 32.28Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M15.2563 32.0362C16.199 32.0362 16.9633 31.2718 16.9633 30.3291C16.9633 29.3863 16.199 28.6221 15.2563 28.6221C14.3135 28.6221 13.5493 29.3863 13.5493 30.3291C13.5493 31.2718 14.3135 32.0362 15.2563 32.0362Z"
                  stroke="#6F36BC"
                  stroke-width="1.6"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M14.2808 15.6972C15.3582 15.6972 16.2317 14.8238 16.2317 13.7464C16.2317 12.6689 15.3582 11.7954 14.2808 11.7954C13.2033 11.7954 12.3299 12.6689 12.3299 13.7464C12.3299 14.8238 13.2033 15.6972 14.2808 15.6972Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M14.2808 15.4534C15.2235 15.4534 15.9878 14.6891 15.9878 13.7463C15.9878 12.8036 15.2235 12.0393 14.2808 12.0393C13.3379 12.0393 12.5737 12.8036 12.5737 13.7463C12.5737 14.6891 13.3379 15.4534 14.2808 15.4534Z"
                  stroke="#6F36BC"
                  stroke-width="1.6"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M23.06 14.7216C24.1375 14.7216 25.0109 13.8482 25.0109 12.7707C25.0109 11.6933 24.1375 10.8198 23.06 10.8198C21.9825 10.8198 21.1091 11.6933 21.1091 12.7707C21.1091 13.8482 21.9825 14.7216 23.06 14.7216Z"
                  fill="#6F36BC"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M23.0599 14.4777C24.0026 14.4777 24.767 13.7135 24.767 12.7707C24.767 11.828 24.0026 11.0637 23.0599 11.0637C22.1171 11.0637 21.3529 11.828 21.3529 12.7707C21.3529 13.7135 22.1171 14.4777 23.0599 14.4777Z"
                  stroke="#6F36BC"
                  stroke-width="1.6"
                  style="box-sizing: border-box"
                ></path>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="80"
                height="34"
                viewBox="0 0 80 34"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <path
                  d="M70.2005 14.196H76.2578V0.119629H69.6674V2.07985L68.42 0.119629H62.7176V2.61445L61.6499 0.119629H51.1376C50.7812 0.119629 50.4248 0.299393 50.07 0.299393C49.7136 0.299393 49.5338 0.477595 49.1789 0.654233C48.8225 0.833998 48.6428 0.833998 48.2879 1.01064V0.119629H18.1734L17.2824 2.43625L16.3914 0.119629H9.26492V2.61445L8.19727 0.119629H2.49482L0 6.17848V14.196H4.09707L4.80988 12.2358H6.23549L6.9483 14.196H38.3055V12.414L39.5529 14.196H48.2832V13.1252C48.4614 13.305 48.8179 13.305 48.9945 13.4816C49.1743 13.6614 49.5291 13.6614 49.7073 13.838C50.0637 14.0162 50.4185 14.0162 50.7749 14.0162H57.1949L57.9061 12.0576H59.3317L60.0446 14.0162H68.7749V12.2342L70.2005 14.196ZM80 32.013V18.8277H31.0024L29.755 20.6097L28.5076 18.8277H14.2546V32.904H28.5076L29.755 31.122L31.0024 32.904H39.9109V29.8746H39.5545C40.8019 29.8746 41.8711 29.6964 42.7606 29.34V33.0807H49.1758V31.2986L50.4217 33.0807H76.9706C78.0382 32.7243 79.109 32.5476 80 32.013Z"
                  fill="#F4F4F5"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M76.9706 28.6273H72.1591V30.5875H76.7924C78.751 30.5875 79.9984 29.3401 79.9984 27.5581C79.9984 25.7761 78.9277 24.8851 77.1472 24.8851H75.0104C74.4742 24.8851 74.1193 24.5287 74.1193 23.9941C74.1193 23.4595 74.4742 23.1031 75.0104 23.1031H79.1074L79.9984 21.1429H75.187C73.2283 21.1429 71.9809 22.3903 71.9809 23.9941C71.9809 25.7761 73.0486 26.6671 74.8306 26.6671H76.969C77.5036 26.6671 77.86 27.0235 77.86 27.5581C78.0382 28.2709 77.6834 28.6273 76.9706 28.6273ZM68.2387 28.6273H63.4288V30.5875H68.0605C70.0191 30.5875 71.2666 29.3401 71.2666 27.5581C71.2666 25.7761 70.1989 24.8851 68.4169 24.8851H66.2785C65.7439 24.8851 65.3875 24.5287 65.3875 23.9941C65.3875 23.4595 65.7439 23.1031 66.2785 23.1031H70.3755L71.2666 21.1429H66.4551C64.4965 21.1429 63.2491 22.3903 63.2491 23.9941C63.2491 25.7761 64.3198 26.6671 66.1003 26.6671H68.2371C68.7733 26.6671 69.1281 27.0235 69.1281 27.5581C69.3095 28.2709 68.7749 28.6273 68.2387 28.6273ZM62.0032 22.9249V20.9662H54.5219V30.4093H62.0032V28.4507H56.6587V26.4905H61.8266V24.5318H56.6587V22.7498H62.0032V22.9249ZM49.8886 22.9249C50.7796 22.9249 51.136 23.461 51.136 23.9956C51.136 24.5302 50.7796 25.0633 49.8886 25.0633H47.2156V22.7467L49.8886 22.9249ZM47.2156 27.0251H48.2864L51.136 30.4093H53.8091L50.603 26.8453C52.2052 26.4889 53.0963 25.4197 53.0963 23.9956C53.0963 22.2136 51.8504 20.9662 49.8902 20.9662H44.9021V30.4093H47.0405L47.2156 27.0251ZM41.5131 24.1723C41.5131 24.8851 41.1583 25.4197 40.2673 25.4197H37.4161V22.9249H40.0891C40.9801 22.9249 41.5131 23.461 41.5131 24.1723ZM35.2777 20.9662V30.4093H37.4161V27.2033H40.2673C42.226 27.2033 43.6516 25.9559 43.6516 23.9972C43.6516 22.2152 42.4042 20.7911 40.4455 20.7911L35.2777 20.9662ZM32.0716 30.4093H34.7446L31.0039 25.5979L34.7446 20.9662H32.0716L29.755 23.9956L27.4384 20.9662H24.7653L28.506 25.5979L24.7653 30.2311H27.4384L29.755 27.2017L32.0716 30.4093ZM24.0541 22.9249V20.9662H16.5712V30.4093H24.0541V28.4507H18.7096V26.4905H23.8774V24.5318H18.7096V22.7498H24.0541V22.9249ZM67.3493 6.17861L71.0915 11.8811H73.7645V2.43638H71.6261V8.67187L71.0915 7.78086L67.7057 2.43638H64.856V11.8811H66.9944V5.4658L67.3493 6.17861ZM58.0843 5.99885L58.7956 4.04019L59.5084 5.99885L60.3994 8.13726H57.1949L58.0843 5.99885ZM61.8266 11.8795H64.1432L60.0461 2.43481H57.1949L53.0963 11.8795H55.4144L56.3054 9.91928H60.9371L61.8266 11.8795ZM51.8488 11.8795L52.7398 9.91928H52.2037C50.6014 9.91928 49.7104 8.85163 49.7104 7.24626V7.06806C49.7104 5.46424 50.6014 4.39503 52.2037 4.39503H54.5219V2.43481H52.027C49.1774 2.43481 47.572 4.39503 47.572 7.06806V7.24626C47.572 10.099 49.1758 11.8795 51.8488 11.8795ZM43.8313 11.8795H45.9682V2.61458H43.8313V11.8795ZM39.1981 4.3966C40.0891 4.3966 40.4455 4.9312 40.4455 5.46424C40.4455 5.99728 40.0891 6.53501 39.1981 6.53501H36.5251V4.21683L39.1981 4.3966ZM36.5251 8.49367H37.5958L40.4455 11.8795H43.1185L39.9125 8.31547C41.5147 7.95906 42.4057 6.88829 42.4057 5.46424C42.4057 3.68223 41.1599 2.43481 39.1997 2.43481H34.2116V11.8795H36.35L36.5251 8.49367ZM32.6046 4.3966V2.43638H25.1233V11.8811H32.6046V9.92084H27.2601V7.96219H32.428V6.00197H27.2601V4.21996H32.6046V4.3966ZM16.393 11.8795H18.3516L21.0247 4.21683V11.8795H23.1631V2.43481H19.599L17.4606 8.85007L15.3238 2.43481H11.7597V11.8795H13.8966V4.21683L16.393 11.8795ZM4.81144 5.99885L5.52425 4.04019L6.23549 5.99885L7.1265 8.13726H3.92043L4.81144 5.99885ZM8.55211 11.8795H10.8703L6.77166 2.43481H4.09864L0 11.8795H2.31662L3.20763 9.91928H7.84087L8.55211 11.8795Z"
                  fill="#006FCF"
                  style="box-sizing: border-box"
                ></path>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="80"
                height="18"
                viewBox="0 0 80 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <g clip-path="url(#clip0_80_1012)" style="box-sizing: border-box">
                  <path
                    d="M8.54186 0.0583496C3.82879 0.0583496 0 3.88714 0 8.60021C0 13.3133 3.82879 17.1421 8.54186 17.1421C13.2549 17.1421 17.0837 13.3133 17.0837 8.60021C17.0837 3.88714 13.2549 0.0583496 8.54186 0.0583496ZM8.54186 16.286C4.29915 16.286 0.856068 12.8335 0.856068 8.60021C0.856068 4.36691 4.29915 0.914417 8.54186 0.914417C12.7846 0.914417 16.2277 4.36691 16.2277 8.60021C16.2277 12.8335 12.7846 16.286 8.54186 16.286Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M11.5898 3.12515C11.5616 3.10634 11.524 3.09693 11.4863 3.09693C11.3735 3.09693 11.2888 3.1816 11.2888 3.29448V5.96617C11.2888 6.06024 11.2135 6.1355 11.1195 6.1355H5.94542C5.85135 6.1355 5.7855 6.06024 5.77609 5.96617V3.29448C5.77609 3.25686 5.76668 3.22863 5.74787 3.191C5.69143 3.09693 5.56913 3.06871 5.47506 3.12515C3.56537 4.30107 2.40826 6.34246 2.40826 8.60022C2.40826 10.858 3.56537 12.8994 5.49387 14.0753C5.52209 14.0941 5.55972 14.1035 5.59735 14.1035C5.71024 14.1035 5.79491 14.0188 5.79491 13.906V11.2343C5.79491 11.1402 5.87017 11.0744 5.96424 11.0649H11.1383C11.2323 11.0649 11.3076 11.1402 11.3076 11.2343V13.906C11.3076 13.9436 11.317 13.9718 11.3358 14.0094C11.3923 14.1035 11.5146 14.1317 11.6086 14.0753C13.5371 12.8994 14.6942 10.858 14.6942 8.60022C14.6942 6.34246 13.5183 4.30107 11.5898 3.12515ZM4.79773 11.9492L4.82595 12.2691L4.61899 12.0151C3.02915 10.0113 3.02915 7.17971 4.61899 5.17595L4.79773 4.95018L4.82595 4.92195L4.79773 5.25121C4.76951 5.51462 4.7601 5.78743 4.7601 6.06024V11.1308C4.7601 11.4036 4.77891 11.6764 4.79773 11.9492ZM11.2888 9.87962C11.2888 9.97369 11.2135 10.049 11.1195 10.049H5.94542C5.85135 10.049 5.7855 9.97369 5.77609 9.87962V7.32082C5.77609 7.22675 5.85135 7.15149 5.94542 7.15149H11.1195C11.2135 7.15149 11.2888 7.22675 11.2888 7.32082V9.87962ZM12.4553 12.0151L12.2483 12.2691L12.2766 11.9492C12.3048 11.6858 12.3142 11.413 12.3142 11.1402V6.06024C12.3142 5.78743 12.3048 5.51462 12.2766 5.25121L12.2672 5.1101L12.2577 4.95958V4.92195L12.4553 5.17595C13.2267 6.1355 13.65 7.35845 13.65 8.59082C13.65 9.82318 13.2267 11.0555 12.4553 12.0151Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M29.9718 8.44975C29.9248 8.43094 29.8683 8.41213 29.8683 8.35568C29.8683 8.31805 29.8871 8.28983 29.9248 8.27102C29.9906 8.24279 31.6181 7.65954 31.6181 5.74044C31.6181 3.60498 30.1788 2.33499 27.7517 2.33499H21.8721V14.8844H28.2879C30.1599 14.8844 32.1731 13.5579 32.1731 11.4225C32.1731 9.38108 30.6303 8.66612 29.9718 8.44975ZM24.8354 4.90319C24.8354 4.85615 24.873 4.81852 24.92 4.81852H27.2531C28.0245 4.81852 28.5513 5.33593 28.5513 6.10733C28.5513 6.7094 28.0809 7.3585 27.1966 7.3585H24.92C24.873 7.3585 24.8354 7.32087 24.8354 7.27384V4.90319ZM27.2531 12.4102H24.92C24.873 12.4102 24.8354 12.3726 24.8354 12.3256V9.82323C24.8354 9.77619 24.873 9.73856 24.92 9.73856H27.1966C28.3161 9.73856 28.9558 10.2183 28.9558 11.065C28.9558 11.9399 28.3631 12.4102 27.2531 12.4102ZM52.032 7.33028L51.5804 7.23621C50.5645 7.01984 49.5767 6.74703 49.5767 5.87214C49.5767 4.99726 50.3951 4.60215 51.2042 4.60215C52.1543 4.60215 53.095 5.02548 53.81 5.75926L55.6726 3.91542C54.873 3.03113 53.4525 2.01514 51.1571 2.01514C48.3914 2.01514 46.5287 3.58616 46.5287 5.92859C46.5287 8.40272 48.476 9.33404 50.1129 9.68212L50.555 9.77619C52.1449 10.1149 52.8975 10.3689 52.8975 11.272C52.8975 12.081 52.1731 12.6172 51.1007 12.6172C49.8401 12.6172 48.7206 12.0622 47.874 11.018L45.9643 12.89C46.9803 14.0942 48.3255 15.1854 51.1383 15.1854C53.5372 15.1854 55.9737 13.7931 55.9737 11.1214C55.9643 8.3839 54.1016 7.76302 52.032 7.33028ZM76.8203 2.33499V6.92577C76.8203 6.9728 76.7827 7.01043 76.7357 7.01043H72.8787C72.8316 7.01043 72.794 6.9728 72.794 6.92577V2.33499H69.6331V14.8844H72.794V9.95493C72.794 9.90789 72.8316 9.87026 72.8787 9.87026H76.7357C76.7827 9.87026 76.8203 9.90789 76.8203 9.95493V14.8844H80V2.33499H76.8203ZM63.2738 12.3162C61.8533 12.3162 60.3199 11.1308 60.3199 8.52501C60.3199 6.14496 61.7592 4.90319 63.1797 4.90319C64.2145 4.90319 64.9389 5.33593 65.5127 6.29548L67.9398 4.68682C66.698 2.8618 65.2211 2.03395 63.1609 2.03395C59.1251 2.03395 57.3189 5.2983 57.3189 8.52501C57.3189 12.4479 59.7084 15.1854 63.1232 15.1854C65.6632 15.1854 66.8203 14.2541 68.0339 12.5325L65.588 10.8863C65.0423 11.7705 64.4497 12.3162 63.2738 12.3162ZM39.2756 2.01514C35.8232 2.01514 33.5089 4.6586 33.5089 8.60027C33.5089 12.5419 35.8232 15.1854 39.2756 15.1854C42.7281 15.1854 45.0423 12.5419 45.0423 8.60027C45.0423 4.6586 42.7281 2.01514 39.2756 2.01514ZM39.2756 12.3162C37.5823 12.3162 36.4911 10.858 36.4911 8.60027C36.4911 6.35192 37.5823 4.90319 39.2756 4.90319C40.9784 4.90319 42.079 6.35192 42.079 8.60027C42.079 10.858 40.9784 12.3162 39.2756 12.3162Z"
                    fill="#F80000"
                    style="box-sizing: border-box"
                  ></path>
                </g>
                <defs style="box-sizing: border-box">
                  <clipPath style="box-sizing: border-box">
                    <rect
                      width="80"
                      height="17.088"
                      fill="white"
                      transform="translate(0 0.0561523)"
                      style="box-sizing: border-box"
                    ></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="120"
                height="37"
                viewBox="0 0 120 37"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <g clip-path="url(#clip0_80_1019)" style="box-sizing: border-box">
                  <path
                    d="M112.173 0.444336H115.51C116.329 0.444336 116.973 1.08097 116.973 1.89124V5.19017C116.973 6.46344 115.392 7.10008 114.514 6.17406L111.178 2.87513C110.241 2.00699 110.885 0.444336 112.173 0.444336Z"
                    fill="#53A5FF"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M104.856 8.43124H102.456C101.051 8.43124 99.9384 7.27372 99.8799 5.8847V1.83337C99.8799 1.02311 99.236 0.386475 98.4164 0.386475H95.0798C93.7919 0.386475 93.148 1.94913 94.0846 2.81727L95.3725 4.09054L97.1286 5.82682L97.1871 5.8847L97.4798 6.17408L102.221 10.862L102.631 11.2672L102.748 11.3829L104.504 13.1192L105.558 14.161C106.495 15.087 108.017 14.4503 108.017 13.1771V9.87814C108.017 9.06788 107.373 8.43124 106.553 8.43124H104.856Z"
                    fill="#FF0057"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M113.812 8.43124H111.412C110.007 8.43124 108.895 7.27372 108.836 5.8847V1.83337C108.836 1.02311 108.192 0.386475 107.373 0.386475H104.036C102.748 0.386475 102.104 1.94913 103.041 2.81727L104.329 4.09054L106.085 5.82682L106.143 5.8847L106.436 6.17408L111.178 10.862L111.587 11.2672L111.705 11.3829L113.461 13.1192L114.514 14.161C115.451 15.087 116.973 14.4503 116.973 13.1771V9.87814C116.973 9.06788 116.329 8.43124 115.51 8.43124H113.812Z"
                    fill="#A34EFF"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M35.1369 22.3793H37.654V24.5786H39.6443V26.3149H37.654V30.5977C37.654 31.3501 38.1224 31.871 38.8833 31.871C39.2931 31.871 39.5273 31.8131 39.5858 31.8131V33.3179C39.4687 33.3758 38.7663 33.6073 37.8297 33.6073C35.7808 33.6073 35.1369 32.2761 35.1369 30.6556V22.3793ZM58.4936 24.5786H55.9764V33.3179H58.5521V28.0512C58.5521 27.0094 59.1375 26.3149 60.1326 26.3149C61.2448 26.3149 61.7131 27.1251 61.7131 28.0512V33.3179H64.2888V27.4724C64.2888 25.6782 63.2937 24.2892 61.1278 24.2892C59.3716 24.2892 58.7862 25.331 58.6106 25.6204H58.5521L58.4936 24.5786ZM55.0984 24.3471C52.8154 24.3471 52.2885 25.6204 52.1129 26.0255H52.0544V24.5786H49.7714V33.3179H52.3471V28.9772C52.3471 27.1252 53.6349 26.3149 55.1569 26.3149V24.3471H55.0984ZM32.21 27.0673L33.8491 25.9676C33.6149 25.6204 32.7954 24.3471 30.2197 24.3471C28.3465 24.3471 26.766 25.331 26.766 27.0094C26.766 28.5721 27.9367 29.3244 29.2246 29.7296C29.6343 29.8453 29.9856 29.9611 30.3368 30.0768C31.0393 30.3083 31.5661 30.482 31.5661 31.0028C31.5661 31.4659 31.0393 31.8131 30.1026 31.8131C28.9319 31.8131 28.3465 31.1186 28.1709 30.8292L26.4148 31.7552C26.5904 32.1604 27.527 33.6073 30.2197 33.6073C32.2686 33.6073 34.0247 32.7391 34.0247 30.8292C34.0247 29.2087 32.8539 28.5142 31.5076 28.0512C31.1563 27.9354 30.8051 27.8197 30.5124 27.7618C29.8685 27.5882 29.2246 27.4145 29.2246 26.8358C29.2246 26.4306 29.6343 26.1413 30.3953 26.1413C31.6246 26.1413 32.0344 26.8358 32.21 27.0673ZM15.4096 20.7588L13.1266 29.7296L10.7851 20.7588H7.62408L5.22402 29.9611L2.8825 20.7588H0.189758L3.46788 33.3179H6.80455L9.14606 24.405L11.429 33.3179H14.5901L17.8682 20.7588H15.4096ZM25.8879 28.9772C25.8879 26.6621 24.483 24.3471 21.4976 24.3471C18.8048 24.3471 17.1072 26.3728 17.1072 28.9772C17.1072 31.5816 18.8048 33.6073 21.6146 33.6073C24.0732 33.6073 25.0684 32.1604 25.3025 31.6395L23.6049 30.6556C23.4879 30.8871 23.0781 31.7552 21.6732 31.7552C20.561 31.7552 19.8 30.8871 19.6829 29.6717H25.9465C25.8879 29.7296 25.8879 28.9772 25.8879 28.9772ZM19.6829 27.9933C19.8 27.0094 20.3268 26.1413 21.5561 26.1413C22.6683 26.1413 23.3122 26.9515 23.3708 27.9933H19.6829ZM48.6006 28.9772C48.6006 26.6621 47.1957 24.3471 44.2103 24.3471C41.5176 24.3471 39.82 26.3728 39.82 28.9772C39.82 31.5816 41.5176 33.6073 44.3274 33.6073C46.786 33.6073 47.7811 32.1604 48.0153 31.6395L46.3177 30.6556C46.2006 30.8871 45.7908 31.7552 44.3859 31.7552C43.2737 31.7552 42.5127 30.8871 42.3956 29.6717H48.6592C48.6006 29.7296 48.6006 28.9772 48.6006 28.9772ZM42.3371 27.9933C42.4542 27.0094 42.981 26.1413 44.2103 26.1413C45.3225 26.1413 45.9664 26.9515 46.025 27.9933H42.3371ZM99.6457 22.3793H102.163V24.5786H104.153V26.3149H102.163V30.5977C102.163 31.3501 102.631 31.871 103.392 31.871C103.802 31.871 104.036 31.8131 104.095 31.8131V33.3179C103.978 33.3758 103.275 33.6073 102.338 33.6073C100.29 33.6073 99.6457 32.2761 99.6457 30.6556V22.3793ZM73.4207 20.7588H69.0889V33.3179H73.4207C77.4599 33.3179 79.8599 31.408 79.8599 27.0094C79.8599 22.6687 77.4013 20.7588 73.4207 20.7588ZM73.2451 31.2343H71.7817V22.8423H73.2451C76.5232 22.8423 77.0501 25.0416 77.0501 27.0094C77.0501 29.0351 76.5818 31.2343 73.2451 31.2343ZM114.339 20.7588H116.973V33.3179H114.339V20.7588ZM91.1577 24.5786V25.5625H91.0992C90.9236 25.2731 90.3382 24.3471 88.6991 24.3471C86.0064 24.3471 85.0113 26.5464 85.0113 28.7457C85.0113 31.0028 86.0064 33.1443 88.6991 33.1443C90.3967 33.1443 90.9821 32.1604 91.0992 31.9289H91.1577V32.9128C91.1577 34.1281 90.2797 34.8805 89.2845 34.8805C88.1138 34.8805 87.5284 34.1281 87.3528 33.8388C87.1186 33.9545 85.6552 34.8227 85.6552 34.8227C85.8308 35.1699 86.5918 36.7904 89.4016 36.7904C92.3285 36.7904 93.7334 34.9384 93.7334 32.334V24.5786H91.1577ZM89.4016 31.2922C87.9381 31.2922 87.704 29.9032 87.704 28.7457C87.704 27.4724 88.0552 26.1991 89.4016 26.1991C90.748 26.1991 91.0992 27.4145 91.0992 28.7457C91.1577 29.9032 90.865 31.2922 89.4016 31.2922ZM108.368 24.3471C106.026 24.3471 105.148 25.5625 104.914 25.9098L106.378 27.0094C106.612 26.6621 107.197 26.1413 108.192 26.1413C109.304 26.1413 110.065 26.6621 110.065 27.646V27.8197H108.953C106.378 27.8197 104.68 28.7457 104.68 30.7713C104.68 32.4497 105.909 33.6073 107.548 33.6073C109.304 33.6073 109.948 32.6234 110.065 32.4497H110.124V33.3179H112.583V27.7618C112.583 25.331 110.592 24.3471 108.368 24.3471ZM110.065 29.8453C110.065 30.8871 109.597 31.7552 108.485 31.7552C107.724 31.7552 107.197 31.2922 107.197 30.5977C107.197 29.8453 107.724 29.3244 109.012 29.3244H110.007L110.065 29.8453ZM81.2063 24.5786H83.8405V33.3179H81.2063V24.5786Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M82.4941 23.3633C83.27 23.3633 83.899 22.7414 83.899 21.9742C83.899 21.2071 83.27 20.5852 82.4941 20.5852C81.7182 20.5852 81.0892 21.2071 81.0892 21.9742C81.0892 22.7414 81.7182 23.3633 82.4941 23.3633Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                  <path d="M95.3725 24.5786H98.0067V33.3179H95.3725V24.5786Z" fill="black" style="box-sizing: border-box"></path>
                  <path
                    d="M96.6603 23.3633C97.4362 23.3633 98.0652 22.7414 98.0652 21.9742C98.0652 21.2071 97.4362 20.5852 96.6603 20.5852C95.8844 20.5852 95.2554 21.2071 95.2554 21.9742C95.2554 22.7414 95.8844 23.3633 96.6603 23.3633Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M118.495 13.698H119.139V13.8138H118.905V14.3925H118.729V13.8138H118.495V13.698ZM119.197 13.698H119.373L119.549 14.2189L119.724 13.698H119.9V14.3925H119.783V13.9295L119.607 14.3925H119.49L119.314 13.9295V14.3925H119.197V13.698Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                </g>
                <defs style="box-sizing: border-box">
                  <clipPath style="box-sizing: border-box">
                    <rect
                      width="120"
                      height="36.7568"
                      fill="white"
                      transform="translate(0 0.22168)"
                      style="box-sizing: border-box"
                    ></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="100"
                height="27"
                viewBox="0 0 100 27"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <g clip-path="url(#clip0_80_1030)" style="box-sizing: border-box">
                  <path
                    d="M58.2007 7.78632L63.9535 5.64434L58.2007 3.44116V0.442383L68.0539 4.42035V6.86833L58.2007 10.8463V7.78632Z"
                    fill="#A100FF"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M3.79437 26.758C1.71359 26.758 0 25.7176 0 23.392V23.2696C0 20.4544 2.44798 19.4752 5.44676 19.4752H6.85434V18.9244C6.85434 17.7616 6.36475 17.0884 5.14076 17.0884C4.03917 17.0884 3.48837 17.7004 3.42717 18.5572H0.367197C0.611995 15.9869 2.63158 14.7629 5.32436 14.7629C8.07833 14.7629 10.0979 15.9257 10.0979 18.802V26.5132H6.97674V25.1668C6.36475 26.0236 5.32436 26.758 3.79437 26.758ZM6.85434 22.7188V21.6172H5.56916C3.97797 21.6172 3.18237 22.0456 3.18237 23.086V23.2084C3.18237 24.004 3.67197 24.5548 4.77356 24.5548C5.87515 24.4936 6.85434 23.8816 6.85434 22.7188ZM17.3807 26.758C14.1983 26.758 11.8727 24.7996 11.8727 20.8828V20.6992C11.8727 16.7824 14.3207 14.7017 17.3807 14.7017C20.0122 14.7017 22.1542 16.048 22.399 19.0468H19.339C19.1554 17.9452 18.5434 17.2108 17.4419 17.2108C16.0955 17.2108 15.1163 18.3124 15.1163 20.5768V20.944C15.1163 23.2696 15.9731 24.31 17.4419 24.31C18.5434 24.31 19.339 23.5144 19.5226 22.2292H22.4602C22.2766 24.922 20.5018 26.758 17.3807 26.758ZM29.3758 26.758C26.1934 26.758 23.8678 24.7996 23.8678 20.8828V20.6992C23.8678 16.7824 26.3158 14.7017 29.3758 14.7017C32.0073 14.7017 34.1493 16.048 34.3941 19.0468H31.3341C31.1505 17.9452 30.5386 17.2108 29.437 17.2108C28.0906 17.2108 27.1114 18.3124 27.1114 20.5768V20.944C27.1114 23.2696 27.9682 24.31 29.437 24.31C30.5386 24.31 31.3341 23.5144 31.5177 22.2292H34.4553C34.2717 24.922 32.4969 26.758 29.3758 26.758ZM41.4321 26.758C38.1273 26.758 35.8629 24.7996 35.8629 20.944V20.6992C35.8629 16.8436 38.2497 14.7017 41.3709 14.7017C44.2472 14.7017 46.634 16.2928 46.634 20.1484V21.556H39.1065C39.2289 23.6368 40.1469 24.4324 41.4933 24.4324C42.7173 24.4324 43.3904 23.7592 43.6353 22.9636H46.634C46.2668 25.1056 44.4308 26.758 41.4321 26.758ZM39.1677 19.414H43.4516C43.3904 17.7004 42.5949 16.966 41.3097 16.966C40.3305 17.0272 39.4125 17.578 39.1677 19.414ZM48.5924 15.0077H51.836V16.7212C52.3868 15.6197 53.5496 14.7629 55.3244 14.7629C57.4051 14.7629 58.8127 16.0481 58.8127 18.802V26.5132H55.5692V19.2916C55.5692 17.9452 55.0184 17.3332 53.8556 17.3332C52.754 17.3332 51.836 18.0064 51.836 19.4752V26.5132H48.5924V15.0077ZM64.7491 11.5193V15.0077H66.9523V17.3944H64.7491V22.8412C64.7491 23.698 65.1163 24.1264 65.9119 24.1264C66.4015 24.1264 66.7075 24.0652 67.0135 23.9428V26.452C66.6463 26.5744 65.9731 26.6968 65.1775 26.6968C62.6683 26.6968 61.5055 25.534 61.5055 23.2084V17.3944H60.1591V15.0077H61.5055V12.8657L64.7491 11.5193ZM79.0698 26.5132H75.8874V24.7996C75.3366 25.9012 74.235 26.758 72.5214 26.758C70.4406 26.758 68.9106 25.4728 68.9106 22.78V15.0077H72.1542V22.3516C72.1542 23.698 72.705 24.31 73.8066 24.31C74.9082 24.31 75.8262 23.5756 75.8262 22.168V15.0077H79.0698V26.5132ZM81.4565 15.0077H84.7001V17.1496C85.3733 15.6197 86.4749 14.8853 88.1885 14.8853V18.0676C85.9853 18.0676 84.7001 18.7408 84.7001 20.638V26.5744H81.4565V15.0077ZM94.7368 26.758C91.4321 26.758 89.1677 24.7996 89.1677 20.944V20.6992C89.1677 16.8436 91.5545 14.7017 94.6756 14.7017C97.552 14.7017 99.9388 16.2928 99.9388 20.1484V21.556H92.4725C92.5949 23.6368 93.5128 24.4324 94.8592 24.4324C96.0832 24.4324 96.7564 23.7592 97.0012 22.9636H100C99.5104 25.1056 97.7356 26.758 94.7368 26.758ZM92.4113 19.414H96.7564C96.6952 17.7004 95.8996 16.966 94.6144 16.966C93.6352 17.0272 92.7172 17.578 92.4113 19.414Z"
                    fill="black"
                    style="box-sizing: border-box"
                  ></path>
                </g>
                <defs style="box-sizing: border-box">
                  <clipPath style="box-sizing: border-box">
                    <rect
                      width="100"
                      height="26.32"
                      fill="white"
                      transform="translate(0 0.440186)"
                      style="box-sizing: border-box"
                    ></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="100"
                height="15"
                viewBox="0 0 100 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <g clip-path="url(#clip0_80_1034)" style="box-sizing: border-box">
                  <path
                    d="M38.4074 2.6648V6.42612H34.1461V2.66686H31.7963V12.5393H34.1461V8.56809H38.4095V12.5393H40.7613V2.6648H38.4074ZM49.3704 2.6648L46.9115 6.57426L44.4568 2.6648H41.6831L45.7407 9.11747V12.5372H48.0885V9.11747L52.1461 2.6648H49.3704ZM59.7016 2.6648V9.89937C59.7016 10.1751 59.4959 10.3953 59.2037 10.3953H55.4383V2.66686H53.0885V12.5393H60.0309C60.6482 12.5393 61.1461 12.3541 61.5082 11.994C61.8683 11.6319 62.0514 11.136 62.0514 10.5208V2.6648H59.7016ZM71.1728 2.6648H64.2284V12.5372H66.5741V4.8006H70.3477C70.6502 4.8006 70.8416 5.03928 70.8416 5.29443V12.5372H73.1914V4.68332C73.1914 4.06603 73.0062 3.56809 72.6502 3.20801C72.284 2.84587 71.7901 2.6648 71.1728 2.6648ZM82.3128 2.6648H75.3683V12.5372H82.3128C82.93 12.5372 83.4239 12.352 83.784 11.992C84.1481 11.6298 84.3292 11.1339 84.3292 10.5187V4.68332C84.3292 4.06603 84.1481 3.56809 83.784 3.20801C83.4239 2.84587 82.928 2.6648 82.3128 2.6648ZM81.9815 5.31295V9.88496C81.9837 9.95171 81.9724 10.0182 81.9482 10.0805C81.924 10.1427 81.8874 10.1994 81.8407 10.2471C81.7939 10.2948 81.738 10.3325 81.6763 10.358C81.6145 10.3834 81.5483 10.3961 81.4815 10.3953H77.714V4.80266H81.465C81.7737 4.80266 81.9794 5.01665 81.9794 5.31295M88.4239 2.6648C87.8066 2.6648 87.3086 2.84587 86.9486 3.20801C86.5864 3.57221 86.4074 4.06809 86.4074 4.68332V12.5372H88.749V9.48373H93.0165V12.5372H95.3642V2.6648H88.4239ZM93.0165 4.80266V7.34587H88.749V5.3006C88.749 5.0578 88.9383 4.8006 89.251 4.8006L93.0165 4.80266ZM97.6502 12.5372H100V2.6648H97.6502V12.5372ZM13.428 14.4776C20.8457 14.4776 26.8601 11.3973 26.8601 7.60101C26.8601 3.8006 20.8457 0.722412 13.428 0.722412C6.01235 0.722412 0 3.79854 0 7.60101C0 11.3973 6.01235 14.4776 13.428 14.4776ZM15.9588 11.101C15.7325 11.6216 15.3477 12.7306 14.463 13.173C14.181 13.3018 13.8757 13.3718 13.5658 13.3788H13.43C10.9527 13.3788 8.64403 13.0331 6.71399 12.4467L6.63992 12.4179C6.46091 12.3582 6.37037 12.2759 6.37037 12.173C6.37037 12.0866 6.4177 12.0187 6.48148 11.9549L6.60288 11.8479C7.05144 11.4776 8.393 10.5043 10.9218 9.53311C11.8086 9.19566 12.9198 8.77385 14.0823 8.52694C14.7634 8.38496 17.2922 7.99813 15.9568 11.1031M22.7428 4.16891C22.7901 4.08661 22.8539 4.01665 22.9691 4.01048C23.0309 4.00431 23.1173 4.01871 23.2469 4.10101C24.823 5.07015 25.7593 6.28414 25.7593 7.59896C25.7593 9.96727 22.7119 12.0064 18.3519 12.8973C18.072 12.9529 17.8848 12.9508 17.823 12.8808C17.7778 12.8397 17.7654 12.7615 17.823 12.6669C17.8555 12.6093 17.8942 12.5555 17.9383 12.5064C20.3128 9.70801 22.1214 5.57838 22.6337 4.38908C22.6749 4.30677 22.7119 4.22447 22.7428 4.16891ZM10.9403 4.08249C11.1667 3.56398 11.5514 2.45492 12.4362 2.01459C12.7037 1.88085 13.037 1.81706 13.3313 1.80883H13.465C15.9465 1.80883 18.251 2.1504 20.1852 2.74093C20.1996 2.7471 20.2449 2.76151 20.2593 2.76974C20.4362 2.82941 20.5267 2.91171 20.5267 3.01254C20.5267 3.10101 20.4794 3.16686 20.4177 3.22859C20.3889 3.25739 20.3498 3.29031 20.2942 3.33558C19.8498 3.71007 18.5062 4.68126 15.9774 5.6504C15.0864 5.9899 13.9774 6.41171 12.8189 6.65657C12.1358 6.8006 9.60494 7.18743 10.9403 4.08249ZM8.50823 2.29649C8.78807 2.24299 8.97325 2.24299 9.04115 2.31295C9.0823 2.35821 9.09259 2.43229 9.03909 2.52488C9.00545 2.58216 8.96616 2.63592 8.92181 2.68537C6.54732 5.48579 4.73868 9.61336 4.22222 10.8068C4.18519 10.8891 4.14609 10.9714 4.11317 11.0249C4.0679 11.1072 4.00412 11.1792 3.89095 11.1854C3.82922 11.1915 3.74074 11.173 3.60905 11.0928C2.03292 10.1257 1.10082 8.91171 1.10082 7.5969C1.10082 5.22653 4.14609 3.18743 8.50823 2.29854"
                    fill="#002E6B"
                    style="box-sizing: border-box"
                  ></path>
                </g>
                <defs style="box-sizing: border-box">
                  <clipPath style="box-sizing: border-box">
                    <rect
                      width="100"
                      height="14.68"
                      fill="white"
                      transform="translate(0 0.26001)"
                      style="box-sizing: border-box"
                    ></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="100"
                height="25"
                viewBox="0 0 100 25"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <g clip-path="url(#clip0_80_1037)" style="box-sizing: border-box">
                  <path
                    d="M87.826 8.71881C88.3828 8.71881 88.8411 8.42934 88.9029 8.05537L89.4526 1.83904C89.4526 1.22462 88.7328 0.720215 87.8278 0.720215C86.9237 0.720215 86.2046 1.22462 86.2046 1.83915L86.7539 8.05537C86.8143 8.42923 87.2726 8.71881 87.8279 8.71881H87.826ZM84.4663 10.6605C84.7456 10.1789 84.7245 9.63767 84.4302 9.39723L79.3207 5.81305C78.7895 5.5054 77.9929 5.87571 77.5409 6.65971C77.0873 7.44272 77.1677 8.31722 77.6975 8.62498L83.3552 11.2592C83.7088 11.3903 84.1911 11.138 84.4681 10.6568L84.4663 10.6605ZM91.1887 10.6571C91.4675 11.1384 91.9473 11.3908 92.3013 11.2596L97.959 8.62532C98.4922 8.31766 98.5679 7.44305 98.1185 6.66005C97.6642 5.87683 96.8663 5.50573 96.3365 5.81339L91.2267 9.39756C90.9345 9.63767 90.9128 10.1793 91.1905 10.6608L91.1887 10.6571ZM87.826 16.4839C88.3828 16.4839 88.8411 16.771 88.9029 17.1453L89.4526 23.3607C89.4526 23.977 88.7328 24.4803 87.8278 24.4803C86.9237 24.4803 86.2046 23.977 86.2046 23.3607L86.7539 17.1453C86.8143 16.771 87.2726 16.4839 87.8279 16.4839H87.826ZM91.1887 14.5419C91.4675 14.0593 91.9473 13.8091 92.3013 13.9417L97.959 16.5742C98.4922 16.8822 98.5679 17.7576 98.1185 18.5413C97.6642 19.3219 96.8663 19.694 96.3365 19.3868L91.2267 15.806C90.9345 15.564 90.9128 15.022 91.1905 14.5409H91.1883M84.4663 14.5412C84.7456 15.022 84.7245 15.564 84.4302 15.8064L79.3207 19.3872C78.7895 19.6944 77.9929 19.3223 77.5409 18.5416C77.0873 17.7579 77.1677 16.8825 77.6975 16.5746L83.3552 13.9421C83.7088 13.8094 84.1911 14.0596 84.4681 14.5423H84.4663"
                    fill="#FDBB30"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M55.5967 15.7947C55.5967 15.9854 55.5798 16.1822 55.5275 16.355C55.3108 17.0726 54.5677 17.6795 53.6381 17.6795C52.863 17.6795 52.2474 17.2392 52.2474 16.3093C52.2474 14.886 53.8139 14.493 55.5972 14.5028L55.5967 15.7946V15.7947ZM58.3938 13.3143C58.3938 10.9674 57.391 8.90236 54.0026 8.90236C52.2632 8.90236 50.8828 9.39091 50.1293 9.82633L50.6811 11.7131C51.3698 11.2783 52.4673 10.9184 53.5059 10.9184C55.2246 10.9137 55.5061 11.8917 55.5061 12.5177V12.6659C51.7596 12.6603 49.3913 13.9576 49.3913 16.6003C49.3913 18.2151 50.5975 19.7275 52.6943 19.7275C53.9827 19.7275 55.0618 19.2133 55.7076 18.3887H55.7714C55.7714 18.3887 56.1987 20.1789 58.5578 19.494C58.4347 18.7494 58.3943 17.9547 58.3943 16.999L58.3939 13.3143M0.0189209 5.70625C0.0189209 5.70625 2.46719 15.7382 2.85813 17.3663C3.31418 19.2667 4.13611 19.9663 6.50475 19.494L8.03338 13.2745C8.421 11.7289 8.68041 10.627 8.93017 9.0563H8.97364C9.14899 10.6436 9.39775 11.7337 9.71672 13.2796C9.71672 13.2796 10.3387 16.1033 10.6578 17.5859C10.9772 19.0681 11.8662 20.0028 14.1866 19.494L17.8292 5.70581H14.8891L13.6449 11.6674C13.3104 13.402 13.0072 14.7589 12.7732 16.3454H12.7316C12.519 14.7729 12.2483 13.4713 11.9086 11.7808L10.6143 5.70581H7.55038L6.16515 11.6277C5.7731 13.4277 5.40544 14.8806 5.17253 16.4143H5.13017C4.89106 14.9701 4.57275 13.1433 4.22828 11.4018C4.22828 11.4018 3.4059 7.1659 3.11666 5.70581L0.0189209 5.70625ZM23.3907 15.7947C23.3907 15.9854 23.3738 16.1822 23.3208 16.355C23.1045 17.0726 22.361 17.6795 21.4314 17.6795C20.6561 17.6795 20.0414 17.2392 20.0414 16.3093C20.0414 14.886 21.6075 14.493 23.3911 14.5028L23.3907 15.7946V15.7947ZM26.1875 13.3143C26.1875 10.9674 25.1847 8.90236 21.7969 8.90236C20.0571 8.90236 18.6755 9.39091 17.9225 9.82633L18.4737 11.7131C19.1622 11.2783 20.2597 10.9184 21.2987 10.9184C23.0187 10.9137 23.3001 11.8917 23.3001 12.5177V12.6659C19.552 12.6603 17.1848 13.9576 17.1848 16.6003C17.1848 18.2151 18.3904 19.7275 20.4857 19.7275C21.7758 19.7275 22.8543 19.2133 23.5009 18.3887H23.5639C23.5639 18.3887 23.9924 20.1789 26.351 19.494C26.2276 18.7494 26.1875 17.9547 26.1875 16.999V13.3143ZM30.8551 16.5671V5.70625H28.0547V19.4944H30.8551V16.5671ZM67.4894 5.70625V15.8775C67.4894 17.2805 67.7539 18.2623 68.3179 18.8632C68.8121 19.3886 69.624 19.7286 70.5978 19.7286C71.426 19.7286 72.2403 19.5706 72.6246 19.4281L72.5884 17.2403C72.3025 17.3102 71.9742 17.3668 71.5248 17.3668C70.5706 17.3668 70.2515 16.7554 70.2515 15.4965V11.6048H72.6901V8.96636H70.2515V5.70625H67.4894ZM60.2611 9.13627V19.4944H63.1499V14.1908C63.1499 13.9042 63.1672 13.6544 63.2126 13.4259C63.4263 12.3144 64.2759 11.6048 65.4962 11.6048C65.8307 11.6048 66.0701 11.6412 66.3295 11.678V8.96636C66.1118 8.92299 65.9641 8.9027 65.6933 8.9027C64.6152 8.9027 63.3887 9.5983 62.874 11.0904H62.7959V9.13627H60.2611ZM32.8159 9.13627V19.4944H35.6304V13.4204C35.6304 13.1353 35.6639 12.8339 35.7626 12.5726C35.9959 11.9611 36.565 11.2448 37.4732 11.2448C38.6095 11.2448 39.1401 12.2049 39.1401 13.5906V19.4936H41.9523V13.3456C41.9523 13.0737 41.9895 12.7458 42.0699 12.5061C42.3008 11.81 42.9139 11.2441 43.7583 11.2441C44.9097 11.2441 45.4623 12.1873 45.4623 13.8183V19.4933H48.2765V13.3923C48.2765 10.1752 46.6428 8.9017 44.7984 8.9017C43.9824 8.9017 43.3376 9.1061 42.7544 9.46344C42.2648 9.76511 41.8256 10.1925 41.4424 10.7544H41.4008C40.956 9.63812 39.9096 8.90225 38.546 8.90225C36.7943 8.90225 36.0069 9.79029 35.5294 10.5433H35.4875V9.13594H32.8159"
                    fill="#1A75CF"
                    style="box-sizing: border-box"
                  ></path>
                  <path
                    d="M99.3781 18.9908H99.4205C99.4769 18.9908 99.513 18.9675 99.513 18.9329C99.513 18.8935 99.4791 18.8721 99.4267 18.8721C99.4088 18.8721 99.3904 18.8757 99.3782 18.8757V18.9918V18.9906L99.3781 18.9908ZM99.3715 19.27H99.2219V18.7826C99.2558 18.7759 99.335 18.7641 99.4364 18.7641C99.5465 18.7641 99.5959 18.7796 99.632 18.804C99.6625 18.8253 99.6847 18.8617 99.6847 18.9108C99.6847 18.9608 99.6387 19.0032 99.5708 19.0217V19.0279C99.6262 19.0427 99.6563 19.0828 99.6722 19.1532C99.6873 19.2236 99.6966 19.2523 99.706 19.2704H99.5365C99.5218 19.2523 99.513 19.2091 99.5031 19.1661C99.4935 19.1167 99.4702 19.092 99.4202 19.092H99.3712L99.3715 19.27ZM99.4334 18.6238C99.2186 18.6238 99.0565 18.7988 99.0565 19.0219C99.0565 19.2393 99.219 19.4166 99.4393 19.4166C99.6604 19.4203 99.8229 19.2394 99.8229 19.0184C99.8229 18.7983 99.6604 18.6238 99.4367 18.6238H99.4334ZM99.443 18.4915C99.7425 18.4915 99.9813 18.7272 99.9813 19.0183C99.9813 19.3127 99.7425 19.5488 99.4389 19.5488C99.1354 19.5488 98.8936 19.3124 98.8936 19.0184C98.8936 18.7272 99.1357 18.4916 99.4389 18.4916H99.4423"
                    fill="#FDBB30"
                    style="box-sizing: border-box"
                  ></path>
                </g>
                <defs style="box-sizing: border-box">
                  <clipPath style="box-sizing: border-box">
                    <rect
                      width="100"
                      height="23.76"
                      fill="white"
                      transform="translate(0 0.720215)"
                      style="box-sizing: border-box"
                    ></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <div
            style="
              justify-content: center;
              align-items: center;
              width: 100%;
              max-width: 170px;
              height: 80px;
              display: flex;
              box-sizing: border-box;
            "
          >
            <div style="box-sizing: border-box">
              <svg
                width="84"
                height="20"
                viewBox="0 0 84 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="box-sizing: border-box; overflow: hidden"
              >
                <path
                  d="M37.2374 2.76004H39.626C40.4775 2.76004 41.1678 3.38817 41.1678 4.16297H41.2282C42.3166 3.06267 44.1911 2.34741 46.1562 2.34741C48.1212 2.34741 50.1771 3.1728 51.2353 4.38322H51.2957C52.6259 3.06267 54.5005 2.34741 56.5261 2.34741C60.8493 2.34741 63.8425 4.93329 63.8425 8.61962V17.3401H59.5191V9.25237C59.5191 7.18906 58.1886 5.9236 56.133 5.9236C53.9561 5.9236 52.6259 7.16162 52.6259 9.25237V17.3401H48.4841V9.25237C48.4841 7.18906 47.1235 5.9236 45.0981 5.9236C42.9212 5.9236 41.5607 7.16162 41.5607 9.25237V15.7444C41.5607 16.5496 40.829 17.3401 39.7619 17.3401H37.2374V2.76004Z"
                  fill="#20B55A"
                  style="box-sizing: border-box"
                ></path>
                <path
                  d="M10.7122 8.46252C7.22188 7.9419 6.34975 7.61383 6.34975 6.87446C6.34975 6.10809 7.52281 5.61551 9.38819 5.61551C11.2021 5.61551 12.7123 6.24745 13.4946 7.29321L17.6248 6.14055C16.4241 3.92537 13.1114 2.38525 9.41806 2.38525C4.99585 2.38525 2.07754 4.19203 2.07754 6.87446C2.07754 9.44771 4.18346 10.7617 9.99006 11.5833C12.9084 11.9936 13.9305 12.3769 13.9305 13.2256C13.9305 14.0191 12.6067 14.4845 10.2909 14.4845C7.71075 14.4845 6.11809 13.5589 5.48278 11.7082C5.47981 11.6995 5.46999 11.6943 5.46018 11.6964L1.29578 12.5956C2.07754 15.7437 5.56783 17.7148 10.2603 17.7148C15.0739 17.7148 18.2326 15.908 18.2326 13.1977C18.2326 10.543 16.0364 9.2289 10.7122 8.46252Z"
                  fill="#20B55A"
                  style="box-sizing: border-box"
                ></path>
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M73.3975 2.3855C69.8788 2.3855 66.9888 3.86054 65.8038 6.14335L69.9525 7.30144C70.6232 6.2665 71.9125 5.64294 73.5175 5.64294C75.2325 5.64294 76.3457 6.21781 76.3457 7.17588C76.3457 7.88794 75.5332 8.27113 72.555 8.65363C67.4713 9.28357 65.5457 10.707 65.5457 13.3896C65.5457 15.9628 67.9525 17.7144 71.5025 17.7144C73.8788 17.7144 75.9244 16.9479 76.8875 15.7161H76.9469C76.9469 16.5934 77.7288 17.304 78.6919 17.304H80.9488V8.0795C80.9488 4.54834 78.06 2.3855 73.3975 2.3855ZM76.6825 11.9208C76.6825 13.3237 74.6869 14.3966 72.1175 14.3966C70.4244 14.3966 69.6382 14.0114 69.6382 13.1311C69.6382 12.8634 69.7307 12.6336 69.9388 12.4309C70.4975 11.9896 71.4782 11.8548 73.1657 11.6227L73.3988 11.5906C74.6638 11.4126 75.7525 11.2129 76.6825 10.9829V11.9208Z"
                  fill="#20B55A"
                  style="box-sizing: border-box"
                ></path>
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M19.8333 6.14335C21.018 3.86054 23.9084 2.3855 27.4272 2.3855C32.0898 2.3855 34.9781 4.54834 34.9781 8.0795V17.304H32.7216C31.7583 17.304 30.9763 16.5934 30.9763 15.7161H30.9168C29.9542 16.9479 27.908 17.7144 25.5319 17.7144C21.9819 17.7144 19.5752 15.9628 19.5752 13.3896C19.5752 10.707 21.5011 9.28357 26.5848 8.65363C29.5628 8.27113 30.3753 7.88794 30.3753 7.17588C30.3753 6.21781 29.2619 5.64294 27.5473 5.64294C25.9423 5.64294 24.6526 6.2665 23.9823 7.30144L19.8333 6.14335ZM30.7119 11.9208C30.7119 13.3237 28.7166 14.3966 26.1468 14.3966C24.4538 14.3966 23.6675 14.0114 23.6675 13.1311C23.6675 12.8634 23.7601 12.6336 23.9683 12.4309C24.527 11.9896 25.5077 11.8548 27.195 11.6227L27.4285 11.5906C28.6932 11.4126 29.7817 11.2129 30.7119 10.9829V11.9208Z"
                  fill="#20B55A"
                  style="box-sizing: border-box"
                ></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section
      ref="ncCompareFeatureRef"
      style="gap: 16px; padding-left: 24px; padding-right: 24px; box-sizing: border-box; display: block"
    >
      <div
        style="
          flex-flow: column nowrap;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 1200px;
          padding: 120px 0px 80px;
          display: flex;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
        "
      >
        <div
          style="
            gap: 40px;
            flex-flow: column nowrap;
            justify-content: center;
            align-self: stretch;
            align-items: center;
            padding-bottom: 100px;
            display: flex;
            box-sizing: border-box;
          "
        >
          <h1
            style="
              color: rgb(16, 16, 21);
              text-align: center;
              margin-top: 0px;
              margin-bottom: 0px;
              font-size: 32px;
              line-height: 48px;
              font-weight: 700;
              box-sizing: border-box;
              margin: 0px;
            "
          >
            Compare features
          </h1>
          <h2
            style="
              color: rgb(31, 41, 58);
              text-align: center;
              max-width: 900px;
              margin-top: -12px;
              margin-bottom: 0px;
              font-size: 20px;
              font-weight: 700;
              line-height: 32px;
              box-sizing: border-box;
            "
          >
            Pick the best plan for you teams
          </h2>
          <h2
            style="
              display: none;
              color: rgb(31, 41, 58);
              text-align: center;
              max-width: 900px;
              margin-top: -12px;
              margin-bottom: 0px;
              font-size: 20px;
              font-weight: 700;
              line-height: 32px;
              box-sizing: border-box;
            "
          >
            on the desktop site.
          </h2>
        </div>
        <div style="width: 100%; box-sizing: border-box">
          <div
            style="
              z-index: 2;
              border-bottom: 1px solid rgb(231, 231, 233);
              background-color: rgb(255, 255, 255);
              justify-content: center;
              align-items: flex-end;
              margin-top: -24px;
              padding-top: 24px;
              display: flex;
              position: sticky;
              top: 0px;
              box-sizing: border-box;
            "
          >
            <div
              style="
                align-self: flex-end;
                width: 128%;
                min-height: 100%;
                gap: 12px;
                flex-flow: row nowrap;
                justify-content: center;
                align-items: flex-start;
                height: 44px;
                padding: 12px 24px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(106, 113, 132);
                  font-size: 14px;
                  font-weight: 500;
                  line-height: 20px;
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  box-sizing: border-box;
                "
              >
                Features
              </h3>
            </div>
            <div
              style="
                gap: 12px;
                flex-flow: column nowrap;
                justify-content: center;
                align-self: center;
                align-items: flex-start;
                width: 100%;
                height: 152px;
                padding: 12px 24px;
                display: flex;
                position: relative;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(31, 41, 58);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 20px;
                  line-height: 32px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Free
              </h3>
              <div
                style="
                  color: rgb(106, 113, 132);
                  width: 100%;
                  margin-bottom: 4px;
                  font-size: 12px;
                  font-weight: 500;
                  line-height: 18px;
                  box-sizing: border-box;
                "
              >
                0 $ per user / month,<br style="box-sizing: border-box" />billed annually
              </div>
              <div
                style="
                  gap: 8px;
                  color: rgb(31, 41, 58);
                  background-color: rgba(255, 255, 255, 0);
                  border-radius: 8px;
                  justify-content: flex-start;
                  align-items: center;
                  height: 32px;
                  margin-left: -12px;
                  padding-left: 12px;
                  padding-right: 12px;
                  font-weight: 600;
                  display: flex;
                  box-sizing: border-box;
                  cursor: pointer;
                "
                @click="navigateTo('/')"
              >
                <div style="box-sizing: border-box">Try now</div>
                <div style="width: 16px; height: 16px; box-sizing: border-box">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style="box-sizing: border-box; overflow: hidden"
                  >
                    <path
                      d="M3.33398 8H12.6673"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                    <path
                      d="M8 3.33325L12.6667 7.99992L8 12.6666"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
            <div
              if-id="600e36cb-f353-924b-19ce-66d135054754"
              if-element="progress-step"
              style="
                gap: 12px;
                flex-flow: column nowrap;
                justify-content: center;
                align-self: center;
                align-items: flex-start;
                width: 100%;
                height: 152px;
                padding: 12px 24px;
                display: flex;
                position: relative;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(32, 115, 153);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 20px;
                  line-height: 32px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Team
              </h3>
              <div
                style="
                  top: 18px;
                  left: 80px;
                  right: auto;
                  background-color: rgb(240, 243, 255);
                  color: rgb(41, 82, 204);
                  border-radius: 6px;
                  padding-bottom: 2px;
                  padding-left: 8px;
                  padding-right: 8px;
                  font-size: 12px;
                  font-weight: 500;
                  position: absolute;
                  padding: 4px 8px 2px;
                  line-height: 18px;
                  gap: 16px;
                  box-sizing: border-box;
                "
              >
                Popular
              </div>
              <div
                style="
                  color: rgb(106, 113, 132);
                  width: 100%;
                  margin-bottom: 4px;
                  font-size: 12px;
                  font-weight: 500;
                  line-height: 18px;
                  box-sizing: border-box;
                "
              >
                15 $ per user / month,<br style="box-sizing: border-box" />billed annually
              </div>
              <div
                style="
                  gap: 8px;
                  color: rgb(31, 41, 58);
                  background-color: rgba(255, 255, 255, 0);
                  border-radius: 8px;
                  justify-content: flex-start;
                  align-items: center;
                  height: 32px;
                  margin-left: -12px;
                  padding-left: 12px;
                  padding-right: 12px;
                  font-weight: 600;
                  display: flex;
                  box-sizing: border-box;
                  cursor: pointer;
                "
                @click="onCheckout(PlanTitles.TEAM)"
              >
                <div class="cursor-pointer" style="box-sizing: border-box">Try now</div>
                <div style="width: 16px; height: 16px; box-sizing: border-box">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style="box-sizing: border-box; overflow: hidden"
                  >
                    <path
                      d="M3.33398 8H12.6673"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                    <path
                      d="M8 3.33325L12.6667 7.99992L8 12.6666"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
            <div
              style="
                gap: 12px;
                flex-flow: column nowrap;
                justify-content: center;
                align-self: center;
                align-items: flex-start;
                width: 100%;
                height: 152px;
                padding: 12px 24px;
                display: flex;
                position: relative;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(200, 104, 39);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 20px;
                  line-height: 32px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Business
              </h3>
              <div
                style="
                  color: rgb(106, 113, 132);
                  width: 100%;
                  margin-bottom: 4px;
                  font-size: 12px;
                  font-weight: 500;
                  line-height: 18px;
                  box-sizing: border-box;
                "
              >
                30 $ per user / month,<br style="box-sizing: border-box" />billed annually
              </div>
              <div
                style="
                  gap: 8px;
                  color: rgb(31, 41, 58);
                  background-color: rgba(255, 255, 255, 0);
                  border-radius: 8px;
                  justify-content: flex-start;
                  align-items: center;
                  height: 32px;
                  margin-left: -12px;
                  padding-left: 12px;
                  padding-right: 12px;
                  font-weight: 600;
                  display: flex;
                  box-sizing: border-box;
                  cursor: pointer;
                "
                @click="onCheckout(PlanTitles.TEAM)"
              >
                <div class="cursor-pointer" style="box-sizing: border-box">Try now</div>
                <div style="width: 16px; height: 16px; box-sizing: border-box">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style="box-sizing: border-box; overflow: hidden"
                  >
                    <path
                      d="M3.33398 8H12.6673"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                    <path
                      d="M8 3.33325L12.6667 7.99992L8 12.6666"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
            <div
              style="
                gap: 12px;
                flex-flow: column nowrap;
                justify-content: center;
                align-self: center;
                align-items: flex-start;
                width: 100%;
                height: 152px;
                padding: 12px 24px;
                display: flex;
                position: relative;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(31, 41, 58);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 20px;
                  line-height: 32px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Enterprise
              </h3>
              <div
                style="
                  color: rgb(106, 113, 132);
                  width: 100%;
                  margin-bottom: 4px;
                  font-size: 12px;
                  font-weight: 500;
                  line-height: 18px;
                  box-sizing: border-box;
                "
              >
                Contact<br style="box-sizing: border-box" />‍
              </div>
              <div
                style="
                  gap: 8px;
                  color: rgb(31, 41, 58);
                  background-color: rgba(255, 255, 255, 0);
                  border-radius: 8px;
                  justify-content: flex-start;
                  align-items: center;
                  height: 32px;
                  margin-left: -12px;
                  padding-left: 12px;
                  padding-right: 12px;
                  font-weight: 600;
                  display: flex;
                  box-sizing: border-box;
                  cursor: pointer;
                "
                @click="openNewTab('https://cal.com/nocodb')"
              >
                <div style="box-sizing: border-box">Contact Us</div>
                <div style="width: 16px; height: 16px; box-sizing: border-box">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style="box-sizing: border-box; overflow: hidden"
                  >
                    <path
                      d="M3.33398 8H12.6673"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                    <path
                      d="M8 3.33325L12.6667 7.99992L8 12.6666"
                      stroke="#374151"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="box-sizing: border-box"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                General
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Bases
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit-base="Free"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit-base="Team"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit-base="Business"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit-base="Enterprise"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Records
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit_record="Free"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit_record="Team"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  100,000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit_record="Business"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  500,000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  limit_record="Enterprise"
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Editors
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  5
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  20
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Viewers
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  50
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Attachments
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1 GB
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  20 GB
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  100 GB
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1000 GB
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Record Audit
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  2 weeks
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1 year
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  2 years
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  3+ years
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Base Snapshots
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  5
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  20
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Views
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Grid
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Kanban
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Gallery
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Forms
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Calendar
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Locked View
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Personal View
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Forms
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Theme
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Email Responces
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Prefilled Forms
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Custom logo &amp; banner
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Hide NocoDB Branding
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Redirect to URL
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Input Validations
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Conditional field visibility
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Automations
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Webhooks
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  3
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Triggers / month
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  100
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  25,000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  100,000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  500,000
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Webhook Logs
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1 week
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  3 months
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  2 years
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  3+ years
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Conditional Webhooks
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Custom Payload
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Advanced
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Dynamic filters for linked records
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Aggregations
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Group Aggregations
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Extensions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Sync
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Scripts
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Share
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Custom URL
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Password Protected
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Developer Platform
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Rest API
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Swagger specification
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  API Snippets
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  API calls / month
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1,000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1,000,000
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Collaboration
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Role base permissions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Notifications
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Record Comments
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Access Control
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Table Permissions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  View Permissions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Field Permissions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Row Permissions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Custom Roles
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Integrations
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Postgress &amp; MySQL
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  10
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Open AI/ Claude/ Ollama/ Grok
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  1
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(74, 82, 104);
                    text-align: center;
                    align-self: center;
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 18px;
                    flex: 0 1 auto;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    box-sizing: border-box;
                  "
                >
                  ∞
                </div>
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Admin
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  SSO
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Admin Panel
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Workspace Audit
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  2FA
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  API Token Permissions
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
          <div style="box-sizing: border-box">
            <div
              style="
                z-index: 1;
                background-color: rgb(255, 255, 255);
                margin-top: 48px;
                padding-left: 24px;
                padding-right: 24px;
                position: sticky;
                top: 176px;
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <h3
                style="
                  color: rgb(55, 65, 81);
                  flex: 1 1 0%;
                  margin-top: 0px;
                  margin-bottom: 0px;
                  font-size: 16px;
                  line-height: 24px;
                  font-weight: 700;
                  box-sizing: border-box;
                "
              >
                Support
              </h3>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Help center and community
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Email Support
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
            <div
              style="
                border-bottom: 1px solid rgb(231, 231, 233);
                justify-content: center;
                align-items: center;
                height: 48px;
                display: flex;
                box-sizing: border-box;
              "
            >
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  width: 128%;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  height: 47px;
                  padding: 12px 24px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <div
                  style="
                    color: rgb(55, 65, 81);
                    flex: 0 1 auto;
                    align-self: center;
                    margin-top: 0px;
                    margin-bottom: 0px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 18px;
                    box-sizing: border-box;
                  "
                >
                  Priority support
                </div>
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="NoSvg"
                  loading="lazy"
                  alt="No"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
              <div
                style="
                  justify-content: flex-start;
                  align-items: center;
                  padding-left: 48px;
                  gap: 12px;
                  flex-flow: row nowrap;
                  align-self: center;
                  width: 100%;
                  height: 47px;
                  padding: 12px 24px 12px 48px;
                  display: flex;
                  box-sizing: border-box;
                "
              >
                <img
                  :src="YesSvg"
                  loading="lazy"
                  alt="Yes"
                  style="
                    max-width: 100%;
                    display: block;
                    vertical-align: middle;
                    box-sizing: border-box;
                    border: 0px none rgb(51, 51, 51);
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
a {
  text-decoration: none !important;
}
</style>
