/**
 * Compare obj1 and obj2 conditionally based on ignoredFields set
 * Ignore the field names which are passed in the ignoredFields.
 * optionally keyId will be use to prefix the keys mismatched
 *
 *
 * use utility boolean param breakAtFirstMismatch to print diff for
 * all the fields instead of breaking at first mismatch
 *
 * @param obj1
 * @param obj2
 * @param ignoredFields : filed names ex: title
 * @param ignoredKeys : json path for the filed ex: ".project.is_meta.title"
 * @param keyId : starts with ""
 * @param breakAtFirstMismatch : default true. returns false on first field mismatch
 * @returns
 */
export function deepCompare(
  obj1: any,
  obj2: any,
  ignoredFields?: Set<string>,
  ignoredKeys?: Set<string>,
  rootKeyId = '',
  breakAtFirstMismatch = true
): boolean {
  let keyId = rootKeyId;
  if (ignoredKeys !== undefined && ignoredKeys.has(keyId)) {
    return true;
  }
  // If the objects are the same instance, they are equal
  if (obj1 === obj2) {
    return true;
  }

  // If one of the objects is null or not an object, they are not equal
  if (!obj1 || !obj2 || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    console.log(`Mismatch key: ${keyId} value1: "${obj1}" value2: "${obj2}"`);
    return !breakAtFirstMismatch;
    // return false;
  }

  // If the objects have different numbers of properties, they are not equal
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) {
    console.log(`Mismatch length key: ${keyId} value1: "${obj1}" value2: "${obj2}"`);
    return !breakAtFirstMismatch;
    // return false;
  }

  // Recursively compare each property of the objects
  for (const key of keys1) {
    if (
      (ignoredFields !== undefined && ignoredFields.has(key)) ||
      key.endsWith(' List') /* temp hack to avoid fields like */ ||
      key.includes('___')
    ) {
      // console.log(`${keyId} ignored in comparison`)
    } else {
      keyId = rootKeyId + '.' + key;
      if (!deepCompare(obj1[key], obj2[key], ignoredFields, ignoredKeys, keyId, breakAtFirstMismatch)) {
        return !breakAtFirstMismatch;
        // return false;
      }
    }
  }

  // If all properties match, the objects are equal
  return true;
}
