export default {
  data: () => ({
    passwordProgress: 0,
    passwordValidateMsg: '',
    formUtil: {
      formErr: false,
      formErrMsg: '',
      valid: false,
      valid1: false,
      recpatcha: true,
      e3: true,
      e4: true,
      passwordProgress: 0,
      progressColorValue: 'red'
    }
  }),
  methods: {
    progressColor(num) {
      this.formUtil.progressColorValue = ['error', 'warning', 'info', 'success'][Math.floor(num / 25)]
      return this.formUtil.progressColorValue
    },
    PasswordValidate(p) {
      if (!p) {
        this.passwordProgress = 0
        this.passwordValidateMsg = 'Atleast 8 letters with one Uppercase, one number and one special letter'
        return false
      }

      let msg = ''
      let validation = true
      let progress = 0

      if (!(p.length >= 8)) {
        msg += 'Atleast 8 letters. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      if (!(p.match(/.*[A-Z].*/))) {
        msg += 'One Uppercase Letter. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      if (!(p.match(/.*[0-9].*/))) {
        msg += 'One Number. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      if (!(p.match(/[$&+,:;=?@#|'<>.^*()%!_-]/))) {
        msg += 'One special letter. '
        validation = validation && false
      } else {
        progress = Math.min(100, progress + 25)
      }

      this.formUtil.passwordProgress = progress
      // console.log('progress', progress);
      // console.log('color', this.progressColor(this.formUtil.passwordProgress));
      this.progressColorValue = this.progressColor(this.formUtil.passwordProgress)

      this.formUtil.passwordValidateMsg = msg

      // console.log('msg', msg, validation);

      return validation
    }

  }
}
