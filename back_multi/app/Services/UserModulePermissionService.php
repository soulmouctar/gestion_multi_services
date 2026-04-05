<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Centralise toute la logique de synchronisation des permissions
 * de modules des utilisateurs.
 *
 * Règles métier :
 * - Un utilisateur ADMIN d'un tenant doit avoir TOUS les modules actifs du tenant
 *   avec TOUTES leurs permissions, dès la création ou l'affectation au tenant.
 * - Quand un module est ajouté au tenant → propagé à tous ses ADMINs.
 * - Quand un module est retiré du tenant → révoqué à tous les utilisateurs du tenant.
 */
class UserModulePermissionService
{
    /**
     * Accorde tous les modules actifs du tenant à l'utilisateur
     * avec l'ensemble des permissions définies sur chaque module.
     * Utilise un upsert pour être idempotent.
     */
    public function grantAllTenantModules(User $user): void
    {
        if (!$user->tenant_id) {
            return;
        }

        $tenantModules = DB::table('tenant_modules')
            ->join('modules', 'tenant_modules.module_id', '=', 'modules.id')
            ->where('tenant_modules.tenant_id', $user->tenant_id)
            ->where('tenant_modules.is_active', true)
            ->select('modules.code', 'modules.name', 'modules.permissions')
            ->get();

        foreach ($tenantModules as $module) {
            $permissions = is_array($module->permissions)
                ? $module->permissions
                : (json_decode($module->permissions, true) ?? []);

            $this->upsertPermission($user->id, $module->code, $module->name, $permissions, true);
        }
    }

    /**
     * Propage un nouveau module (ajouté au tenant) à tous les ADMINs du tenant.
     */
    public function propagateModuleToAdmins(int $tenantId, string $moduleCode, string $moduleName, array $permissions = []): void
    {
        $adminIds = User::where('tenant_id', $tenantId)
            ->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
            ->pluck('id');

        foreach ($adminIds as $adminId) {
            $this->upsertPermission($adminId, $moduleCode, $moduleName, $permissions, true);
        }
    }

    /**
     * Révoque un module pour tous les utilisateurs du tenant
     * (quand le module est retiré du tenant).
     */
    public function revokeModuleFromTenantUsers(int $tenantId, string $moduleCode): void
    {
        $userIds = User::where('tenant_id', $tenantId)->pluck('id');

        if ($userIds->isEmpty()) {
            return;
        }

        DB::table('user_module_permissions')
            ->whereIn('user_id', $userIds)
            ->where('module_code', $moduleCode)
            ->delete();
    }

    /**
     * Recalcule les permissions d'un utilisateur après un changement de tenant ou de rôle.
     * - Nouveau tenant → efface l'ancien mapping et repart des modules du nouveau tenant.
     * - Rôle ADMIN → accès complet au tenant.
     */
    public function syncAfterUserUpdate(User $user, ?int $previousTenantId): void
    {
        // Si le tenant a changé, supprimer les anciennes permissions
        if ($previousTenantId && $previousTenantId !== $user->tenant_id) {
            DB::table('user_module_permissions')
                ->where('user_id', $user->id)
                ->delete();
        }

        if (!$user->tenant_id) {
            return;
        }

        $role = $user->roles->first()?->name;

        if ($role === 'ADMIN') {
            $this->grantAllTenantModules($user);
        }
    }

    // -------------------------------------------------------------------------

    private function upsertPermission(int $userId, string $code, string $name, array $permissions, bool $isActive): void
    {
        DB::table('user_module_permissions')
            ->upsert(
                [
                    [
                        'user_id'     => $userId,
                        'module_code' => $code,
                        'module_name' => $name,
                        'permissions' => json_encode($permissions),
                        'is_active'   => $isActive,
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ],
                ],
                ['user_id', 'module_code'],   // clés uniques
                ['module_name', 'permissions', 'is_active', 'updated_at']  // colonnes à mettre à jour
            );
    }
}
