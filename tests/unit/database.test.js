const mongoose = require('mongoose');
const createDatabase = require('../../src/config/database');

let client, database;
beforeEach(() => {
  client = { connect: jest.fn(), disconnect: jest.fn() };
  database = createDatabase(client);
});
test('attend la connexion avec URI nettoyée et options', async () => {
  client.connect.mockResolvedValue(client);
  await expect(database.connect(' mongodb://127.0.0.1/demo ')).resolves.toBe(client);
  expect(client.connect).toHaveBeenCalledWith('mongodb://127.0.0.1/demo', {
    serverSelectionTimeoutMS: 5000
  });
});
test.each([undefined, null, '', '   '])('refuse une URI absente : %p', async uri => {
  await expect(database.connect(uri)).rejects.toThrow('MONGO_URI est obligatoire');
  expect(client.connect).not.toHaveBeenCalled();
});
test('propage un échec de connexion', async () => {
  const error = new Error('Mongo indisponible');
  client.connect.mockRejectedValue(error);
  await expect(database.connect('mongodb://127.0.0.1/demo')).rejects.toBe(error);
});
test('déconnecte le client', async () => {
  await database.disconnect();
  expect(client.disconnect).toHaveBeenCalledTimes(1);
});
test('propage un échec de déconnexion', async () => {
  const error = new Error('Déconnexion impossible');
  client.disconnect.mockRejectedValue(error);
  await expect(database.disconnect()).rejects.toBe(error);
});
test('utilise Mongoose par défaut sans connexion réelle en test', async () => {
  const disconnect = jest.spyOn(mongoose, 'disconnect').mockResolvedValue();
  await createDatabase().disconnect();
  expect(disconnect).toHaveBeenCalledTimes(1);
});
