export function validatePassword(p) {
  let error = '';
  const hint = null;
  let valid = true;

  if (!p) {
    error = 'At least 8 letters';
    // error = t('msg.error.signUpRules.completeRuleSet');
    valid = false;
  } else {
    if (!(p.length >= 8)) {
      error += 'At least 8 letters. ';
      // error += t('msg.error.signUpRules.atLeast8Char');
      valid = false;
    }
  }
  return { error, valid, hint };
}
