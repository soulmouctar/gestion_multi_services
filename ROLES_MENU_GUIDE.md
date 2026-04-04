# Guide de Gestion des Rôles et Menu

## Vue d'ensemble

Le système gère trois niveaux de rôles avec des menus différents pour chaque niveau.

## Rôles et Permissions

### 1. SUPER_ADMIN
**Accès complet à tout le système**

Menu visible :
- Dashboard
- **ADMINISTRATION** (réservé uniquement au SUPER_ADMIN)
  - Gestion des Organisations
  - Gestion des Modules
  - Gestion des Abonnements
  - Plans d'Abonnement
  - Gestion des Utilisateurs
  - Rôles & Permissions
  - Statistiques Globales
  - Configuration
- **ORGANISATION**
  - Informations Entreprise
  - Contacts & Adresses
  - Utilisateurs
  - Devises
  - En-têtes Factures
  - Configuration

### 2. ADMIN (Administrateur de Tenant)
**Gestion de son organisation et modules autorisés**

Menu visible :
- Dashboard
- **ORGANISATION**
  - Informations Entreprise
  - Contacts & Adresses
  - Utilisateurs
  - Devises
  - En-têtes Factures
  - Configuration
- **Modules accessibles** (selon permissions tenant + utilisateur)
  - Commercial (si activé)
  - Finance (si activé)
  - Conteneurs (si activé)
  - Location (si activé)
  - Taxi & Transport (si activé)
  - Statistiques (si activé)

Menu masqué :
- ❌ ADMINISTRATION (réservé SUPER_ADMIN)

### 3. USER (Utilisateur simple)
**Accès uniquement aux modules autorisés**

Menu visible :
- Dashboard
- **Modules accessibles uniquement** (selon permissions utilisateur)
  - Uniquement les modules où `user_module_permissions.is_active = true`
  - ET où `tenant_modules.is_active = true`

Menu masqué :
- ❌ ADMINISTRATION
- ❌ ORGANISATION

## Logique de Filtrage

### Backend (AuthController)
Lors du login, le backend retourne :
```php
[
    'user' => $userData, // avec roles, tenant, permissions
    'token' => $token,
    'tenant_active_modules' => $activeModules, // modules du tenant actifs
    'user_module_permissions' => $userModulePermissions // permissions utilisateur
]
```

### Frontend (NavigationService)
Le `NavigationService` filtre le menu selon :

1. **Extraction du rôle** depuis `authState.user.roles[0].name`
2. **Vérification du rôle** :
   - `isSuperAdmin = userRole === 'SUPER_ADMIN'`
   - `isTenantAdmin = userRole === 'ADMIN'`
3. **Construction du menu** :
   - Si `isSuperAdmin` → Affiche ADMINISTRATION + ORGANISATION
   - Si `isTenantAdmin` → Affiche ORGANISATION uniquement
   - Si `USER` → Aucune section admin

4. **Filtrage des modules** :
   - Utilise `authService.getUserAccessibleModules()`
   - Retourne l'intersection de :
     - Modules du tenant actifs (`tenant_active_modules`)
     - Permissions utilisateur actives (`user_module_permissions`)

### AuthService
Méthodes clés :
- `getUserAccessibleModules()` : Retourne les modules accessibles
- `getTenantActiveModules()` : Retourne les modules du tenant
- `hasModuleAccess(moduleCode)` : Vérifie l'accès à un module

## Tables de Base de Données

### tenant_modules
Modules activés pour un tenant :
```sql
tenant_id | module_id | is_active
1         | 1         | 1         -- Tenant 1 a accès au module COMMERCE
```

### user_module_permissions
Permissions individuelles des utilisateurs :
```sql
user_id | module_code | module_name | permissions | is_active
2       | COMMERCE    | Commercial  | {...}       | 1
```

## Exemple de Cas d'Usage

### Utilisateur sire@gmail.com (USER sans modules)
```
Rôle : USER
Modules tenant : [COMMERCE, FINANCE]
Permissions utilisateur : [] (aucune)

Menu affiché :
- Dashboard

Menu masqué :
- ADMINISTRATION
- ORGANISATION
- Tous les modules (aucune permission)
```

### Utilisateur admin@tenant1.com (ADMIN)
```
Rôle : ADMIN
Modules tenant : [COMMERCE, FINANCE, CONTAINERS]
Permissions utilisateur : [COMMERCE, FINANCE]

Menu affiché :
- Dashboard
- ORGANISATION
- Commercial
- Finance

Menu masqué :
- ADMINISTRATION
- Conteneurs (pas de permission utilisateur)
```

### Utilisateur soulmouctar96@gmail.com (SUPER_ADMIN)
```
Rôle : SUPER_ADMIN
Accès : TOTAL

Menu affiché :
- Dashboard
- ADMINISTRATION (toutes les sections)
- ORGANISATION
```

## Fichiers Clés

### Backend
- `app/Http/Controllers/Api/AuthController.php` : Login et retour des permissions
- `app/Http/Middleware/TenantMiddleware.php` : Injection du tenant_id
- `database/migrations/*_create_tenant_modules_table.php`
- `database/migrations/*_create_user_module_permissions_table.php`

### Frontend
- `src/app/core/services/navigation.service.ts` : Construction du menu dynamique
- `src/app/core/services/auth.service.ts` : Gestion de l'authentification et permissions
- `src/app/layout/default-layout/default-layout.component.ts` : Chargement du menu

## Débogage

### Vérifier le rôle d'un utilisateur
Console navigateur :
```javascript
// Voir les logs du NavigationService
NavigationService - User: user@example.com
NavigationService - User roles: [{name: "USER"}]
NavigationService - Detected role: USER
NavigationService - isSuperAdmin: false
NavigationService - isTenantAdmin: false
```

### Vérifier les permissions en base
```sql
-- Rôle de l'utilisateur
SELECT u.email, r.name as role 
FROM users u 
LEFT JOIN model_has_roles mhr ON u.id = mhr.model_id 
LEFT JOIN roles r ON mhr.role_id = r.id 
WHERE u.email = 'sire@gmail.com';

-- Permissions modules de l'utilisateur
SELECT * FROM user_module_permissions WHERE user_id = 2;

-- Modules du tenant
SELECT t.name, m.code, tm.is_active 
FROM tenants t 
JOIN tenant_modules tm ON t.id = tm.tenant_id 
JOIN modules m ON tm.module_id = m.id 
WHERE t.id = 1;
```

## Points Importants

1. ✅ **ADMINISTRATION** est réservée uniquement au SUPER_ADMIN
2. ✅ **ORGANISATION** est visible pour SUPER_ADMIN et ADMIN
3. ✅ Les modules sont filtrés selon les permissions utilisateur ET tenant
4. ✅ Un utilisateur sans permissions ne voit que le Dashboard
5. ✅ Le menu est dynamique et se met à jour selon les permissions

## Résolution des Problèmes

### Problème : ADMINISTRATION visible pour tous
**Cause** : Le rôle n'est pas correctement détecté
**Solution** : Vérifier que `user.roles[0].name` retourne le bon rôle

### Problème : Modules non filtrés
**Cause** : `getUserAccessibleModules()` ne filtre pas correctement
**Solution** : Vérifier que `user_module_permissions.is_active = true`

### Problème : Menu vide
**Cause** : `authState.user` est null ou roles est vide
**Solution** : Vérifier le localStorage et recharger les données utilisateur
