import Validator from 'validator';

export const customValidators = {
  isCurrency: Validator['isFloat'],
};
