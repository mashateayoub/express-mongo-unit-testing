# Express + MongoDB avec tests unitaires Jest

API utilisateurs avec repository, service et contrôleur sous forme de classes.

## Tests

```bash
npm install
npm test
npm run test:coverage
```

Les tests unitaires ne nécessitent ni MongoDB ni serveur HTTP. Le rapport HTML est dans `coverage/index.html`.

## Démarrage de l’API

Node.js 20.19+ et Docker Compose sont nécessaires pour cette démonstration locale. Le fichier `.env` contient la configuration MongoDB locale ; adapter `MONGO_URI` si une autre instance est utilisée.

```bash
docker compose up -d mongo
npm start
```

Routes : `GET /health`, `POST /api/users`, `GET /api/users/:id`.

Exemple de création :

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sara","email":"sara@example.com"}'
```

Pour suivre les explications et les tests de chaque couche, consulter [le guide complet](EXPRESS-MONGO-COMPLETE.md).
