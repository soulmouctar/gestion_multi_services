# Guide de Gestion des Modules et Autorisations

## Vue d'ensemble

Le système de gestion des modules et autorisations permet de personnaliser l'accès aux fonctionnalités de l'application en fonction :
1. **Des modules souscrits par le tenant (entreprise)**
2. **Des permissions accordées à chaque utilisateur**

## Architecture

### 🗄️ Tables de Base de Données

#### 1. `tenant_modules`
Lie les tenants aux modules auxquels ils ont souscrit.
```sql
- tenant_id (FK → tenants)
- module_id (FK → modules)
- is_active (boolean) - Active/désactive le module pour le tenant
```

#### 2. `user_module_permissions`
Définit les permissions spécifiques de chaque utilisateur sur les modules.
```sql
- user_id (FK → users)
- module_code (string) - Code du module (ex: 'COMMERCIAL', 'FINANCE')
- module_name (string) - Nom du module
- permissions (json) - Permissions détaillées (à implémenter)
- is_active (boolean) - Active/désactive l'accès pour l'utilisateur
```

#### 3. `modules`
Liste des modules disponibles dans l'application.
```sql
- id
- code (string) - Code unique (ex: 'COMMERCIAL')
- name (string) - Nom du module
- description (text)
```

### 🔐 Logique de Vérification d'Accès

Pour qu'un utilisateur accède à un module, **DEUX conditions** doivent être remplies :

1. ✅ **Le tenant doit avoir souscrit au module** (`tenant_modules.is_active = true`)
2. ✅ **L'utilisateur doit avoir la permission** (`user_module_permissions.is_active = true`)

**Exception :** Les `SUPER_ADMIN` ont accès à tous les modules sans restriction.

## Backend (Laravel)

### Middleware `CheckTenantModule`

**Fichier :** `app/Http/Middleware/CheckTenantModule.php`

**Utilisation dans les routes :**
```php
Route::middleware(['auth:sanctum', 'tenant.module:COMMERCIAL'])->group(function () {
    Route::get('/products', [ProductController::class, 'index']);
});
```

**Paramètres :**
- `moduleCode` : Code du module à vérifier (ex: 'COMMERCIAL', 'FINANCE', 'CONTAINERS')

**Réponses :**
- ✅ 200 : Accès autorisé
- ❌ 403 : Accès refusé (tenant non souscrit ou utilisateur sans permission)

### Endpoint de Connexion Amélioré

**Endpoint :** `POST /api/login`

**Réponse enrichie :**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "...",
    "tenant_active_modules": [
      {
        "id": 1,
        "code": "COMMERCIAL",
        "name": "Gestion Commerciale",
        "description": "...",
        "is_active": true
      }
    ],
    "user_module_permissions": [
      {
        "module_code": "COMMERCIAL",
        "module_name": "Gestion Commerciale",
        "permissions": [],
        "is_active": true
      }
    ]
  }
}
```

### Enregistrement du Middleware

**Fichier :** `app/Http/Kernel.php`

```php
protected $routeMiddleware = [
    // ...
    'tenant.module' => \App\Http\Middleware\CheckTenantModule::class,
];
```

## Frontend (Angular)

### AuthService - Méthodes Ajoutées

**Fichier :** `src/app/core/services/auth.service.ts`

#### 1. `hasModuleAccess(moduleCode: string): boolean`
Vérifie si l'utilisateur a accès à un module spécifique.

```typescript
// Exemple d'utilisation
if (this.authService.hasModuleAccess('COMMERCIAL')) {
  // Afficher le menu Commercial
}
```

#### 2. `getTenantActiveModules(): any[]`
Retourne la liste des modules auxquels le tenant a souscrit.

```typescript
const modules = this.authService.getTenantActiveModules();
// [{ code: 'COMMERCIAL', name: 'Gestion Commerciale', is_active: true }, ...]
```

#### 3. `getUserAccessibleModules(): any[]`
Retourne la liste des modules accessibles par l'utilisateur (intersection tenant + permissions).

```typescript
const accessibleModules = this.authService.getUserAccessibleModules();
// Uniquement les modules où tenant.is_active = true ET user_permission.is_active = true
```

### Utilisation dans les Guards

**Exemple :** Protéger une route par module

```typescript
export const canActivateModule = (moduleCode: string): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    if (authService.hasModuleAccess(moduleCode)) {
      return true;
    }
    
    router.navigate(['/dashboard']);
    return false;
  };
};

// Dans les routes
{
  path: 'products',
  canActivate: [canActivateModule('COMMERCIAL')],
  loadComponent: () => import('./products/products.component')
}
```

### Utilisation dans les Templates

```html
<!-- Afficher un menu uniquement si l'utilisateur a accès au module -->
<li *ngIf="authService.hasModuleAccess('COMMERCIAL')">
  <a routerLink="/commercial">Gestion Commerciale</a>
</li>

<!-- Afficher la liste des modules accessibles -->
<div *ngFor="let module of authService.getUserAccessibleModules()">
  <h3>{{ module.name }}</h3>
  <p>{{ module.code }}</p>
</div>
```

## Codes de Modules Disponibles

| Code | Nom | Description |
|------|-----|-------------|
| `COMMERCIAL` | Gestion Commerciale | Ventes, factures, devis |
| `FINANCE` | Gestion Financière | Paiements, trésorerie |
| `CLIENTS_SUPPLIERS` | Clients & Fournisseurs | Gestion des contacts |
| `PRODUCTS_STOCK` | Produits & Stock | Inventaire, produits |
| `CONTAINERS` | Conteneurs | Gestion des conteneurs |
| `RENTAL` | Location Immobilière | Locations, bâtiments |
| `TAXI` | Gestion Taxi | Taxis, chauffeurs |
| `STATISTICS` | Statistiques | Rapports, analytics |

## Workflow de Configuration

### 1. Attribution des Modules au Tenant

**Via l'interface Admin :**
1. Aller dans "Tenants"
2. Sélectionner un tenant
3. Cocher les modules auxquels il souscrit
4. Activer/désactiver via `is_active`

**Via API :**
```php
// Attribuer un module à un tenant
DB::table('tenant_modules')->insert([
    'tenant_id' => 1,
    'module_id' => 2, // ID du module COMMERCIAL
    'is_active' => true
]);
```

### 2. Attribution des Permissions Utilisateur

**Via l'interface Admin :**
1. Aller dans "Users"
2. Sélectionner un utilisateur
3. Gérer les permissions de modules
4. Activer/désactiver les modules pour cet utilisateur

**Via API :**
```php
POST /api/users/{id}/module-permissions
{
  "module_permissions": [
    {
      "module_code": "COMMERCIAL",
      "module_name": "Gestion Commerciale",
      "permissions": [],
      "is_active": true
    }
  ]
}
```

## Exemples de Scénarios

### Scénario 1 : Tenant avec Module, Utilisateur sans Permission
- Tenant a souscrit à `COMMERCIAL` ✅
- Utilisateur n'a pas la permission `COMMERCIAL` ❌
- **Résultat :** Accès refusé ❌

### Scénario 2 : Tenant sans Module, Utilisateur avec Permission
- Tenant n'a pas souscrit à `FINANCE` ❌
- Utilisateur a la permission `FINANCE` ✅
- **Résultat :** Accès refusé ❌

### Scénario 3 : Tenant avec Module, Utilisateur avec Permission
- Tenant a souscrit à `CONTAINERS` ✅
- Utilisateur a la permission `CONTAINERS` ✅
- **Résultat :** Accès autorisé ✅

### Scénario 4 : Super Admin
- Utilisateur a le rôle `SUPER_ADMIN`
- **Résultat :** Accès à tous les modules ✅

## Logs et Débogage

### Backend
Les logs sont enregistrés dans `storage/logs/laravel.log` :
```php
\Log::info('Module access check', [
    'user_id' => $user->id,
    'tenant_id' => $user->tenant_id,
    'module_code' => $moduleCode,
    'has_access' => $hasAccess
]);
```

### Frontend
Les warnings sont affichés dans la console du navigateur :
```javascript
console.warn(`Tenant n'a pas souscrit au module: COMMERCIAL`);
console.warn(`Utilisateur n'a pas la permission pour le module: FINANCE`);
```

## Tests

### Tester l'accès à un module

**Backend :**
```bash
# Avec un token valide
curl -H "Authorization: Bearer {token}" \
     http://localhost:8000/api/products
```

**Frontend :**
```typescript
// Dans un composant
ngOnInit() {
  console.log('Modules du tenant:', this.authService.getTenantActiveModules());
  console.log('Modules accessibles:', this.authService.getUserAccessibleModules());
  console.log('Accès COMMERCIAL:', this.authService.hasModuleAccess('COMMERCIAL'));
}
```

## Sécurité

### Bonnes Pratiques

1. ✅ **Toujours vérifier côté backend** : Ne jamais se fier uniquement aux vérifications frontend
2. ✅ **Utiliser le middleware** : Appliquer `tenant.module:CODE` sur toutes les routes sensibles
3. ✅ **Logs d'audit** : Enregistrer les tentatives d'accès refusées
4. ✅ **Validation des données** : Valider les codes de modules avant insertion
5. ✅ **Cache** : Mettre en cache les permissions pour améliorer les performances

### Points d'Attention

- ⚠️ Les permissions sont chargées au login et stockées dans localStorage
- ⚠️ Si les permissions changent, l'utilisateur doit se reconnecter
- ⚠️ Le Super Admin bypass toutes les vérifications

## Évolutions Futures

### Permissions Granulaires
Actuellement, le champ `permissions` (JSON) est prévu mais non utilisé. Il pourra contenir :
```json
{
  "permissions": ["read", "write", "delete", "export"]
}
```

### Gestion des Quotas
Ajouter des limites par module :
```sql
ALTER TABLE tenant_modules ADD COLUMN quota_limit INT;
ALTER TABLE tenant_modules ADD COLUMN quota_used INT DEFAULT 0;
```

### Audit Trail
Enregistrer toutes les actions sur les modules :
```sql
CREATE TABLE module_access_logs (
  user_id INT,
  module_code VARCHAR(50),
  action VARCHAR(50),
  created_at TIMESTAMP
);
```

## Support

Pour toute question ou problème :
1. Vérifier les logs backend et frontend
2. Confirmer que le tenant a souscrit au module dans `tenant_modules`
3. Confirmer que l'utilisateur a la permission dans `user_module_permissions`
4. Vérifier que `is_active = true` dans les deux tables
