import dayjs from 'dayjs';

const getUniqFilenamePrefix = function () {
  return dayjs().format('YYYYMMDD_HHmmssSSS');
};

const getFilenameForUp = function (prefix) {
  return prefix + '.up.sql';
};

const getFilenameForDown = function (prefix) {
  return prefix + '.down.sql';
};

export { getUniqFilenamePrefix, getFilenameForUp, getFilenameForDown };
