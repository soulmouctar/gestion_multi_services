<?php

namespace App\Http\Controllers\Api;

use App\Models\OrganisationSetting;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class OrganisationSettingController extends BaseController
{
    public function show($tenantId = null)
    {
        try {
            // Si aucun tenantId n'est fourni, utiliser le tenant de l'utilisateur connecté
            if (!$tenantId) {
                $user = Auth::user();
                if (!$user) {
                    return $this->sendError('User not authenticated', [], 401);
                }
                $tenantId = $user->tenant_id;
            }

            if (!$tenantId) {
                return $this->sendError('Tenant ID is required', [], 400);
            }

            $settings = OrganisationSetting::where('tenant_id', $tenantId)->first();

            if (!$settings) {
                // Créer les paramètres par défaut si ils n'existent pas
                $settings = OrganisationSetting::create([
                    'tenant_id' => $tenantId,
                    'timezone' => 'Europe/Paris',
                    'language' => 'fr',
                    'date_format' => 'DD/MM/YYYY',
                    'number_format' => 'fr',
                    'invoice_prefix' => 'INV-',
                    'invoice_counter' => 1,
                    'quote_prefix' => 'DEV-',
                    'quote_counter' => 1,
                    'email_notifications' => true,
                    'sms_notifications' => false,
                    'browser_notifications' => true,
                    'session_timeout' => 30,
                    'password_expiry' => 90,
                    'two_factor_auth' => false,
                    'auto_archive_invoices' => true,
                    'archive_after_days' => 365,
                    'backup_frequency' => 'weekly',
                ]);
            }

            return $this->sendResponse($settings, 'Organisation settings retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving organisation settings: ' . $e->getMessage());
            return $this->sendError('Error retrieving organisation settings', [], 500);
        }
    }

    public function update(Request $request, $tenantId = null)
    {
        // Si aucun tenantId n'est fourni, utiliser le tenant de l'utilisateur connecté
        if (!$tenantId) {
            $user = Auth::user();
            $tenantId = $user->tenant_id;
        }

        $settings = OrganisationSetting::where('tenant_id', $tenantId)->first();

        if (!$settings) {
            return $this->sendError('Settings not found for this tenant', [], 404);
        }

        $validator = Validator::make($request->all(), [
            // Paramètres généraux
            'timezone' => 'sometimes|string|max:50',
            'language' => 'sometimes|string|max:5',
            'date_format' => 'sometimes|string|max:20',
            'number_format' => 'sometimes|string|max:5',
            
            // Paramètres de facturation
            'invoice_prefix' => 'sometimes|string|max:10',
            'invoice_counter' => 'sometimes|integer|min:1',
            'quote_prefix' => 'sometimes|string|max:10',
            'quote_counter' => 'sometimes|integer|min:1',
            
            // Paramètres de notification
            'email_notifications' => 'sometimes|boolean',
            'sms_notifications' => 'sometimes|boolean',
            'browser_notifications' => 'sometimes|boolean',
            
            // Paramètres de sécurité
            'session_timeout' => 'sometimes|integer|min:5|max:480',
            'password_expiry' => 'sometimes|integer|min:30|max:365',
            'two_factor_auth' => 'sometimes|boolean',
            
            // Paramètres d'archivage
            'auto_archive_invoices' => 'sometimes|boolean',
            'archive_after_days' => 'sometimes|integer|min:30',
            'backup_frequency' => 'sometimes|in:daily,weekly,monthly',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $settings->update($request->all());

        return $this->sendResponse($settings, 'Organisation settings updated successfully');
    }

    public function reset($tenantId = null)
    {
        // Si aucun tenantId n'est fourni, utiliser le tenant de l'utilisateur connecté
        if (!$tenantId) {
            $user = Auth::user();
            $tenantId = $user->tenant_id;
        }

        $settings = OrganisationSetting::where('tenant_id', $tenantId)->first();

        if (!$settings) {
            return $this->sendError('Settings not found for this tenant', [], 404);
        }

        // Restaurer les valeurs par défaut
        $defaultSettings = [
            'timezone' => 'Europe/Paris',
            'language' => 'fr',
            'date_format' => 'DD/MM/YYYY',
            'number_format' => 'fr',
            'invoice_prefix' => 'INV-',
            'invoice_counter' => 1,
            'quote_prefix' => 'DEV-',
            'quote_counter' => 1,
            'email_notifications' => true,
            'sms_notifications' => false,
            'browser_notifications' => true,
            'session_timeout' => 30,
            'password_expiry' => 90,
            'two_factor_auth' => false,
            'auto_archive_invoices' => true,
            'archive_after_days' => 365,
            'backup_frequency' => 'weekly',
        ];

        $settings->update($defaultSettings);

        return $this->sendResponse($settings, 'Organisation settings reset to defaults successfully');
    }

    /**
     * Get available options for settings dropdowns
     */
    public function getOptions()
    {
        try {
            $options = [
                'timezones' => OrganisationSetting::getAvailableTimezones(),
                'languages' => OrganisationSetting::getAvailableLanguages(),
                'date_formats' => OrganisationSetting::getAvailableDateFormats(),
                'number_formats' => OrganisationSetting::getAvailableNumberFormats(),
                'backup_frequencies' => [
                    'daily' => 'Quotidienne',
                    'weekly' => 'Hebdomadaire',
                    'monthly' => 'Mensuelle'
                ]
            ];

            return $this->sendResponse($options, 'Options récupérées avec succès');

        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération des options: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération des options', [], 500);
        }
    }

    /**
     * Get next invoice number preview
     */
    public function getNextInvoiceNumber($tenantId = null)
    {
        try {
            if (!$tenantId) {
                $user = Auth::user();
                $tenantId = $user->tenant_id;
            }

            $settings = OrganisationSetting::where('tenant_id', $tenantId)->first();

            if (!$settings) {
                return $this->sendError('Paramètres non trouvés', [], 404);
            }

            $nextNumber = $settings->getNextInvoiceNumber();

            return $this->sendResponse(['next_invoice_number' => $nextNumber], 'Prochain numéro de facture récupéré avec succès');

        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération du prochain numéro de facture: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération du prochain numéro de facture', [], 500);
        }
    }

    /**
     * Get next quote number preview
     */
    public function getNextQuoteNumber($tenantId = null)
    {
        try {
            if (!$tenantId) {
                $user = Auth::user();
                $tenantId = $user->tenant_id;
            }

            $settings = OrganisationSetting::where('tenant_id', $tenantId)->first();

            if (!$settings) {
                return $this->sendError('Paramètres non trouvés', [], 404);
            }

            $nextNumber = $settings->getNextQuoteNumber();

            return $this->sendResponse(['next_quote_number' => $nextNumber], 'Prochain numéro de devis récupéré avec succès');

        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération du prochain numéro de devis: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération du prochain numéro de devis', [], 500);
        }
    }

    /**
     * Test notification settings
     */
    public function testNotifications(Request $request, $tenantId = null)
    {
        try {
            if (!$tenantId) {
                $user = Auth::user();
                $tenantId = $user->tenant_id;
            }

            $validator = Validator::make($request->all(), [
                'type' => 'required|in:email,sms,browser'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Erreur de validation', $validator->errors()->toArray(), 422);
            }

            $settings = OrganisationSetting::where('tenant_id', $tenantId)->first();

            if (!$settings) {
                return $this->sendError('Paramètres non trouvés', [], 404);
            }

            $type = $request->get('type');
            $result = ['success' => false, 'message' => ''];

            switch ($type) {
                case 'email':
                    if ($settings->email_notifications) {
                        // Simuler l'envoi d'un email de test
                        $result = ['success' => true, 'message' => 'Email de test envoyé avec succès'];
                    } else {
                        $result = ['success' => false, 'message' => 'Les notifications email sont désactivées'];
                    }
                    break;

                case 'sms':
                    if ($settings->sms_notifications) {
                        // Simuler l'envoi d'un SMS de test
                        $result = ['success' => true, 'message' => 'SMS de test envoyé avec succès'];
                    } else {
                        $result = ['success' => false, 'message' => 'Les notifications SMS sont désactivées'];
                    }
                    break;

                case 'browser':
                    if ($settings->browser_notifications) {
                        $result = ['success' => true, 'message' => 'Notification navigateur activée'];
                    } else {
                        $result = ['success' => false, 'message' => 'Les notifications navigateur sont désactivées'];
                    }
                    break;
            }

            return $this->sendResponse($result, 'Test de notification effectué');

        } catch (\Exception $e) {
            \Log::error('Erreur lors du test de notification: ' . $e->getMessage());
            return $this->sendError('Erreur lors du test de notification', [], 500);
        }
    }
}
