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
