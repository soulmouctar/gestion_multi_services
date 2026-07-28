<?php

namespace App\Http\Controllers\Api;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Building;
use App\Models\Client;
use App\Models\Container;
use App\Models\ContainerArrival;
use App\Models\ContainerSale;
use App\Models\DailyPayment;
use App\Models\Driver;
use App\Models\Floor;
use App\Models\HousingUnit;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\Location;
use App\Models\Payment;
use App\Models\PersonalExpense;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\Taxi;
use App\Models\Unit;
use App\Models\VehicleExpense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Controleur unifie pour la gestion de la corbeille des entites en SoftDeletes.
 *
 * Routes :
 *   GET    /api/trash/{entity}                  -> liste corbeille
 *   POST   /api/trash/{entity}/{id}/restore     -> restaure l'element
 *   DELETE /api/trash/{entity}/{id}/force       -> supprime definitivement
 *
 * Entites supportees : product, client, supplier, invoice, payment, category, unit, expense
 */
class TrashController extends BaseController
{
    /** Mapping clé URL → [classe Eloquent, libellé humain, champ titre]. */
    private const ENTITIES = [
        // Commerce
        'product'             => [Product::class,         'Produit',                 'name'],
        'client'              => [Client::class,          'Client',                  'name'],
        'supplier'            => [Supplier::class,        'Fournisseur',             'name'],
        'invoice'             => [Invoice::class,         'Facture',                 'invoice_number'],
        'payment'             => [Payment::class,         'Paiement',                'receipt_number'],
        'category'            => [ProductCategory::class, 'Catégorie',               'name'],
        'unit'                => [Unit::class,            'Unité de mesure',         'name'],
        'expense'             => [PersonalExpense::class, 'Dépense',                 'title'],
        // Conteneurs
        'container'           => [Container::class,        'Conteneur',              'container_number'],
        'container-arrival'   => [ContainerArrival::class, 'Arrivage conteneur',     'description'],
        'container-sale'      => [ContainerSale::class,    'Vente conteneur',        'sale_date'],
        // Immobilier
        'location'            => [Location::class,    'Emplacement immobilier',      'name'],
        'building'            => [Building::class,    'Bâtiment',                    'name'],
        'floor'               => [Floor::class,       'Étage',                       'name'],
        'housing-unit'        => [HousingUnit::class, 'Logement',                    'unit_number'],
        'lease'               => [Lease::class,       'Bail',                        'renter_name'],
        // Taxi
        'driver'              => [Driver::class,         'Chauffeur',                'name'],
        'taxi'                => [Taxi::class,            'Véhicule taxi',            'plate_number'],
        'vehicle-expense'     => [VehicleExpense::class,  'Dépense véhicule',         'description'],
        'daily-payment'       => [DailyPayment::class,    'Versement journalier',     'payment_date'],
        // Banque
        'bank-account'        => [BankAccount::class,     'Compte bancaire',          'account_name'],
        'bank-transaction'    => [BankTransaction::class, 'Transaction bancaire',     'reference'],
    ];

    /** Liste tous les types disponibles avec leur compteur de corbeille. */
    public function summary()
    {
        $user     = Auth::user();
        $tenantId = $user->tenant_id;

        $rows = [];
        foreach (self::ENTITIES as $key => [$class, $label]) {
            $q = $class::onlyTrashed();
            if ($this->modelHasTenant($class)) {
                $q->where('tenant_id', $tenantId);
            }
            $rows[] = [
                'key'   => $key,
                'label' => $label,
                'count' => $q->count(),
            ];
        }
        return $this->sendResponse($rows, 'Trash summary');
    }

    /** Liste les elements supprimes d'une entite (enrichi avec metadata). */
    public function index(Request $request, string $entity)
    {
        [$class, $label, $titleField] = $this->resolveEntity($entity);
        $user = Auth::user();

        $query = $class::onlyTrashed()
            ->with($this->relationsFor($entity))
            ->orderByDesc('deleted_at');

        if ($this->modelHasTenant($class) && !$user->hasRole('SUPER_ADMIN')) {
            $query->where('tenant_id', $user->tenant_id);
        }
        if ($request->filled('search')) {
            $query->where($titleField, 'like', '%' . $request->search . '%');
        }

        $items = $query->limit((int) $request->get('per_page', 50))->get()
            ->map(fn ($m) => $this->serializeItem($m, $entity, $label, $titleField));

        return $this->sendResponse($items, 'Trashed items retrieved');
    }

    /** Relations a eager-loader selon le type d'entite. */
    private function relationsFor(string $entity): array
    {
        return match ($entity) {
            'invoice'           => ['client:id,name'],
            'payment'           => ['client:id,name'],
            'container-arrival' => ['container:id,container_number', 'supplier:id,name', 'productCategory:id,name'],
            'container-sale'    => ['client:id,name', 'containerArrival:id,container_id,product_type'],
            'lease'             => ['housingUnit:id,unit_number'],
            'housing-unit'      => ['building:id,name'],
            'floor'             => ['building:id,name'],
            'bank-transaction'  => ['bankAccount:id,bank_name,account_name'],
            'vehicle-expense'   => ['taxi:id,plate_number'],
            'daily-payment'     => ['driver:id,name', 'taxi:id,plate_number'],
            default             => [],
        };
    }

    /** Construit le payload d'un item de corbeille avec un titre et un sous-titre contextuel. */
    private function serializeItem($m, string $entity, string $label, string $titleField): array
    {
        $title    = $this->buildTitle($m, $entity, $titleField);
        $subtitle = $this->buildSubtitle($m, $entity);
        $extras   = $this->buildExtras($m, $entity);

        return [
            'id'         => $m->id,
            'title'      => $title,
            'subtitle'   => $subtitle,
            'extras'     => $extras,
            'deleted_at' => $m->deleted_at,
            'created_at' => $m->created_at,
            'entity'     => $entity,
            'label'      => $label,
        ];
    }

    private function buildTitle($m, string $entity, string $titleField): string
    {
        $val = $m->{$titleField} ?? null;
        if ($val) return (string) $val;
        // Fallback intelligent
        return match ($entity) {
            'container-arrival' => 'Arrivage #' . $m->id,
            'container-sale'    => 'Vente #' . $m->id,
            'payment'           => 'Paiement #' . $m->id,
            'invoice'           => 'Facture #' . $m->id,
            default             => '#' . $m->id,
        };
    }

    private function buildSubtitle($m, string $entity): ?string
    {
        return match ($entity) {
            'product'           => trim(($m->sku ? "SKU {$m->sku} · " : '') . 'Stock : ' . ((int) $m->stock_quantity)),
            'client'            => $m->phone1 ?: $m->email,
            'supplier'          => $m->phone1 ?: $m->category,
            'invoice'           => ($m->client?->name ?? 'Client inconnu') . ' · ' . number_format((float) $m->total_amount, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF'),
            'payment'           => ($m->client?->name ?? '—') . ' · ' . number_format((float) $m->amount, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF') . ' (' . $m->method . ')',
            'expense'           => $m->amount ? (number_format((float) $m->amount, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF')) : null,
            'container'         => $m->shipping_number ?: ('Capacité : ' . $m->capacity),
            'container-arrival' => $this->arrivalSubtitle($m),
            'container-sale'    => $this->saleSubtitle($m),
            'lease'             => 'Logement : ' . ($m->housingUnit?->unit_number ?? '—') . ' · ' . number_format((float) ($m->monthly_rent ?? 0), 0, ',', ' ') . ' GNF/mois',
            'housing-unit'      => 'Bâtiment : ' . ($m->building?->name ?? '—'),
            'floor'             => 'Bâtiment : ' . ($m->building?->name ?? '—'),
            'driver'            => $m->phone ?? null,
            'taxi'              => $m->brand ? ($m->brand . ' ' . ($m->model ?? '')) : null,
            'vehicle-expense'   => ($m->taxi?->plate_number ? 'Véhicule ' . $m->taxi->plate_number . ' · ' : '') . number_format((float) ($m->amount ?? 0), 0, ',', ' ') . ' GNF',
            'daily-payment'     => ($m->driver?->name ?? '—') . ' · ' . number_format((float) ($m->amount ?? 0), 0, ',', ' ') . ' GNF',
            'bank-account'      => $m->bank_name . ' · ' . $m->account_number,
            'bank-transaction'  => ($m->bankAccount?->account_name ?? '—') . ' · ' . number_format((float) $m->amount, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF'),
            default             => null,
        };
    }

    /** Badges supplementaires (key => value) pour afficher en colonnes. */
    private function buildExtras($m, string $entity): array
    {
        return match ($entity) {
            'product' => array_filter([
                'Prix vente' => $m->selling_price ? number_format((float) $m->selling_price, 0, ',', ' ') . ' GNF' : null,
                'Statut'     => $m->status,
            ]),
            'container-arrival' => array_filter([
                'Conteneur'  => $m->container?->container_number ?? null,
                'Catégorie'  => $m->productCategory?->name ?? $m->product_type ?? null,
                'Fournisseur'=> $m->supplier?->name ?? null,
                'Qté totale' => $m->total_quantity ? ($m->total_quantity . ' u.') : null,
                'Balles'     => $m->bale_quantity ? ($m->bale_quantity . ' balle(s)') : null,
                'Coût achat' => $m->purchase_price ? (number_format((float) $m->purchase_price, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF')) : null,
            ]),
            'container-sale' => array_filter([
                'Type vente' => $m->sale_type,
                'Quantité'   => $m->quantity_sold,
                'Prix vente' => number_format((float) $m->sale_price, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF'),
                'Statut'     => $m->status,
            ]),
            'invoice' => array_filter([
                'N°'      => $m->invoice_number,
                'Statut'  => $m->status,
                'Payé'    => number_format((float) $m->paid_amount, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF'),
            ]),
            'payment' => array_filter([
                'Reçu'    => $m->receipt_number,
                'Statut'  => $m->status,
                'Date'    => $m->payment_date,
            ]),
            default => [],
        };
    }

    private function arrivalSubtitle($m): string
    {
        $parts = [];
        if ($m->productCategory?->name) $parts[] = $m->productCategory->name;
        elseif ($m->product_type)       $parts[] = ucfirst(strtolower($m->product_type));
        if ($m->container?->container_number) $parts[] = 'Conteneur ' . $m->container->container_number;
        if ($m->supplier?->name)              $parts[] = 'Fournisseur ' . $m->supplier->name;
        return $parts ? implode(' · ', $parts) : 'Arrivage';
    }

    private function saleSubtitle($m): string
    {
        $parts = [];
        if ($m->client?->name) $parts[] = $m->client->name;
        if ($m->sale_type)     $parts[] = 'Vente ' . strtolower($m->sale_type);
        if ($m->sale_price)    $parts[] = number_format((float) $m->sale_price, 0, ',', ' ') . ' ' . ($m->currency ?? 'GNF');
        return $parts ? implode(' · ', $parts) : 'Vente';
    }

    /** Restaure un element supprime. */
    public function restore(string $entity, int $id)
    {
        [$class] = $this->resolveEntity($entity);
        $user = Auth::user();

        $item = $class::onlyTrashed()->find($id);
        if (!$item) return $this->sendError('Element introuvable', [], 404);
        if ($this->modelHasTenant($class) && !$user->hasRole('SUPER_ADMIN')
            && $item->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $item->restore();
        return $this->sendResponse(['id' => $id], 'Restauré avec succès');
    }

    /** Supprime definitivement (force delete). */
    public function forceDestroy(string $entity, int $id)
    {
        [$class] = $this->resolveEntity($entity);
        $user = Auth::user();

        $item = $class::onlyTrashed()->find($id);
        if (!$item) return $this->sendError('Element introuvable', [], 404);
        if ($this->modelHasTenant($class) && !$user->hasRole('SUPER_ADMIN')
            && $item->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $item->forceDelete();
        return $this->sendResponse(['id' => $id], 'Supprimé définitivement');
    }

    /** Vide entierement une corbeille (force delete sur tout). */
    public function emptyAll(string $entity)
    {
        [$class] = $this->resolveEntity($entity);
        $user = Auth::user();

        $q = $class::onlyTrashed();
        if ($this->modelHasTenant($class) && !$user->hasRole('SUPER_ADMIN')) {
            $q->where('tenant_id', $user->tenant_id);
        }
        $count = $q->count();
        $q->forceDelete();

        return $this->sendResponse(['deleted' => $count], "$count élément(s) supprimé(s) définitivement");
    }

    private function resolveEntity(string $key): array
    {
        if (!isset(self::ENTITIES[$key])) {
            abort(response()->json(['success' => false, 'message' => "Entité {$key} inconnue"], 422));
        }
        return self::ENTITIES[$key];
    }

    private function modelHasTenant(string $class): bool
    {
        $model = new $class();
        return in_array('tenant_id', $model->getFillable(), true)
            || \Schema::hasColumn($model->getTable(), 'tenant_id');
    }
}
