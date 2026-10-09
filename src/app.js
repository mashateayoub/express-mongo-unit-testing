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
