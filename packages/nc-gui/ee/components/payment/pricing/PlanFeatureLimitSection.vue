<script setup lang="ts">
import { type PlanFeatureAndLimitsItemType } from '#imports'
import YesSvg from '~/assets/img/yes.svg'

defineProps<PlanFeatureAndLimitsItemType>()
</script>

<template>
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
</template>
