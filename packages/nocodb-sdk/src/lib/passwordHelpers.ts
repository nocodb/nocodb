export function validatePassword(p) {
  let error = '';
  let progress = 0;
  let hint = null;
  let valid = true;

  if (!p) {
    error =
      'At least 8 letters with one Uppercase, one number and one special letter';
    // error = t('msg.error.signUpRules.completeRuleSet');
    valid = false;
  } else {
    if (!(p.length >= 8)) {
      error += 'At least 8 letters. ';
      // error += t('msg.error.signUpRules.atLeast8Char');
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }

    if (!p.match(/.*[A-Z].*/)) {
      error += 'One Uppercase Letter. ';
      // error += t('msg.error.signUpRules.atLeastOneUppercase');
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }

    if (!p.match(/.*[0-9].*/)) {
      error += 'One Number. ';
      // error += t('msg.error.signUpRules.atLeastOneNumber');
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }

    if (!p.match(/[$&+,:;=?@#|'<>.^*()%!_-]/)) {
      error += 'One special letter. ';
      // error += t('msg.error.signUpRules.atLeastOneSpecialChar');
      hint = "Allowed special character list :  $&+,:;=?@#|'<>.^*()%!_-";
      // hint = `${t(
      //   'msg.error.signUpRules.allowedSpecialCharList'
      // )} :  $&+,:;=?@#|'<>.^*()%!_-`;
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }
  }
  return { error, valid, progress, hint };
}
