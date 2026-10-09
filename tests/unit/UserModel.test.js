const User = require('../../src/models/User');

test('normalise un document et le valide sans MongoDB', async () => {
  const user = new User({ name: ' Sara ', email: ' SARA@EXAMPLE.COM ' });
  expect(user.name).toBe('Sara');
  expect(user.email).toBe('sara@example.com');
  await expect(user.validate()).resolves.toBeUndefined();
});
test('refuse les champs requis absents', async () => {
  await expect(new User({}).validate()).rejects.toMatchObject({
    errors: { name: expect.any(Error), email: expect.any(Error) }
  });
});
test('refuse un nom trop court', async () => {
  const user = new User({ name: 'S', email: 's@example.com' });
  await expect(user.validate()).rejects.toMatchObject({
    errors: { name: { kind: 'minlength' } }
  });
});
test('déclare un index unique et les timestamps', () => {
  expect(User.schema.indexes()).toEqual(expect.arrayContaining([
    [{ email: 1 }, expect.objectContaining({ unique: true })]
  ]));
  expect(User.schema.options.timestamps).toBe(true);
});
