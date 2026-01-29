# Guide de Déploiement - DH Immobilier avec MySQL

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NGINX                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │ /dhimmobilier/      │    │ /dhimmobilier-api/          │ │
│  │ (Frontend Vite)     │    │ (Proxy → localhost:3001)    │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────┐
                    │   Backend Fastify + Prisma    │
                    │        (Port 3001)            │
                    └───────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────┐
                    │      MySQL 8.0 Database       │
                    │        (Port 3306)            │
                    └───────────────────────────────┘
```

## Prérequis Serveur

- **Ubuntu 24.04** (ou compatible)
- **Node.js 20+** et npm
- **MySQL 8.0.x**
- **PM2** (gestionnaire de processus)
- **Nginx** (serveur web)

## 1. Configuration MySQL

```bash
# Connexion à MySQL
sudo mysql -u root -p

# Créer la base de données et l'utilisateur
CREATE DATABASE dhimmobilier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dhim_user'@'localhost' IDENTIFIED BY '12345678';
GRANT ALL PRIVILEGES ON dhimmobilier.* TO 'dhim_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 2. Déploiement du Backend

```bash
# Créer le répertoire
sudo mkdir -p /var/www/dhimmobilier-api
sudo chown $USER:$USER /var/www/dhimmobilier-api

# Copier les fichiers du backend
cp -r backend/* /var/www/dhimmobilier-api/

# Aller dans le répertoire
cd /var/www/dhimmobilier-api

# Installer les dépendances
npm install

# Configurer l'environnement
cat > .env << 'EOF'
DATABASE_URL="mysql://dhim_user:12345678@localhost:3306/dhimmobilier"
PORT=3001
NODE_ENV=production
JWT_SECRET="CHANGEZ_CE_SECRET_EN_PRODUCTION_$(openssl rand -hex 32)"
API_AUTH_COOKIE_NAME="dhimmobilier_session"
CORS_ORIGIN="*"
EOF

# Générer le client Prisma
npx prisma generate

# Pousser le schéma vers MySQL
npx prisma db push

# Exécuter le seed (créer admin + données de base)
npm run db:seed

# Compiler TypeScript
npm run build
```

## 3. Lancer avec PM2

```bash
# Installer PM2 globalement si pas déjà fait
sudo npm install -g pm2

# Démarrer l'API
cd /var/www/dhimmobilier-api
pm2 start ecosystem.config.cjs

# Sauvegarder la configuration PM2
pm2 save

# Configurer le démarrage automatique
pm2 startup
# Suivre les instructions affichées

# Vérifier le statut
pm2 status
pm2 logs dhimmobilier-api
```

## 4. Déploiement du Frontend

```bash
# Créer le répertoire
sudo mkdir -p /var/www/dhimmobilier
sudo chown $USER:$USER /var/www/dhimmobilier

# Depuis votre machine locale, builder le frontend
npm run build

# Copier le build vers le serveur
scp -r dist/* user@server:/var/www/dhimmobilier/
```

## 5. Configuration Nginx

```bash
# Éditer la configuration Nginx
sudo nano /etc/nginx/sites-available/dhimmobilier
```

Contenu du fichier :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend Vite (fichiers statiques)
    location /dhimmobilier/ {
        alias /var/www/dhimmobilier/;
        try_files $uri $uri/ /dhimmobilier/index.html;
        
        # Cache pour les assets statiques
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy pour l'API backend
    location /dhimmobilier-api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Activer le site
sudo ln -sf /etc/nginx/sites-available/dhimmobilier /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

## 6. Vérification

```bash
# Tester l'API
curl http://localhost:3001/auth/me
# Devrait retourner: {"error":"Not authenticated"}

# Tester via Nginx
curl http://votre-domaine.com/dhimmobilier-api/auth/me

# Vérifier les logs
pm2 logs dhimmobilier-api --lines 50
```

## Comptes par Défaut

Après le seed, les comptes suivants sont créés :

| Username    | Password       | Rôle        |
|-------------|----------------|-------------|
| admin       | admin123       | Admin       |
| comptable   | comptable123   | Comptable   |
| secretaire  | secretaire123  | Secrétaire  |

**⚠️ IMPORTANT : Changez ces mots de passe en production !**

## Commandes Utiles

```bash
# Redémarrer l'API
pm2 restart dhimmobilier-api

# Voir les logs en temps réel
pm2 logs dhimmobilier-api

# Mettre à jour le schéma DB
cd /var/www/dhimmobilier-api
npx prisma db push

# Réinitialiser la base de données (ATTENTION: perte de données)
npm run db:reset

# Backup de la base de données
mysqldump -u dhim_user -p dhimmobilier > backup_$(date +%Y%m%d).sql

# Restaurer un backup
mysql -u dhim_user -p dhimmobilier < backup_20250129.sql
```

## Mise à Jour

```bash
# 1. Mettre à jour le backend
cd /var/www/dhimmobilier-api
git pull  # ou copier les nouveaux fichiers
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart dhimmobilier-api

# 2. Mettre à jour le frontend
# Sur votre machine locale:
npm run build
# Puis copier dist/ vers /var/www/dhimmobilier/
```

## Dépannage

### L'API ne démarre pas
```bash
# Vérifier les logs
pm2 logs dhimmobilier-api --lines 100

# Vérifier la connexion MySQL
mysql -u dhim_user -p -e "SELECT 1"

# Vérifier le port
netstat -tlnp | grep 3001
```

### Erreur de connexion à la base de données
```bash
# Vérifier que MySQL est démarré
sudo systemctl status mysql

# Tester la connexion
mysql -u dhim_user -p12345678 dhimmobilier -e "SHOW TABLES"
```

### Erreur 502 Bad Gateway
```bash
# Vérifier que l'API tourne
pm2 status

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/error.log
```

### Cookies non envoyés
Vérifier que le frontend et l'API sont sur le même domaine ou configurer correctement CORS et les cookies cross-origin.

## Sécurité en Production

1. **Changer le JWT_SECRET** avec une valeur aléatoire forte
2. **Changer les mots de passe** des comptes par défaut
3. **Configurer HTTPS** avec Let's Encrypt
4. **Restreindre CORS_ORIGIN** au domaine de production
5. **Configurer un firewall** (ufw)
6. **Mettre en place des backups** automatiques de MySQL
