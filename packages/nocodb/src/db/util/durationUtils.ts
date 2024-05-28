export const durationOptions = [
  {
    id: 0,
    title: 'h:mm',
    example: '(e.g. 1:23)',
    regex: /(\d+)(?::(\d+))?/,
  },
  {
    id: 1,
    title: 'h:mm:ss',
    example: '(e.g. 3:45, 1:23:40)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?/,
  },
  {
    id: 2,
    title: 'h:mm:ss.s',
    example: '(e.g. 3:34.6, 1:23:40.0)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    id: 3,
    title: 'h:mm:ss.ss',
    example: '(e.g. 3.45.67, 1:23:40.00)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    id: 4,
    title: 'h:mm:ss.sss',
    example: '(e.g. 3.45.678, 1:23:40.000)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
];

const getDurationType = (val: string) => {
  for (let i = 0; i < durationOptions.length; i++) {
    if (durationOptions[i].regex.test(val)) return durationOptions[i].id;
  }

  return -1;
};

export const convertDurationToSeconds = (val: string) => {
  const durationType = getDurationType(val);

  if (durationType === -1) return null;

  const durationRegex = durationOptions[durationType].regex;
  let h: number, mm: number, ss: number;

  const groups = val.match(durationRegex);

  if (groups[0] && groups[1] && !groups[2] && !groups[3] && !groups[4]) {
    const val = Number.parseInt(groups[1], 10);
    if (groups.input.slice(-1) === ':') {
      // e.g. 30:
      h = Number.parseFloat(groups[1]);
      mm = 0;
      ss = 0;
    } else if (durationType === 0) {
      // consider it as minutes
      // e.g. 360 -> 06:00
      h = Math.floor(val / 60);
      mm = Math.floor(val - (h * 3600) / 60);
      ss = 0;
    } else {
      // consider it as seconds
      // e.g. 3600 -> 01:00:00
      h = Math.floor(Number.parseFloat(groups[1]) / 3600);
      mm = Math.floor(Number.parseFloat(groups[1]) / 60) % 60;
      ss = val % 60;
    }
  } else if (durationType !== 0 && groups[1] && groups[2] && !groups[3]) {
    // 10:10 means mm:ss instead of h:mm
    // 10:10:10 means h:mm:ss
    h = 0;
    mm = Number.parseFloat(groups[1]);
    ss = Number.parseFloat(groups[2]);
  } else {
    h = Number.parseFloat(groups[1]) || 0;
    mm = Number.parseFloat(groups[2]) || 0;
    ss = Number.parseFloat(groups[3]) || 0;
  }

  if (durationType === 0)
    // h:mm
    return h * 3600 + mm * 60;
  if (durationType === 1)
    // h:mm:ss
    return h * 3600 + mm * 60 + ss;

  if (durationType === 2) {
    // h:mm:ss.s (deciseconds)
    const ds = Number.parseFloat(groups[4]) || 0;
    const len = (Math.log(ds) * Math.LOG10E + 1) | 0;
    const ms = 100 * Math.round(ds / 10 ** (len - 1));
    // e.g. len = 4: 1234 -> 1, 1456 -> 1
    // e.g. len = 3:  123 -> 1,  191 -> 2
    // e.g. len = 2:   12 -> 1 ,  16 -> 2

    return h * 3600 + mm * 60 + ss + ms / 1000;
  }
  if (durationType === 3) {
    // h:mm:ss.ss (centi seconds)
    const cs = Number.parseFloat(groups[4]) || 0;
    const len = (Math.log(cs) * Math.LOG10E + 1) | 0;
    const ms = 10 * Math.round(cs / 10 ** (len - 2));
    // e.g. len = 4: 1234 -> 12, 1285 -> 13
    // e.g. len = 3:  123 -> 12,  128 -> 13
    // check the third digit

    return h * 3600 + mm * 60 + ss + ms / 1000;
  }

  if (durationType === 4) {
    // h:mm:ss.sss (milliseconds)
    let ms = Number.parseFloat(groups[4]) || 0;
    const len = (Math.log(ms) * Math.LOG10E + 1) | 0;
    ms =
      // e.g. 1235 -> 124
      // e.g. 1234 -> 123
      len === 4
        ? Math.round(ms / 10)
        : // take whatever it is
          ms;
    return h * 3600 + mm * 60 + ss + ms / 1000;
  }
};
