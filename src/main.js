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
