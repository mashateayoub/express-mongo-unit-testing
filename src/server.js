const createDatabase = require('./config/database');
const User = require('./models/User');
const UserRepository = require('./repositories/UserRepository');
const UserService = require('./services/UserService');
const UserController = require('./controllers/UserController');
const createApp = require('./app');
const { listenHttp, closeHttp } = require('./httpServer');

function createRuntime({
  database = createDatabase(), model = User, appFactory = createApp,
  listen = listenHttp, close = closeHttp
} = {}) {
  const repository = new UserRepository(model);
  const service = new UserService(repository);
  const controller = new UserController(service);
  const app = appFactory(controller);
  let server;

  return {
    async start({ uri, port }) {
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('PORT invalide');
      }
      await database.connect(uri);
      try {
        // Attendre notamment la création de l’index unique email en développement.
        await model.init();
        server = await listen(app, port);
        return server;
      } catch (error) {
        // Préserver la cause initiale même si le nettoyage échoue.
        try { await database.disconnect(); } catch (cleanupError) {
          console.error(cleanupError);
        }
        throw error;
      }
    },
    async stop() {
      try {
        if (server) await close(server);
      } finally {
        server = undefined;
        await database.disconnect();
      }
    }
  };
}
module.exports = createRuntime;
