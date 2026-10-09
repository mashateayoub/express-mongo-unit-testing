const UserService = require('../../src/services/UserService');

const id = '507f1f77bcf86cd799439011';
let repository, service;
beforeEach(() => {
  repository = { findById: jest.fn(), findByEmail: jest.fn(), create: jest.fn() };
  service = new UserService(repository);
});
test('retourne un utilisateur existant', async () => {
  const user = { _id: id, name: 'Sara' };
  repository.findById.mockResolvedValue(user);
  await expect(service.getById(id)).resolves.toBe(user);
  expect(repository.findById).toHaveBeenCalledWith(id);
  expect(repository.findById).toHaveBeenCalledTimes(1);
});
test.each([undefined, null, 42, '', 'invalid'])('refuse un ID invalide : %p', async value => {
  await expect(service.getById(value)).rejects.toMatchObject({ statusCode: 400 });
  expect(repository.findById).not.toHaveBeenCalled();
});
test('rejette un utilisateur absent', async () => {
  repository.findById.mockResolvedValue(null);
  await expect(service.getById(id)).rejects.toMatchObject({ statusCode: 404 });
});
test('propage un incident de lecture', async () => {
  const error = new Error('Mongo indisponible');
  repository.findById.mockRejectedValue(error);
  await expect(service.getById(id)).rejects.toBe(error);
});
test('normalise et filtre les données avant création', async () => {
  const saved = { _id: id, name: 'Sara', email: 'sara@example.com' };
  repository.findByEmail.mockResolvedValue(null);
  repository.create.mockResolvedValue(saved);
  await expect(service.create({ name: ' Sara ', email: ' SARA@example.com ', admin: true }))
    .resolves.toBe(saved);
  expect(repository.findByEmail).toHaveBeenCalledWith('sara@example.com');
  expect(repository.create).toHaveBeenCalledWith({ name: 'Sara', email: 'sara@example.com' });
  expect(repository.create).toHaveBeenCalledTimes(1);
});
test.each([undefined, {}, { name: 42 }, { name: ' ' }, { name: 'S' }])(
  'refuse un nom invalide : %p', async data => {
    await expect(service.create(data)).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.findByEmail).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  }
);
test.each([undefined, 42, '', 'invalid'])('refuse un email invalide : %p', async email => {
  await expect(service.create({ name: 'Sara', email })).rejects.toMatchObject({ statusCode: 400 });
  expect(repository.findByEmail).not.toHaveBeenCalled();
  expect(repository.create).not.toHaveBeenCalled();
});
test('refuse un email déjà présent', async () => {
  repository.findByEmail.mockResolvedValue({ _id: id });
  await expect(service.create({ name: 'Sara', email: 'sara@example.com' }))
    .rejects.toMatchObject({ statusCode: 409 });
  expect(repository.create).not.toHaveBeenCalled();
});
test('convertit une collision concurrente MongoDB en 409', async () => {
  repository.findByEmail.mockResolvedValue(null);
  repository.create.mockRejectedValue(Object.assign(new Error('Duplicate key'), { code: 11000 }));
  await expect(service.create({ name: 'Sara', email: 'sara@example.com' }))
    .rejects.toMatchObject({ statusCode: 409 });
});
test('propage un incident de création', async () => {
  const error = new Error('Mongo indisponible');
  repository.create.mockRejectedValue(error);
  await expect(service.create({ name: 'Sara', email: 'sara@example.com' })).rejects.toBe(error);
});
test('propage un incident de recherche par email sans créer', async () => {
  const error = new Error('Lecture impossible');
  repository.findByEmail.mockRejectedValue(error);
  await expect(service.create({ name: 'Sara', email: 'sara@example.com' })).rejects.toBe(error);
  expect(repository.create).not.toHaveBeenCalled();
});
