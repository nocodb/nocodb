export function validatePassword(p) {
  let error = '';
  let progress = 0;
  let hint = null;
  let valid = true;
  if (!p) {
    error =
      'At least 8 letters with one Uppercase, one number and one special letter';
    valid = false;
  } else {
    if (!(p.length >= 8)) {
      error += 'Atleast 8 letters. ';
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }

    if (!p.match(/.*[A-Z].*/)) {
      error += 'One Uppercase Letter. ';
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }

    if (!p.match(/.*[0-9].*/)) {
      error += 'One Number. ';
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }

    if (!p.match(/[$&+,:;=?@#|'<>.^*()%!_-]/)) {
      error += 'One special letter. ';
      hint = "Allowed special character list :  $&+,:;=?@#|'<>.^*()%!_-";
      valid = false;
    } else {
      progress = Math.min(100, progress + 25);
    }
  }
  return { error, valid, progress, hint };
}
