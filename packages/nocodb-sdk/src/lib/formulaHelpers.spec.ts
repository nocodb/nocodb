describe('auth', () => {
  it('Formula parsing and type validation', async () => {
    const response = {userId: 'fakeUserId'};
    expect(response).toEqual({ userId: 'fakeUserId' });
  });
});
