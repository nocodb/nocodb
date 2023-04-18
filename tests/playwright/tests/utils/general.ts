// Selector objects include the text of any icons in the textContent property.
// This function removes the text of any icons from the textContent property.
async function getTextExcludeIconText(selector) {
  // Get the text of the selector
  let text = await selector.textContent();

  // List of icons
  const icons = await selector.locator('.material-symbols-outlined');
  const iconCount = await icons.count();

  // Remove the text of each icon from the text
  for (let i = 0; i < iconCount; i++) {
    await icons.nth(i).waitFor();
    const iconText = await icons.nth(i).textContent();
    text = text.replace(iconText, '');
  }

  // trim text for any spaces
  return text.trim();
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

export { getTextExcludeIconText, isSubset };
