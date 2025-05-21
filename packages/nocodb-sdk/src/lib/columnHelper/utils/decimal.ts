export const allowedDecimalRegex = /[-0123456789.]/g;
export const extractDecimalFromString = (value: string) => {
  const extractedArrFromRegex = value.match(allowedDecimalRegex);
  if (!extractedArrFromRegex || extractedArrFromRegex.length === 0) return '';
  let dotExists = false;
  const isMinus = extractedArrFromRegex[0] === '-';
  const extractedValueFromRegex = extractedArrFromRegex
    .filter((k) => {
      if (k === '.' && dotExists) {
        return false;
      } else if (k === '.') {
        dotExists = true;
      } else if (k === '-') {
        return false;
      }
      return true;
    })
    .join('');
  return (isMinus ? '-' : '') + extractedValueFromRegex;
};

export const composeNewDecimalValue = (props: {
  selectionStart?: number | null;
  selectionEnd?: number | null;
  lastValue: string;
  newValue: string;
}) => {
  return extractDecimalFromString(
    [
      props.lastValue.substring(0, props.selectionStart ?? 0),
      props.newValue,
      props.lastValue.substring(
        props.selectionEnd ?? props.selectionStart ?? 0
      ),
    ].join('')
  );
};
