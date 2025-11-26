# Guide de configuration pour les tests

## Configuration pour les tests

Votre projet est maintenant configuré pour gérer différents environnements (production, développement, test).

### 1. Fichiers de configuration

#### Pour la production :
- `.env` - Variables d'environnement de production (non versionné)
- `config/ids.json` - IDs Discord pour la production

#### Pour les tests :
- `.env.test` - Variables d'environnement de test (non versionné)
- `config/ids.test.json` - IDs Discord pour les tests

### 2. Configuration initiale

#### Créer votre fichier .env.test :
```bash
cp .env.test.example .env.test
```
Puis éditez `.env.test` avec vos valeurs de test.

#### Configurer vos IDs de test :
Éditez `config/ids.test.json` avec les IDs de votre serveur Discord de test.

### 3. Utilisation

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

### 4. Docker pour les tests

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

### 5. Comment ça fonctionne

Le fichier `src/config.js` détecte automatiquement l'environnement via la variable `NODE_ENV` et charge :
- Les bonnes variables d'environnement (via `.env` ou `.env.test`)
- Le bon fichier d'IDs (`ids.json` ou `ids.test.json`)
- Tous les autres fichiers de configuration nécessaires

Aucune modification du code n'est nécessaire entre les environnements !

### 6. Fichiers à ne pas versionner

Ajoutez dans votre `.gitignore` :
```
.env
.env.test
data/
```

Les fichiers `.env.example` et `.env.test.example` peuvent être versionnés comme templates.
