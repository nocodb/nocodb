// Selector objects include the text of any icons in the textContent property.

import { Locator } from '@playwright/test';

// This function removes the text of any icons from the textContent property.
async function getTextExcludeIconText(selector: Locator) {
  // Get the text of the selector
  let text = await selector.textContent();

  // List of icons
  const icons = selector.locator('.material-symbols');
  const iconCount = await icons.count();

  // Remove the text of each icon from the text
  for (let i = 0; i < iconCount; i++) {
    await icons.nth(i).waitFor({
      state: 'attached',
    });
    const iconText = await icons.nth(i).textContent();
    text = text.replace(iconText, '');
  }

  // trim text for any spaces
  return text.trim();
}

async function getIconText(selector) {
  // List of icons
  const icons = await selector.locator('.material-symbols');

  await icons.nth(0).waitFor();
  return await icons.nth(0).textContent();
}

function isSubset(obj, potentialSubset) {
  for (const prop in potentialSubset) {
    // eslint-disable-next-line no-prototype-builtins
    if (potentialSubset.hasOwnProperty(prop)) {
      const potentialValue = potentialSubset[prop];
      const objValue = obj[prop];
      if (typeof potentialValue === 'object' && typeof objValue === 'object') {
        if (!isSubset(objValue, potentialValue)) {
          return false;
        }
        // eslint-disable-next-line no-prototype-builtins
      } else if (!obj.hasOwnProperty(prop) || objValue !== potentialValue) {
        return false;
      }
    }
  }
  return true;
}

function getDefaultPwd() {
  return 'Password123.';
}

function getBrowserTimezoneOffset() {
  // get timezone offset
  const timezoneOffset = new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(timezoneOffset) / 60);
  const minutes = Math.abs(timezoneOffset % 60);
  const sign = timezoneOffset <= 0 ? '+' : '-';
  const formattedOffset = `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return formattedOffset;
}

async function keyPress(selector, key) {
  const isMac = (await selector.evaluate(() => navigator.platform)).includes('Mac') ? true : false;
  if (false === isMac) {
    key.replace('Meta', 'Control');
  }
  await selector.keyboard.press(key);
}

export { getTextExcludeIconText, isSubset, getIconText, getDefaultPwd, getBrowserTimezoneOffset, keyPress };
