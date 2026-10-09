# Projet complet Express + MongoDB : classes, démarrage et tests unitaires Jest

Ce document contient **tous les fichiers implémentés** d’une petite API utilisateurs. Les exemples sont complets : aucun TODO, aucun morceau de code à deviner. Les couches sont séparées et les classes reçoivent leurs dépendances par constructeur pour être testables.

L’API propose `POST /api/users`, `GET /api/users/:id` et `GET /health`. MongoDB stocke les utilisateurs avec un email unique. Jest teste le modèle, la connexion, le repository, le service, le contrôleur, les routes, les middlewares, l’application, l’écoute HTTP et le cycle de vie du serveur.

**Prérequis :** Node.js **20.19+**, npm et MongoDB local ou Docker Compose pour lancer l’API. **Stack :** CommonJS, Express 5, Mongoose 9, Jest 30.

Pour garder les exercices précédents, recopier ce projet dans un **nouveau dossier** :

```bash
mkdir express-mongo-unit-testing
cd express-mongo-unit-testing
mkdir -p src/errors src/config src/models src/repositories src/services
mkdir -p src/controllers src/routes src/middlewares tests/helpers tests/unit
```

Créer chaque fichier au chemin indiqué ci-dessous. Tous les chemins sont relatifs à ce nouveau dossier. Après avoir copié les fichiers :

```bash
npm install
npm test
npm run test:coverage
```

Les tests unitaires fonctionnent **sans démarrer MongoDB ni le serveur HTTP**. Les exemples de code restent dans ce Markdown ; le document ne modifie pas votre application actuelle.

## 1. Architecture et responsabilités

```text
express-mongo-unit-testing/
├── package.json
├── jest.config.cjs
├── compose.yaml
├── .env.example
├── .gitignore
├── src/
│   ├── main.js                       Entrée CLI, environnement et signaux
│   ├── server.js                     Composition et cycle de vie
│   ├── httpServer.js                 Ouverture et fermeture HTTP
│   ├── app.js                        Configuration Express sans listen()
│   ├── config/database.js            Connexion et déconnexion MongoDB
│   ├── models/User.js                Schéma Mongoose
│   ├── errors/AppError.js            Erreur métier
│   ├── repositories/UserRepository.js
│   ├── services/UserService.js
│   ├── controllers/UserController.js
│   ├── routes/userRoutes.js
│   └── middlewares/
│       ├── notFound.js
│       └── errorHandler.js
└── tests/
    ├── helpers/httpMocks.js
    └── unit/                         Une suite par module applicatif
```

```text
Requête → route → UserController → UserService → UserRepository → modèle → MongoDB
                      ↓                ↓               ↓
                 erreur capturée → next(error) → errorHandler → réponse JSON
```

Le repository connaît Mongoose. Le service connaît les règles métier. Le contrôleur connaît `req`, `res` et `next`. Le démarrage compose leurs instances, attend la connexion MongoDB et l’initialisation du modèle, puis ouvre le port HTTP.

Dans les tests, on conserve la couche testée réelle et on simule ses dépendances : le repository reçoit un modèle simulé, le service reçoit un repository simulé, et le contrôleur reçoit un service simulé.

## 2. Configuration du projet

### `package.json`

```json
{
  "name": "express-mongo-unit-testing",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "start": "node --env-file=.env src/main.js",
    "dev": "node --watch --env-file=.env src/main.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watchAll --runInBand",
    "test:coverage": "jest --coverage --runInBand"
  },
  "dependencies": {
    "express": "^5.0.0",
    "mongoose": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^30.0.0"
  }
}
```

### `jest.config.cjs`

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  resetModules: false,
  collectCoverageFrom: ['src/**/*.js'],
  coverageReporters: ['text', 'html', 'lcov'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 90, lines: 90 }
  }
};
```

### `.gitignore`

```gitignore
node_modules/
coverage/
.env
```

### `.env.example`

```dotenv
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/express_unit_demo
```

### `compose.yaml`

```yaml
services:
  mongo:
    image: mongo:8
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongo_data:/data/db
volumes:
  mongo_data:
```

`--env-file=.env` utilise le chargement natif de Node. Le fichier `.env` reste local ; copier `.env.example` avant de lancer l’API.

La configuration Jest conserve l’environnement Node et évite de réinitialiser le registre des modules Mongoose. Ces tests n’utilisent pas de faux timers. [Recommandations Mongoose pour Jest](https://mongoosejs.com/docs/jest.html).

## 3. Erreurs, base de données et modèle

### `src/errors/AppError.js`

```js
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
```

### `src/config/database.js`

```js
const mongoose = require('mongoose');

function createDatabase(client = mongoose) {
  return {
    async connect(uri) {
      if (typeof uri !== 'string' || uri.trim() === '') {
        throw new Error('MONGO_URI est obligatoire');
      }
      return client.connect(uri.trim(), { serverSelectionTimeoutMS: 5000 });
    },
    async disconnect() {
      await client.disconnect();
    }
  };
}
module.exports = createDatabase;
```

### `src/models/User.js`

```js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
```

La connexion est attendue avant l’écoute HTTP. Le délai de sélection de serveur est limité à cinq secondes pour cette démonstration locale. Une URI absente ou un MongoDB indisponible provoque un échec de démarrage. [Connexion Mongoose](https://mongoosejs.com/docs/connections.html).

`unique: true` déclare un **index MongoDB**, pas un validateur Mongoose. Le démarrage attend `model.init()` ; l’index reste la protection contre deux créations concurrentes. Le service traite donc aussi le code MongoDB `11000`, en plus de sa recherche préalable par email. [Validation et unicité Mongoose](https://mongoosejs.com/docs/validation.html#the-unique-option-is-not-a-validator).

## 4. Repository, service et contrôleur sous forme de classes

### `src/repositories/UserRepository.js`

```js
const User = require('../models/User');

class UserRepository {
  constructor(model = User) {
    this.model = model;
  }

  async findById(id) {
    return this.model.findById(id).lean().exec();
  }

  async findByEmail(email) {
    return this.model.findOne({ email }).lean().exec();
  }

  async create(data) {
    const document = await this.model.create(data);
    return document.toObject();
  }
}
module.exports = UserRepository;
```

### `src/services/UserService.js`

```js
const AppError = require('../errors/AppError');

class UserService {
  constructor(repository) {
    this.repository = repository;
  }

  async getById(id) {
    if (typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new AppError('Identifiant MongoDB invalide', 400);
    }
    const user = await this.repository.findById(id);
    if (!user) throw new AppError('Utilisateur introuvable', 404);
    return user;
  }

  async create(data) {
    if (!data || typeof data.name !== 'string' || data.name.trim().length < 2) {
      throw new AppError('Le nom doit contenir au moins 2 caractères', 400);
    }
    if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      throw new AppError('Email invalide', 400);
    }

    const payload = { name: data.name.trim(), email: data.email.trim().toLowerCase() };
    if (await this.repository.findByEmail(payload.email)) {
      throw new AppError('Email déjà utilisé', 409);
    }

    try {
      return await this.repository.create(payload);
    } catch (error) {
      // L'index MongoDB reste la garantie d'unicité en cas de requêtes concurrentes.
      if (error.code === 11000) throw new AppError('Email déjà utilisé', 409);
      throw error;
    }
  }
}
module.exports = UserService;
```

### `src/controllers/UserController.js`

```js
class UserController {
  constructor(service) {
    this.service = service;
    // Express appelle ces méthodes comme des callbacks : préserver this.
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
  }

  async getById(req, res, next) {
    try {
      const user = await this.service.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const user = await this.service.create(req.body);
      return res.status(201).json({ status: 'success', data: { user } });
    } catch (error) {
      return next(error);
    }
  }
}
module.exports = UserController;
```

Le service valide le format de l’ObjectId, normalise le nom et l’email, et ne conserve que les champs autorisés. Il distingue un utilisateur absent (404), des données invalides (400), un conflit d’email (409) et un incident de stockage.

Les méthodes du contrôleur sont liées avec `bind(this)`. Sans cela, leur utilisation comme callbacks de route peut faire perdre l’accès à `this.service`.

## 5. Routes, middlewares et application Express

### `src/routes/userRoutes.js`

```js
const express = require('express');

function createUserRoutes(controller, router = express.Router()) {
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  return router;
}
module.exports = createUserRoutes;
```

### `src/middlewares/notFound.js`

```js
const AppError = require('../errors/AppError');

function notFound(req, res, next) {
  return next(new AppError(`Route introuvable : ${req.method} ${req.originalUrl}`, 404));
}
module.exports = notFound;
```

### `src/middlewares/errorHandler.js`

```js
const AppError = require('../errors/AppError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  // express.json() signale ainsi les corps JSON mal formés.
  const invalidJson = error.type === 'entity.parse.failed';
  const expected = error instanceof AppError || invalidJson;
  const statusCode = invalidJson ? 400 : expected ? error.statusCode : 500;
  const production = process.env.NODE_ENV === 'production';
  const message = invalidJson ? 'JSON invalide'
    : production && !expected ? 'Erreur interne du serveur' : error.message;

  if (!expected) console.error(error);
  const body = { status: statusCode < 500 ? 'fail' : 'error', message };
  if (!production) body.stack = error.stack;
  return res.status(statusCode).json(body);
}
module.exports = errorHandler;
```

### `src/app.js`

```js
const express = require('express');
const createUserRoutes = require('./routes/userRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

function createApp(controller, expressFactory = express) {
  const app = expressFactory();
  app.use(expressFactory.json({ limit: '10kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', createUserRoutes(controller));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = createApp;
```

L’application est créée sans ouvrir de port. Le middleware 404 vient après les routes et le gestionnaire d’erreurs vient en dernier. Celui-ci garde ses quatre paramètres et délègue si les en-têtes sont déjà envoyés. [Gestion des erreurs Express](https://expressjs.com/en/guide/error-handling/).

En production, les erreurs métier conservent leur message, les incidents inattendus sont journalisés et leur réponse contient un message générique. Les corps JSON mal formés sont convertis en erreurs 400. En développement, la réponse expose aussi la stack.

## 6. Démarrage et arrêt du serveur

### `src/httpServer.js`

```js
function listenHttp(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });
}

function closeHttp(server) {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}
module.exports = { listenHttp, closeHttp };
```

### `src/server.js`

```js
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
```

### `src/main.js`

```js
const createRuntime = require('./server');

async function main({
  runtime = createRuntime(), env = process.env,
  processRef = process, logger = console
} = {}) {
  try {
    await runtime.start({ uri: env.MONGO_URI, port: Number(env.PORT || 3000) });
    logger.log('API démarrée');
  } catch (error) {
    logger.error('Démarrage impossible', error);
    processRef.exitCode = 1;
    return null;
  }

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try { await runtime.stop(); } catch (error) {
      logger.error('Arrêt impossible', error);
      processRef.exitCode = 1;
    }
  };
  processRef.once('SIGINT', shutdown);
  processRef.once('SIGTERM', shutdown);
  return runtime;
}

if (require.main === module) main();
module.exports = main;
```

Le démarrage suit cet ordre : connexion MongoDB, initialisation des index, puis écoute HTTP. Si l’écoute ou l’initialisation échoue, MongoDB est déconnecté. L’arrêt ferme HTTP avant la connexion MongoDB. `SIGINT` et `SIGTERM` déclenchent un seul nettoyage, même si les deux signaux arrivent.

`main.js` peut être importé sans démarrer l’application : seul son lancement direct appelle automatiquement `main()`. Les fonctions d’écoute et de fermeture sont injectables ; les tests peuvent vérifier leur ordre sans ouvrir de socket.

## 7. Doubles Express partagés entre les tests

### `tests/helpers/httpMocks.js`

```js
function httpMocks() {
  return {
    req: { params: {}, body: {}, method: 'GET', originalUrl: '/unknown' },
    res: { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() },
    next: jest.fn()
  };
}
module.exports = httpMocks;
```

## 8. Tests du modèle, de la connexion et du repository

Le modèle réel est validé en mémoire, sans appel à `save()`. Le test d’index vérifie la déclaration du schéma ; il ne prouve pas que l’index a été créé dans une base réelle.

Pour le repository, le modèle est simulé, mais le repository reste réel. Le double de requête reproduit `lean().exec()` : `lean` renvoie le même objet et `exec` renvoie la promesse attendue.

### `tests/unit/AppError.test.js`

```js
const AppError = require('../../src/errors/AppError');

test.each([[400, 'fail'], [404, 'fail'], [500, 'error']])(
  'construit une erreur %i avec le statut %s', (code, status) => {
    const error = new AppError('Message métier', code);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Message métier');
    expect(error.statusCode).toBe(code);
    expect(error.status).toBe(status);
    expect(error.isOperational).toBe(true);
    expect(error.stack).toContain('Message métier');
  }
);
test('utilise 500 par défaut', () => {
  expect(new AppError('Erreur').statusCode).toBe(500);
});
```

### `tests/unit/database.test.js`

```js
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
```

### `tests/unit/UserModel.test.js`

```js
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
```

### `tests/unit/UserRepository.test.js`

```js
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
```

## 9. Tests du service et du contrôleur

Chaque `beforeEach` crée de nouveaux doubles : aucun historique d’appels ni comportement simulé n’est partagé. Les rejets sont vérifiés avec `await expect(...).rejects`. `toBe(error)` vérifie que le même objet erreur est propagé.

Le test de création vérifie aussi que des champs supplémentaires comme `admin` ne sont pas transmis au repository.

### `tests/unit/UserService.test.js`

```js
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
```

### `tests/unit/UserController.test.js`

```js
const UserController = require('../../src/controllers/UserController');
const httpMocks = require('../helpers/httpMocks');

let service, controller, req, res, next;
beforeEach(() => {
  service = { getById: jest.fn(), create: jest.fn() };
  controller = new UserController(service);
  ({ req, res, next } = httpMocks());
});
test('répond 200 et conserve this lorsque la méthode est détachée', async () => {
  req.params.id = 'id';
  const user = { _id: 'id' };
  service.getById.mockResolvedValue(user);
  const handler = controller.getById;
  await handler(req, res, next);
  expect(service.getById).toHaveBeenCalledWith('id');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { user } });
  expect(next).not.toHaveBeenCalled();
});
test('répond 201 avec l’utilisateur créé', async () => {
  req.body = { name: 'Sara', email: 'sara@example.com' };
  const user = { _id: 'id', ...req.body };
  service.create.mockResolvedValue(user);
  const handler = controller.create;
  await handler(req, res, next);
  expect(service.create).toHaveBeenCalledWith(req.body);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { user } });
  expect(next).not.toHaveBeenCalled();
});
test.each(['getById', 'create'])('transmet un rejet de %s sans répondre', async method => {
  const error = new Error('Incident service');
  service[method].mockRejectedValue(error);
  await controller[method](req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBe(error);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
```

## 10. Tests des routes, middlewares et du montage Express

Le test des routes vérifie l’enregistrement des chemins et des callbacks. Le test de l’application vérifie l’ordre de montage avec une factory Express simulée. Ces tests ne font aucune requête HTTP et ne remplacent pas un test d’intégration du routage réel.

### `tests/unit/userRoutes.test.js`

```js
const createUserRoutes = require('../../src/routes/userRoutes');

test('enregistre les routes avec les callbacks du contrôleur', () => {
  const controller = { getById: jest.fn(), create: jest.fn() };
  const router = { get: jest.fn(), post: jest.fn() };
  expect(createUserRoutes(controller, router)).toBe(router);
  expect(router.get).toHaveBeenCalledTimes(1);
  expect(router.get).toHaveBeenCalledWith('/:id', controller.getById);
  expect(router.post).toHaveBeenCalledTimes(1);
  expect(router.post).toHaveBeenCalledWith('/', controller.create);
});
test('crée un vrai Router Express par défaut sans serveur', () => {
  const router = createUserRoutes({ getById: jest.fn(), create: jest.fn() });
  expect(typeof router).toBe('function');
});
```

### `tests/unit/notFound.test.js`

```js
const AppError = require('../../src/errors/AppError');
const notFound = require('../../src/middlewares/notFound');
const httpMocks = require('../helpers/httpMocks');

test('transmet une AppError 404 contenant méthode et URL', () => {
  const { req, res, next } = httpMocks();
  notFound(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  const error = next.mock.calls[0][0];
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(404);
  expect(error.message).toBe('Route introuvable : GET /unknown');
  expect(res.json).not.toHaveBeenCalled();
});
```

### `tests/unit/errorHandler.test.js`

```js
const AppError = require('../../src/errors/AppError');
const errorHandler = require('../../src/middlewares/errorHandler');
const httpMocks = require('../helpers/httpMocks');

let req, res, next;
const originalEnv = process.env.NODE_ENV;
beforeEach(() => {
  ({ req, res, next } = httpMocks());
  process.env.NODE_ENV = 'development';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});
test('garde quatre paramètres', () => expect(errorHandler).toHaveLength(4));
test('expose la stack en développement', () => {
  const error = new AppError('Champ invalide', 400);
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: error.message, stack: error.stack });
  expect(next).not.toHaveBeenCalled();
});
test('préserve une erreur métier en production sans stack', () => {
  process.env.NODE_ENV = 'production';
  errorHandler(new AppError('Absent', 404), req, res, next);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Absent' });
  expect(console.error).not.toHaveBeenCalled();
});
test('masque et journalise un incident en production', () => {
  process.env.NODE_ENV = 'production';
  const error = new Error('password=secret-fictif');
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Erreur interne du serveur' });
  expect(console.error).toHaveBeenCalledWith(error);
  expect(next).not.toHaveBeenCalled();
});
test('expose un incident en développement', () => {
  const error = new Error('Incident');
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Incident', stack: error.stack });
});
test('convertit un JSON mal formé en 400', () => {
  process.env.NODE_ENV = 'production';
  errorHandler(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }), req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'JSON invalide' });
});
test('délègue sans écrire après envoi des en-têtes', () => {
  res.headersSent = true;
  const error = new Error('Trop tard');
  errorHandler(error, req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBe(error);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
```

### `tests/unit/app.test.js`

```js
jest.mock('../../src/routes/userRoutes', () => jest.fn());
const express = require('express');
const createApp = require('../../src/app');
const createUserRoutes = require('../../src/routes/userRoutes');
const notFound = require('../../src/middlewares/notFound');
const errorHandler = require('../../src/middlewares/errorHandler');

test('monte JSON, les routes, la 404 et les erreurs dans cet ordre', () => {
  const app = { use: jest.fn(), get: jest.fn() };
  const parser = jest.fn();
  const router = jest.fn();
  const factory = jest.fn().mockReturnValue(app);
  factory.json = jest.fn().mockReturnValue(parser);
  const controller = {};
  createUserRoutes.mockReturnValue(router);
  expect(createApp(controller, factory)).toBe(app);
  expect(factory.json).toHaveBeenCalledWith({ limit: '10kb' });
  expect(createUserRoutes).toHaveBeenCalledWith(controller);
  expect(app.use.mock.calls).toEqual([[parser], ['/api/users', router], [notFound], [errorHandler]]);
  expect(app.get).toHaveBeenCalledWith('/health', expect.any(Function));
  const health = app.get.mock.calls[0][1];
  const res = { json: jest.fn() };
  health({}, res);
  expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
});
test('crée une application Express par défaut sans écouter un port', () => {
  createUserRoutes.mockReturnValue(express.Router());
  expect(typeof createApp({})).toBe('function');
});
```

## 11. Tests de l’écoute, du démarrage et de l’arrêt

Un `EventEmitter` reproduit les événements HTTP `listening` et `error`. Les tests du runtime simulent la connexion et les index. La connexion contrôlée par une promesse permet de vérifier que le port n’est pas ouvert trop tôt.

Les tests de `main` utilisent un faux objet process pour vérifier les signaux et le code de sortie, sans arrêter Jest.

### `tests/unit/httpServer.test.js`

```js
const { EventEmitter } = require('node:events');
const { listenHttp, closeHttp } = require('../../src/httpServer');

test('résout seulement après l’événement listening', async () => {
  const server = new EventEmitter();
  const app = { listen: jest.fn().mockReturnValue(server) };
  const pending = listenHttp(app, 3000);
  expect(app.listen).toHaveBeenCalledWith(3000);
  server.emit('listening');
  await expect(pending).resolves.toBe(server);
  expect(server.listenerCount('error')).toBe(0);
});
test('rejette une erreur d’écoute et retire le listener listening', async () => {
  const server = new EventEmitter();
  const error = new Error('Port occupé');
  const pending = listenHttp({ listen: jest.fn().mockReturnValue(server) }, 3000);
  server.emit('error', error);
  await expect(pending).rejects.toBe(error);
  expect(server.listenerCount('listening')).toBe(0);
});
test('propage une exception immédiate de listen', async () => {
  const error = new Error('Impossible');
  await expect(listenHttp({ listen() { throw error; } }, 3000)).rejects.toBe(error);
});
test('attend la fermeture HTTP', async () => {
  const server = { close: jest.fn(callback => callback()) };
  await closeHttp(server);
  expect(server.close).toHaveBeenCalledTimes(1);
});
test('propage une erreur de fermeture', async () => {
  const error = new Error('Fermeture impossible');
  await expect(closeHttp({ close: callback => callback(error) })).rejects.toBe(error);
});
```

### `tests/unit/server.test.js`

```js
const createRuntime = require('../../src/server');
const UserController = require('../../src/controllers/UserController');
const UserService = require('../../src/services/UserService');
const UserRepository = require('../../src/repositories/UserRepository');

let database, model, app, appFactory, listen, close, runtime, server;
beforeEach(() => {
  database = { connect: jest.fn().mockResolvedValue(), disconnect: jest.fn().mockResolvedValue() };
  model = { init: jest.fn().mockResolvedValue() };
  app = {};
  server = {};
  appFactory = jest.fn().mockReturnValue(app);
  listen = jest.fn().mockResolvedValue(server);
  close = jest.fn().mockResolvedValue();
  runtime = createRuntime({ database, model, appFactory, listen, close });
});
test('compose repository, service et contrôleur avec leurs dépendances', () => {
  const controller = appFactory.mock.calls[0][0];
  expect(controller).toBeInstanceOf(UserController);
  expect(controller.service).toBeInstanceOf(UserService);
  expect(controller.service.repository).toBeInstanceOf(UserRepository);
});
test('se connecte avant d’écouter le port', async () => {
  let finishConnection;
  database.connect.mockReturnValue(new Promise(resolve => { finishConnection = resolve; }));
  const pending = runtime.start({ uri: 'mongodb://demo', port: 3000 });
  expect(database.connect).toHaveBeenCalledWith('mongodb://demo');
  expect(listen).not.toHaveBeenCalled();
  finishConnection();
  await expect(pending).resolves.toBe(server);
  expect(listen).toHaveBeenCalledWith(app, 3000);
});
test.each([-1, 65536, 1.5, NaN])('refuse un port invalide : %p', async port => {
  await expect(runtime.start({ uri: 'mongodb://demo', port })).rejects.toThrow('PORT invalide');
  expect(database.connect).not.toHaveBeenCalled();
});
test('n’écoute pas si MongoDB est indisponible', async () => {
  const error = new Error('Mongo absent');
  database.connect.mockRejectedValue(error);
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(listen).not.toHaveBeenCalled();
});
test('déconnecte MongoDB si l’écoute HTTP échoue', async () => {
  const error = new Error('Port occupé');
  listen.mockRejectedValue(error);
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
test('préserve l’erreur d’écoute si le nettoyage échoue aussi', async () => {
  const error = new Error('Port occupé');
  const cleanup = new Error('Déconnexion impossible');
  listen.mockRejectedValue(error);
  database.disconnect.mockRejectedValue(cleanup);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(log).toHaveBeenCalledWith(cleanup);
});
test('ferme HTTP avant de déconnecter MongoDB', async () => {
  await runtime.start({ uri: 'mongodb://demo', port: 3000 });
  await runtime.stop();
  expect(close).toHaveBeenCalledWith(server);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
  expect(close.mock.invocationCallOrder[0]).toBeLessThan(database.disconnect.mock.invocationCallOrder[0]);
});
test('déconnecte même si HTTP ne se ferme pas correctement', async () => {
  await runtime.start({ uri: 'mongodb://demo', port: 3000 });
  const error = new Error('Close impossible');
  close.mockRejectedValue(error);
  await expect(runtime.stop()).rejects.toBe(error);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
test('permet de nettoyer un runtime sans serveur actif', async () => {
  await runtime.stop();
  expect(close).not.toHaveBeenCalled();
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
test('compose les dépendances réelles par défaut sans connexion ni port', () => {
  expect(createRuntime()).toEqual({ start: expect.any(Function), stop: expect.any(Function) });
});

test('n’écoute pas si l’initialisation des index échoue', async () => {
  const error = new Error('Index impossible');
  model.init.mockRejectedValue(error);
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(listen).not.toHaveBeenCalled();
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
```

### `tests/unit/main.test.js`

```js
jest.mock('../../src/server', () => jest.fn());
const createRuntime = require('../../src/server');
const main = require('../../src/main');

let runtime, processRef, logger;
beforeEach(() => {
  runtime = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue() };
  processRef = { once: jest.fn(), exitCode: undefined };
  logger = { log: jest.fn(), error: jest.fn() };
});
test('démarre avec l’environnement et enregistre les signaux', async () => {
  await expect(main({ runtime, processRef, logger, env: { MONGO_URI: 'mongodb://demo', PORT: '4000' } }))
    .resolves.toBe(runtime);
  expect(runtime.start).toHaveBeenCalledWith({ uri: 'mongodb://demo', port: 4000 });
  expect(processRef.once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  expect(processRef.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  expect(logger.log).toHaveBeenCalledWith('API démarrée');
});
test('utilise le port 3000 en l’absence de PORT', async () => {
  await main({ runtime, processRef, logger, env: { MONGO_URI: 'mongodb://demo' } });
  expect(runtime.start).toHaveBeenCalledWith({ uri: 'mongodb://demo', port: 3000 });
});
test('signale un échec de démarrage sans installer les signaux', async () => {
  const error = new Error('Mongo absent');
  runtime.start.mockRejectedValue(error);
  await expect(main({ runtime, processRef, logger, env: {} })).resolves.toBeNull();
  expect(processRef.exitCode).toBe(1);
  expect(logger.error).toHaveBeenCalledWith('Démarrage impossible', error);
  expect(processRef.once).not.toHaveBeenCalled();
});
test('arrête une seule fois même si les deux signaux sont déclenchés', async () => {
  await main({ runtime, processRef, logger, env: {} });
  const sigint = processRef.once.mock.calls[0][1];
  const sigterm = processRef.once.mock.calls[1][1];
  await sigint();
  await sigterm();
  expect(runtime.stop).toHaveBeenCalledTimes(1);
});
test('signale un échec d’arrêt', async () => {
  await main({ runtime, processRef, logger, env: {} });
  const error = new Error('Stop impossible');
  runtime.stop.mockRejectedValue(error);
  await processRef.once.mock.calls[0][1]();
  expect(logger.error).toHaveBeenCalledWith('Arrêt impossible', error);
  expect(processRef.exitCode).toBe(1);
});

test('utilise les dépendances par défaut sans démarrer de serveur réel', async () => {
  createRuntime.mockReturnValue(runtime);
  jest.replaceProperty(process, 'env', {
    ...process.env, MONGO_URI: 'mongodb://demo', PORT: '3001'
  });
  const once = jest.spyOn(process, 'once').mockReturnValue(process);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  await expect(main()).resolves.toBe(runtime);
  expect(runtime.start).toHaveBeenCalledWith({ uri: 'mongodb://demo', port: 3001 });
  expect(once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  expect(log).toHaveBeenCalledWith('API démarrée');
});
```

## 12. Exécuter les tests et lire la couverture

```bash
npm test
npm test -- UserService
npm test -- UserRepository
npm test -- server.test.js
npm run test:watch
npm run test:coverage
```

La couverture cible **tous les modules de `src`**, y compris les fichiers qu’un test aurait oublié d’importer. Le rapport HTML est disponible dans `coverage/index.html`.

| Indicateur | Utilisation |
| --- | --- |
| Statements et Lines | Trouver du code jamais exécuté |
| Branches | Repérer les chemins succès/erreur et les alternatives non testées |
| Functions | Trouver les méthodes ou callbacks jamais appelés |
| Uncovered Line #s | Localiser les cas à examiner dans le fichier |

Les seuils du fichier de configuration sont appliqués pendant les lancements avec couverture. Un lancement ciblé sur une seule suite peut passer ses assertions tout en échouant aux seuils globaux : les autres modules restent dans le périmètre mesuré.

Le garde `require.main === module` sert au lancement CLI direct. Les tests importent le module et appellent `main` explicitement ; ce garde peut donc rester partiellement non couvert. Les comportements de démarrage, d’échec et d’arrêt sont testés séparément.

Une couverture élevée ne prouve pas l’unicité dans une base réelle ni le fonctionnement d’une route sur HTTP. Les unit tests vérifient les comportements de chaque couche et les interactions avec ses doubles.

## 13. Lancer l’API avec MongoDB

Les tests n’ont pas besoin de cette étape. Pour la démonstration de l’application complète :

```bash
cp .env.example .env
# Si MongoDB n’est pas déjà disponible sur le port 27017 :
docker compose up -d mongo
npm start
```

Le Compose fourni crée une base locale de développement et conserve les données dans un volume. Si vous utilisez une autre instance MongoDB, adapter `MONGO_URI` dans `.env`.

Dans un autre terminal :

```bash
curl -i http://localhost:3000/health
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sara","email":"sara@example.com"}'
```

La création répond 201. Copier la valeur réelle de `data.user._id`, puis remplacer `<ID_RETOURNE>` dans la commande suivante :

```bash
curl -i 'http://localhost:3000/api/users/<ID_RETOURNE>'
```

Autres vérifications manuelles :

```bash
# ID mal formé : 400
curl -i http://localhost:3000/api/users/invalid
# Rejouer la création du même email : 409
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sara","email":"sara@example.com"}'
# Route inconnue : 404
curl -i http://localhost:3000/unknown
```

Pour observer le mode production, arrêter le serveur et changer `NODE_ENV=production` dans `.env`, puis relancer `npm start`. `Ctrl+C` déclenche la fermeture HTTP et la déconnexion MongoDB. Après la démonstration :

```bash
docker compose stop mongo
```

## 14. Ce que couvre cet exemple

Le projet est une API pédagogique complète pour la création et la lecture d’utilisateurs, avec persistance MongoDB et tests unitaires de chaque module. Le démarrage suppose un seul runtime par processus. Les tests ne contactent aucune base et n’ouvrent aucun port.

Les étapes suivantes d’un projet plus large seraient les tests d’intégration HTTP/MongoDB, les opérations de mise à jour et suppression, l’authentification et les contraintes de déploiement. Ces fonctionnalités ne font pas partie du code présenté ici.
