const User = require('../../src/models/User');
const UserRepository = require('../../src/repositories/UserRepository');

let model, repository, query;
beforeEach(() => {
  query = { lean: jest.fn().mockReturnThis(), exec: jest.fn() };
  model = {
    findById: jest.fn().mockReturnValue(query),
    findOne: jest.fn().mockReturnValue(query),
    create: jest.fn()
  };
  repository = new UserRepository(model);
});
test('recherche par ID avec lean et exec', async () => {
  const user = { _id: 'id', name: 'Sara' };
  query.exec.mockResolvedValue(user);
  await expect(repository.findById('id')).resolves.toBe(user);
  expect(model.findById).toHaveBeenCalledWith('id');
  expect(query.lean).toHaveBeenCalledTimes(1);
  expect(query.exec).toHaveBeenCalledTimes(1);
});
test('recherche par email', async () => {
  query.exec.mockResolvedValue(null);
  await expect(repository.findByEmail('sara@example.com')).resolves.toBeNull();
  expect(model.findOne).toHaveBeenCalledWith({ email: 'sara@example.com' });
  expect(query.lean).toHaveBeenCalledTimes(1);
  expect(query.exec).toHaveBeenCalledTimes(1);
});
test('crée un document et retourne un objet simple', async () => {
  const payload = { name: 'Sara', email: 'sara@example.com' };
  const plain = { _id: 'id', ...payload };
  const document = { toObject: jest.fn().mockReturnValue(plain) };
  model.create.mockResolvedValue(document);
  await expect(repository.create(payload)).resolves.toBe(plain);
  expect(model.create).toHaveBeenCalledWith(payload);
  expect(document.toObject).toHaveBeenCalledTimes(1);
});
test.each(['findById', 'findByEmail'])('propage une erreur de lecture : %s', async method => {
  const error = new Error('Mongo indisponible');
  query.exec.mockRejectedValue(error);
  await expect(repository[method]('value')).rejects.toBe(error);
});
test('propage une erreur de création', async () => {
  const error = new Error('Échec création');
  model.create.mockRejectedValue(error);
  await expect(repository.create({})).rejects.toBe(error);
});
test('utilise le modèle User par défaut', () => {
  expect(new UserRepository().model).toBe(User);
});
