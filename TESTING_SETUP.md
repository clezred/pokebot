# Guide de configuration pour les tests

## Configuration pour les tests

Ce projet est configuré pour gérer différents environnements (production, développement, test).

### 1. Fichiers de configuration

#### Pour la production :
- `.env` - Variables d'environnement de production (non versionné)
- `config/ids.json` - IDs Discord pour la production

#### Pour les tests :
- `.env.test` - Variables d'environnement de test (non versionné)
- `config/ids.test.json` - IDs Discord pour les tests

### 2. Utilisation

#### Lancement en production :
```bash
npm start
# ou avec Docker
npm run docker:up
```

#### Lancement en test :
```bash
npm run start:test
# ou avec Docker
npm run docker:test:up
```

#### Lancement en développement :
```bash
npm run start:dev
```

### 3. Docker pour les tests

Le fichier `docker-compose.test.yml` est configuré pour :
- Utiliser une base de données PostgreSQL vierge (pas de dump)
- Charger les variables du fichier `.env.test`
- Utiliser `config/ids.test.json` automatiquement

Pour démarrer l'environnement de test avec Docker :
```bash
npm run docker:test:up
```

Pour l'arrêter :
```bash
npm run docker:test:down
```

### 4. Comment ça fonctionne

Le fichier `src/config.js` détecte automatiquement l'environnement via la variable `NODE_ENV` et charge :
- Les bonnes variables d'environnement (via `.env` ou `.env.test`)
- Le bon fichier d'IDs (`ids.json` ou `ids.test.json`)
- Tous les autres fichiers de configuration nécessaires

Aucune modification du code n'est nécessaire entre les environnements.

### 5. Fichiers à ne pas versionner

Ajoutez dans votre `.gitignore` :
```
.env
.env.test
data/
```