# SaaS Management Platform - Backend API

API Laravel 8 pour la gestion multi-tenant SaaS avec authentification sécurisée.

## Technologies

- **Laravel 8** - Framework PHP
- **Laravel Sanctum** - Authentification API Token
- **Spatie Laravel Permission** - Gestion des rôles et permissions
- **Barryvdh Laravel Debugbar** - Debug (dev)

## Installation

```bash
# Cloner le projet
cd backend_multi

# Installer les dépendances
composer install

# Copier le fichier d'environnement
cp .env.example .env

# Générer la clé d'application
php artisan key:generate

# Configurer la base de données dans .env
DB_DATABASE=saas_management
DB_USERNAME=root
DB_PASSWORD=

# Exécuter les migrations
php artisan migrate

# Exécuter les seeders
php artisan db:seed

# Démarrer le serveur
php artisan serve
```

## Utilisateur par défaut

- **Email:** superadmin@saas.com
- **Password:** password123
- **Role:** SUPER_ADMIN

## Rôles

| Rôle | Description |
|------|-------------|
| SUPER_ADMIN | Accès complet à toutes les fonctionnalités |
| ADMIN | Gestion des utilisateurs et données du tenant |
| USER | Accès en lecture seule |

## Modules disponibles

- **COMMERCE** - Produits, clients, fournisseurs, factures
- **CONTAINER** - Gestion des conteneurs
- **IMMOBILIER** - Locations, bâtiments, logements
- **TAXI** - Gestion des taxis et chauffeurs
- **FINANCE** - Paiements et devises

## Endpoints API

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/register` | Inscription |
| POST | `/api/login` | Connexion |
| POST | `/api/logout` | Déconnexion |
| GET | `/api/me` | Profil utilisateur |
| POST | `/api/refresh` | Rafraîchir le token |

### Gestion (SUPER_ADMIN)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/api/tenants` | Liste/Créer tenants |
| GET/PUT/DELETE | `/api/tenants/{id}` | Détail/Modifier/Supprimer tenant |
| POST | `/api/tenants/{id}/assign-module` | Assigner module |
| GET/POST | `/api/modules` | Liste/Créer modules |
| GET/POST | `/api/subscription-plans` | Plans d'abonnement |
| GET/POST | `/api/subscriptions` | Abonnements |
| GET/POST | `/api/roles` | Rôles |
| GET/POST | `/api/permissions` | Permissions |

### Utilisateurs (ADMIN+)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/api/users` | Liste/Créer utilisateurs |
| POST | `/api/users/{id}/assign-role` | Assigner rôle |

### Ressources (Authentifié)
| Ressource | Endpoint |
|-----------|----------|
| Catégories produits | `/api/product-categories` |
| Unités | `/api/units` |
| Produits | `/api/products` |
| Conteneurs | `/api/containers` |
| Clients | `/api/clients` |
| Fournisseurs | `/api/suppliers` |
| Devises | `/api/currencies` |
| Taux de change | `/api/exchange-rates` |
| Paiements | `/api/payments` |
| Factures | `/api/invoices` |
| Emplacements | `/api/locations` |
| Bâtiments | `/api/buildings` |
| Étages | `/api/floors` |
| Config. logements | `/api/unit-configurations` |
| Logements | `/api/housing-units` |
| Chauffeurs | `/api/drivers` |
| Taxis | `/api/taxis` |
| Affectations taxi | `/api/taxi-assignments` |

## Authentification

Toutes les requêtes protégées nécessitent le header:
```
Authorization: Bearer {token}
```

## Format de réponse

### Succès
```json
{
    "success": true,
    "data": {...},
    "message": "Operation successful"
}
```

### Erreur
```json
{
    "success": false,
    "message": "Error message",
    "errors": {...}
}
```

## Structure du projet

```
app/
├── Http/
│   ├── Controllers/Api/    # Controllers API
│   └── Middleware/         # Middlewares
├── Models/                 # Modèles Eloquent
database/
├── migrations/             # Migrations
└── seeders/               # Seeders
routes/
└── api.php                # Routes API
```
