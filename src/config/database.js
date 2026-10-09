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
