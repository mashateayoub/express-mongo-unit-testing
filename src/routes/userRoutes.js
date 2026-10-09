const express = require('express');

function createUserRoutes(controller, router = express.Router()) {
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  return router;
}
module.exports = createUserRoutes;
