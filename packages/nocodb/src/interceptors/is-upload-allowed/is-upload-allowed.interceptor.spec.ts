import { UploadAllowedInterceptor } from './is-upload-allowed.interceptor';

describe('UploadAllowedInterceptor', () => {
  it('should be defined', () => {
    expect(new UploadAllowedInterceptor()).toBeDefined();
  });
});
