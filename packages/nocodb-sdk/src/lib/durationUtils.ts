export const durationOptions = [
  {
    type: 0,
    title: 'h:mm',
    example: '(e.g. 1:23)',
    regex: /(\d+)(?::(\d+))?/,
  },
  {
    type: 1,
    title: 'h:mm:ss',
    example: '(e.g. 3:45, 1:23:40)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?/,
  },
  {
    type: 2,
    title: 'h:mm:ss.s',
    example: '(e.g. 3:34.6, 1:23:40.0)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    type: 3,
    title: 'h:mm:ss.ss',
    example: '(e.g. 3.45.67, 1:23:40.00)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    type: 4,
    title: 'h:mm:ss.sss',
    example: '(e.g. 3.45.678, 1:23:40.000)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
];

const extractHMS = (groups: RegExpMatchArray, type: number) => {
  if (groups[0] && groups[1] && !groups[2] && !groups[3] && !groups[4]) {
    const val = Number.parseInt(groups[1], 10);
    if (groups.input.slice(-1) === ':')
      // e.g. 30:
      return {
        h: Number.parseFloat(groups[1]),
        mm: 0,
        ss: 0,
      };

    if (type === 0) {
      // consider it as minutes
      // e.g. 360 -> 06:00
      const h = Math.floor(val / 60);
      return {
        h,
        mm: Math.floor(val - (h * 3600) / 60),
        ss: 0,
      };
    }
    // consider it as seconds
    // e.g. 3600 -> 01:00:00
    return {
      h: Math.floor(Number.parseFloat(groups[1]) / 3600),
      mm: Math.floor(Number.parseFloat(groups[1]) / 60) % 60,
      ss: val % 60,
    };
  }
  if (type !== 0 && groups[1] && groups[2] && !groups[3])
    // 10:10 means mm:ss instead of h:mm
    // 10:10:10 means h:mm:ss
    return {
      h: 0,
      mm: Number.parseFloat(groups[1]),
      ss: Number.parseFloat(groups[2]),
    };

  return {
    h: Number.parseFloat(groups[1]) || 0,
    mm: Number.parseFloat(groups[2]) || 0,
    ss: Number.parseFloat(groups[3]) || 0,
  };
};

// pad zero
// mm && ss
// e.g.  3 -> 03
// e.g. 12 -> 12
// sss
// e.g.  1 -> 001
// e.g. 10 -> 010
const padZero = (val: number, isSSS = false) => {
  return `${val}`.padStart(isSSS ? 3 : 2, '0');
};

export const convertMS2Duration = (val: any, durationType: number) => {
  if (val === '' || val === null || val === undefined) {
    return val;
  }
  val = Number.parseFloat(val) * 1000;
  // 600.000 s --> 10:00 (10 mins)
  const milliseconds = Math.round((val % 1) * 1000);
  const centiseconds = Math.round(milliseconds / 10);
  const deciseconds = Math.round(centiseconds / 10);
  const hours = Math.floor(Number.parseInt(val, 10) / (60 * 60));
  const minutes = Math.floor((parseInt(val, 10) - hours * 60 * 60) / 60);
  const seconds = parseInt(val, 10) - hours * 60 * 60 - minutes * 60;

  if (durationType === 0) {
    // h:mm
    return `${padZero(hours)}:${padZero(minutes + (seconds >= 30 ? 1 : 0))}`;
  } else if (durationType === 1) {
    // h:mm:ss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
  } else if (durationType === 2) {
    // h:mm:ss.s
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(
      seconds
    )}.${deciseconds}`;
  } else if (durationType === 3) {
    // h:mm:ss.ss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(
      centiseconds
    )}`;
  } else if (durationType === 4) {
    // h:mm:ss.sss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(
      milliseconds,
      true
    )}`;
  }
  return val;
};

export const convertDurationToSeconds = (
  val: string,
  durationType?: number
) => {
  const type =
    durationType || durationOptions.findIndex(({ regex }) => regex.test(val));
  const regex = durationOptions[type].regex;
  const groups = val.match(regex);

  const { h, mm, ss } = extractHMS(groups, type);

  if (type === 0)
    // h:mm
    return h * 3600 + mm * 60;
  if (type === 1)
    // h:mm:ss
    return h * 3600 + mm * 60 + ss;

  if (type === 2) {
    // h:mm:ss.s (deciseconds)
    const ds = Number.parseFloat(groups[4]) || 0;
    const len = (Math.log(ds) * Math.LOG10E + 1) | 0;
    const ms = 100 * Math.round(ds / 10 ** (len - 1));
    // e.g. len = 4: 1234 -> 1, 1456 -> 1
    // e.g. len = 3:  123 -> 1,  191 -> 2
    // e.g. len = 2:   12 -> 1 ,  16 -> 2

    return h * 3600 + mm * 60 + ss + ms / 1000;
  }
  if (type === 3) {
    // h:mm:ss.ss (centi seconds)
    const cs = Number.parseFloat(groups[4]) || 0;
    const len = (Math.log(cs) * Math.LOG10E + 1) | 0;
    const ms = 10 * Math.round(cs / 10 ** (len - 2));
    // e.g. len = 4: 1234 -> 12, 1285 -> 13
    // e.g. len = 3:  123 -> 12,  128 -> 13
    // check the third digit

    return h * 3600 + mm * 60 + ss + ms / 1000;
  }

  if (type === 4) {
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

  return null;
};
