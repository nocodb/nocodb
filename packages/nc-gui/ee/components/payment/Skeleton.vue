<script lang="ts" setup></script>

<template>
  <div class="LOADING-container is-embedded LOADING-double">
    <div class="LOADING-checkoutContainer">
      <div>
        <div class="LOADING-checkoutOverview">
          <div class="LOADING-productSummary">
            <div>
              <div class="LOADING-productTitle LOADING-loads"></div>
              <div class="LOADING-productPrice LOADING-loads"></div>
            </div>
            <div class="LOADING-productImageContainer"><div class="LOADING-productImage LOADING-loads"></div></div>
            <div class="LOADING-lineItem">
              <div class="LOADING-lineItem-image LOADING-loads"></div>
              <div class="LOADING-lineItem-lines">
                <div class="LOADING-lineItem-line LOADING-loads"></div>
                <div class="LOADING-lineItem-line LOADING-loads"></div>
              </div>
            </div>
            <div class="LOADING-lineItem">
              <div class="LOADING-lineItem-image LOADING-loads"></div>
              <div class="LOADING-lineItem-lines">
                <div class="LOADING-lineItem-line LOADING-loads"></div>
                <div class="LOADING-lineItem-line LOADING-loads"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="LOADING-checkoutPayment">
          <div class="LOADING-paymentTitle LOADING-loads"></div>
          <div class="LOADING-payment-oneRow LOADING-mb38 LOADING-loads"></div>
          <div class="LOADING-paymentHeader LOADING-loads is-hidden"></div>
          <div class="LOADING-payment-twoRow LOADING-mb38 LOADING-loads"></div>
          <div class="LOADING-payment-oneRow LOADING-mb38 LOADING-loads"></div>
          <div class="LOADING-payment-twoRow LOADING-mb24 LOADING-loads"></div>
          <div class="LOADING-payment-link LOADING-loads"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@-webkit-keyframes placeload {
  0% {
    -webkit-transform: translateX(-100%);
    transform: translateX(-100%);
  }

  to {
    -webkit-transform: translateX(100%);
    transform: translateX(100%);
  }
}

@keyframes placeload {
  0% {
    -webkit-transform: translateX(-100%);
    transform: translateX(-100%);
  }

  to {
    -webkit-transform: translateX(100%);
    transform: translateX(100%);
  }
}

@-webkit-keyframes exit {
  0% {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes exit {
  0% {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@-webkit-keyframes enter {
  0% {
    opacity: 0.1;
    -webkit-transform: scale(0.97);
    transform: scale(0.97);
  }

  to {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
}

@keyframes enter {
  0% {
    opacity: 0.1;
    -webkit-transform: scale(0.97);
    transform: scale(0.97);
  }

  to {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
}

@-webkit-keyframes enter-form-mobile {
  0% {
    opacity: 0.1;
    -webkit-transform: translateY(1rem);
    transform: translateY(1rem);
  }

  to {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }
}

@keyframes enter-form-mobile {
  0% {
    opacity: 0.1;
    -webkit-transform: translateY(1rem);
    transform: translateY(1rem);
  }

  to {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }
}

@-webkit-keyframes enter-form-desktop {
  0% {
    opacity: 0.1;
    -webkit-transform: translateX(1.5rem);
    transform: translateX(1.5rem);
  }

  to {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }
}

@keyframes enter-form-desktop {
  0% {
    opacity: 0.1;
    -webkit-transform: translateX(1.5rem);
    transform: translateX(1.5rem);
  }

  to {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }
}

@-webkit-keyframes enter-background-shadow {
  0% {
    opacity: 0.1;
    -webkit-transform: scaleX(0.9);
    transform: scaleX(0.9);
  }

  to {
    opacity: 1;
    -webkit-transform: scaleX(1);
    transform: scaleX(1);
  }
}

@keyframes enter-background-shadow {
  0% {
    opacity: 0.1;
    -webkit-transform: scaleX(0.9);
    transform: scaleX(0.9);
  }

  to {
    opacity: 1;
    -webkit-transform: scaleX(1);
    transform: scaleX(1);
  }
}

@-webkit-keyframes spin {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }

  to {
    -webkit-transform: rotate(1turn);
    transform: rotate(1turn);
  }
}

@keyframes spin {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }

  to {
    -webkit-transform: rotate(1turn);
    transform: rotate(1turn);
  }
}

.LOADING-loads {
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 7px;
  overflow: hidden;
  position: relative;
}

.LOADING-loads:after {
  -webkit-animation: placeload 1.3s linear infinite forwards;
  animation: placeload 1.3s linear infinite forwards;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.65) 50%, rgba(255, 255, 255, 0));
  content: '';
  -webkit-transform: translateX(-100%);
  -ms-transform: translateX(-100%);
  transform: translateX(-100%);
  width: 200%;
}

.LOADING-container,
.LOADING-loads:after {
  height: 100%;
  left: 0;
  position: absolute;
  top: 0;
}

.LOADING-container {
  -webkit-animation: enter 0.3s 0s;
  animation: enter 0.3s 0s;
  -webkit-animation-fill-mode: both;
  animation-fill-mode: both;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  padding: 0 16px;
  pointer-events: none;
  right: 0;
  z-index: 9999999;
}

.LOADING-container.is-embedded {
  display: block;
  height: auto;
}

.LOADING-container.is-custom-domain {
  padding: 16px;
}

@media only screen and (min-width: 1024px) {
  .LOADING-container.is-custom-domain {
    -webkit-transform: translateY(max(0px, calc(50vh - 600px)));
    -ms-transform: translateY(max(0px, calc(50vh - 600px)));
    transform: translateY(max(0px, calc(50vh - 600px)));
  }
}

.LOADING-container.is-hidden {
  display: none;
}

.LOADING-hidden {
  -webkit-animation: exit 0.3s;
  animation: exit 0.3s;
  -webkit-animation-fill-mode: both;
  animation-fill-mode: both;
}

.LOADING-checkoutContainer {
  box-sizing: border-box;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-direction: column;
  -ms-flex-direction: column;
  flex-direction: column;
  margin: 0 auto;
  max-width: 380px;
  padding: 16px 0;
  position: relative;
  width: 100%;
}

.LOADING-container.is-embedded .LOADING-checkoutContainer {
  margin-top: 43px;
  padding: 0 47px 0 32px;
}

.LOADING-container.is-embedded.LOADING-container--single .LOADING-checkoutContainer {
  margin-top: -34px;
}

.LOADING-header {
  min-height: 32px;
}

.LOADING-backArrow,
.LOADING-header {
  -ms-flex-align: center;
  -webkit-align-items: center;
  align-items: center;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
}

.LOADING-backArrow {
  -ms-flex-pack: center;
  color: rgba(0, 0, 0, 0.2);
  height: 32px;
  -webkit-justify-content: center;
  justify-content: center;
  margin-right: 8px;
  width: 14px;
}

.LOADING-logo {
  border-radius: 100%;
  height: 28px;
  width: 28px;
}

.LOADING-productSummary {
  -ms-flex-align: center;
  -webkit-align-items: center;
  align-items: center;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-direction: column;
  -ms-flex-direction: column;
  flex-direction: column;
  margin-bottom: 10px;
  margin-top: 32px;
}

.LOADING-productTitle {
  -ms-flex-order: 2;
  border-radius: 20px;
  height: 16px;
  margin: 2px 0;
  -webkit-order: 2;
  order: 2;
  width: 85px;
}

.LOADING-productPrice {
  -ms-flex-order: 3;
  border-radius: 20px;
  height: 28px;
  margin: 8px 0 32px;
  -webkit-order: 3;
  order: 3;
  width: 123px;
}

.LOADING-productImageContainer {
  -ms-flex-order: 1;
  margin: 0 auto 20px;
  -webkit-order: 1;
  order: 1;
}

.LOADING-productImage {
  -ms-flex-order: 1;
  height: 120px;
  -webkit-order: 1;
  order: 1;
  width: 120px;
}

.LOADING-paymentTitle {
  display: none;
}

.LOADING-paymentHeader {
  border-radius: 20px;
  display: block;
  height: 26px;
  margin-bottom: 40px;
  width: 160px;
}

.LOADING-paymentHeader.is-hidden {
  display: none;
}

.LOADING-payment-oneRow,
.LOADING-payment-twoRow {
  width: 100%;
}

.LOADING-button {
  height: 44px;
  margin-top: 56px;
  width: 100%;
}

.LOADING-payment-oneRow {
  height: 46px;
}

.LOADING-payment-twoRow {
  height: 90px;
}

.LOADING-payment-link {
  height: 110px;
}

.LOADING-mb38 {
  margin-bottom: 39px;
}

.LOADING-mb24 {
  margin-bottom: 24px;
}

.LOADING-checkoutPayment {
  -webkit-animation: enter-form-mobile 0.3s 0.1s;
  animation: enter-form-mobile 0.3s 0.1s;
  -webkit-animation-fill-mode: both;
  animation-fill-mode: both;
  margin-top: 48px;
  opacity: 0.1;
  -webkit-transform: translateY(2rem);
  -ms-transform: translateY(2rem);
  transform: translateY(2rem);
}

.LOADING-container--single .LOADING-checkoutPayment {
  margin-top: 0;
}

.LOADING-container--single .LOADING-productSummary {
  display: none;
}

.LOADING-container--single .LOADING-checkoutOverview {
  margin-bottom: 66px;
  padding-bottom: 0;
}

.LOADING-footer {
  bottom: -3em;
  color: hsla(0, 0%, 10%, 0.5);
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Ubuntu, sans-serif;
  font-size: 12px;
  left: 0;
  position: absolute;
  text-align: center;
  width: 100%;
}

.LOADING-footer svg {
  fill: hsla(0, 0%, 10%, 0.4);
  position: relative;
  top: 4px;
}

.LOADING-container--single .LOADING-footer {
  bottom: -2rem;
}

.LOADING-container.LOADING-container--redirectPage .LOADING-checkoutContainer,
.LOADING-container.LOADING-container--spinner .LOADING-checkoutContainer,
.LOADING-container:not(.LOADING-container--redirectPage) .LOADING-redirectContainer,
.LOADING-container:not(.LOADING-container--spinner) .LOADING-spinner {
  display: none;
}

.LOADING-redirectContainer {
  -ms-flex-align: center;
  -ms-flex-pack: center;
  -webkit-align-items: center;
  align-items: center;
  bottom: 0;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-direction: column;
  -ms-flex-direction: column;
  flex-direction: column;
  height: 100vh;
  -webkit-justify-content: center;
  justify-content: center;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.LOADING-redirectContainer .LOADING-redirectSpinner {
  -ms-flex-order: 1;
  height: 60px;
  -webkit-order: 1;
  order: 1;
  width: 60px;
}

.LOADING-redirectContainer .LOADING-redirectSpinner,
.LOADING-redirectContainer .LOADING-redirectTitle {
  -ms-flex-pack: center;
  border-radius: 20px;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-direction: column;
  -ms-flex-direction: column;
  flex-direction: column;
  -webkit-justify-content: center;
  justify-content: center;
}

.LOADING-redirectContainer .LOADING-redirectTitle {
  -ms-flex-order: 2;
  height: 40px;
  margin-top: 12px;
  -webkit-order: 2;
  order: 2;
  width: 130px;
}

.LOADING-redirectContainer .LOADING-redirectMessage {
  -ms-flex-pack: center;
  -ms-flex-order: 3;
  border-radius: 20px;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-direction: column;
  -ms-flex-direction: column;
  flex-direction: column;
  height: 60px;
  -webkit-justify-content: center;
  justify-content: center;
  margin-top: 12px;
  -webkit-order: 3;
  order: 3;
  width: 300px;
}

.LOADING-spinner {
  -webkit-animation: spin 1.4s linear infinite;
  animation: spin 1.4s linear infinite;
  background: linear-gradient(90deg, #bababa 10%, rgba(255, 255, 255, 0) 42%);
  border-radius: 50%;
  height: 48px;
  margin: auto;
  position: relative;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  width: 48px;
}

.LOADING-spinner:before {
  border-radius: 100% 0 0 0;
  height: 50%;
  width: 50%;
}

.LOADING-spinner:after,
.LOADING-spinner:before {
  background: #ffffff;
  content: '';
  left: 0;
  position: absolute;
  top: 0;
}

.LOADING-spinner:after {
  border-radius: 50%;
  bottom: 0;
  height: 85%;
  margin: auto;
  right: 0;
  width: 85%;
}

@media only screen and (max-width: 991.98px) {
  .LOADING-container.is-embedded .LOADING-checkoutContainer {
    margin-top: 5px;
    max-width: 412px;
    padding: 15px;
  }

  .is-embedded .LOADING-productSummary {
    -ms-flex-align: start;
    -webkit-align-items: flex-start;
    align-items: flex-start;
    -webkit-flex-direction: row;
    -ms-flex-direction: row;
    flex-direction: row;
  }

  .is-embedded .LOADING-productImageContainer {
    -ms-flex-order: -1;
    margin: 0 16px 0 0;
    -webkit-order: -1;
    order: -1;
  }

  .is-embedded .LOADING-productImage {
    -ms-flex-order: 1;
    height: 42px;
    -webkit-order: 1;
    order: 1;
    width: 42px;
  }

  .is-embedded .LOADING-checkoutPayment {
    margin-top: 24px;
  }

  .is-embedded.LOADING-container--single .LOADING-checkoutPayment {
    margin-top: -12px;
  }

  .is-embedded .LOADING-productPrice {
    margin-bottom: 0;
  }
}

@media only screen and (min-width: 992px) {
  .LOADING-checkoutContainer {
    -ms-flex-pack: justify;
    -webkit-justify-content: space-between;
    justify-content: space-between;
  }

  .LOADING-payment-oneRow {
    height: 38px;
  }

  .LOADING-payment-twoRow {
    height: 74px;
  }

  .LOADING-header {
    left: -21px;
    min-height: 28px;
    position: relative;
  }

  .LOADING-backArrow {
    height: 28px;
    margin-left: 0;
  }

  .LOADING-container {
    -ms-flex-pack: center;
    -ms-flex-align: center;
    -webkit-align-items: center;
    align-items: center;
    display: -webkit-flex;
    display: -ms-flexbox;
    display: flex;
    -webkit-justify-content: center;
    justify-content: center;
    min-height: 0;
    padding: 0;
  }

  .LOADING-double .LOADING-checkoutContainer {
    -webkit-flex-direction: row;
    -ms-flex-direction: row;
    flex-direction: row;
    max-width: 920px;
    padding: 16px 0 0;
  }

  .LOADING-container--single .LOADING-checkoutContainer {
    -ms-flex-align: center;
    -webkit-align-items: center;
    align-items: center;
  }

  .LOADING-container:not(.LOADING-container--single) .LOADING-checkoutPayment {
    -webkit-animation: enter-form-desktop 0.3s 0.1s forwards;
    animation: enter-form-desktop 0.3s 0.1s forwards;
    margin-top: 0;
    opacity: 0.1;
    -webkit-transform: translateX(2rem);
    -ms-transform: translateX(2rem);
    transform: translateX(2rem);
  }

  .LOADING-checkoutOverview,
  .LOADING-checkoutPayment {
    margin-bottom: 0;
    padding-bottom: 40px;
    width: 380px;
  }

  .LOADING-container:not(.LOADING-container--single):not(.is-embedded):not(.hide-halfPageBoxShadow):before {
    -webkit-animation: enter-background-shadow 0.3s;
    animation: enter-background-shadow 0.3s;
    -webkit-animation-fill-mode: both;
    animation-fill-mode: both;
    background: white;
    box-shadow: 15px 0 30px 0 rgba(0, 0, 0, 0.18);
    content: ' ';
    height: 100vh;
    opacity: 0.1;
    position: fixed;
    right: 0;
    top: 0;
    -webkit-transform: scaleX(0.9);
    -ms-transform: scaleX(0.9);
    transform: scaleX(0.9);
    -webkit-transform-origin: right;
    -ms-transform-origin: right;
    transform-origin: right;
    width: 50%;
  }

  .LOADING-container.LOADING-container--redirectPage:before {
    display: none;
  }

  .LOADING-productSummary {
    -ms-flex-align: start;
    -webkit-align-items: flex-start;
    align-items: flex-start;
    margin-bottom: 0;
  }

  .LOADING-productTitle {
    -ms-flex-order: 1;
    -webkit-order: 1;
    order: 1;
  }

  .LOADING-productPrice {
    -ms-flex-order: 2;
    margin: 13px 0 32px;
    -webkit-order: 2;
    order: 2;
  }

  .LOADING-container--multiItem .LOADING-productImageContainer {
    display: none;
  }

  .LOADING-productImageContainer {
    -ms-flex-order: 3;
    height: 300px;
    margin: 32px 0;
    -webkit-order: 3;
    order: 3;
    width: 300px;
  }

  .LOADING-productImage {
    -ms-flex-order: 3;
    height: 187px;
    -webkit-order: 3;
    order: 3;
    width: 187px;
  }

  .LOADING-footer {
    bottom: 0;
    left: 0;
    margin: 12px 0;
    position: absolute;
    text-align: left;
  }

  .LOADING-paymentTitle {
    border-radius: 20px;
    display: block;
    height: 26px;
    margin-bottom: 40px;
    width: 160px;
  }

  .LOADING-container--single .LOADING-footer {
    text-align: center;
  }

  .LOADING-container--multiItem .LOADING-lineItem {
    -ms-flex-order: 3;
    display: -webkit-flex;
    display: -ms-flexbox;
    display: flex;
    margin-bottom: 24px;
    -webkit-order: 3;
    order: 3;
  }

  .LOADING-container--multiItem .LOADING-productImage {
    display: none;
  }

  .LOADING-container--multiItem .LOADING-lineItem-image {
    display: inline-block;
    height: 42px;
    width: 42px;
  }

  .LOADING-container--multiItem .LOADING-lineItem-lines {
    -ms-flex-pack: justify;
    display: -webkit-flex;
    display: -ms-flexbox;
    display: flex;
    -webkit-flex-direction: column;
    -ms-flex-direction: column;
    flex-direction: column;
    -webkit-justify-content: space-between;
    justify-content: space-between;
    margin-left: 12px;
  }

  .LOADING-container--multiItem .LOADING-lineItem-line {
    height: 12px;
    width: 280px;
  }
}
</style>
