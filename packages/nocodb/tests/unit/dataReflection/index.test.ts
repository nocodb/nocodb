import { runOnSet } from '../utils/runOnSet';
import { dataReflectionInterceptorTest } from './dataReflectionInterceptor.test';
import { dataReflectionProxyTest } from './dataReflectionProxy.test';

function _dataReflectionTests() {
  dataReflectionInterceptorTest();
  dataReflectionProxyTest();
}

export const dataReflectionTests = runOnSet(1, function () {
  describe('dataReflection', _dataReflectionTests);
});
