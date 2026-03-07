<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrganisationSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'timezone',
        'language',
        'date_format',
        'number_format',
        'invoice_prefix',
        'invoice_counter',
        'quote_prefix',
        'quote_counter',
        'email_notifications',
        'sms_notifications',
        'browser_notifications',
        'session_timeout',
        'password_expiry',
        'two_factor_auth',
        'auto_archive_invoices',
        'archive_after_days',
        'backup_frequency',
    ];

    protected $casts = [
        'email_notifications' => 'boolean',
        'sms_notifications' => 'boolean',
        'browser_notifications' => 'boolean',
        'two_factor_auth' => 'boolean',
        'auto_archive_invoices' => 'boolean',
        'invoice_counter' => 'integer',
        'quote_counter' => 'integer',
        'session_timeout' => 'integer',
        'password_expiry' => 'integer',
        'archive_after_days' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    // Relations
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // Scopes
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    // Accessors
    public function getFormattedTimezoneAttribute()
    {
        return str_replace('_', ' ', $this->timezone);
    }

    public function getLanguageNameAttribute()
    {
        $languages = [
            'fr' => 'Français',
            'en' => 'English',
            'es' => 'Español'
        ];
        
        return $languages[$this->language] ?? $this->language;
    }

    public function getBackupFrequencyLabelAttribute()
    {
        $labels = [
            'daily' => 'Quotidienne',
            'weekly' => 'Hebdomadaire',
            'monthly' => 'Mensuelle'
        ];
        
        return $labels[$this->backup_frequency] ?? $this->backup_frequency;
    }

    // Helper methods
    public function getNextInvoiceNumber()
    {
        return $this->invoice_prefix . str_pad($this->invoice_counter, 4, '0', STR_PAD_LEFT);
    }

    public function getNextQuoteNumber()
    {
        return $this->quote_prefix . str_pad($this->quote_counter, 4, '0', STR_PAD_LEFT);
    }

    public function incrementInvoiceCounter()
    {
        $this->increment('invoice_counter');
        return $this->getNextInvoiceNumber();
    }

    public function incrementQuoteCounter()
    {
        $this->increment('quote_counter');
        return $this->getNextQuoteNumber();
    }

    public function isSessionExpired($lastActivity)
    {
        $timeout = $this->session_timeout * 60; // Convert minutes to seconds
        return (time() - strtotime($lastActivity)) > $timeout;
    }

    public function isPasswordExpired($passwordChangedAt)
    {
        $expiry = $this->password_expiry * 24 * 60 * 60; // Convert days to seconds
        return (time() - strtotime($passwordChangedAt)) > $expiry;
    }

    public function shouldArchiveInvoice($invoiceDate)
    {
        if (!$this->auto_archive_invoices) {
            return false;
        }
        
        $archiveThreshold = $this->archive_after_days * 24 * 60 * 60; // Convert days to seconds
        return (time() - strtotime($invoiceDate)) > $archiveThreshold;
    }

    // Static methods
    public static function getDefaultSettings()
    {
        return [
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
            'backup_frequency' => 'weekly'
        ];
    }

    public static function getAvailableTimezones()
    {
        return [
            'Europe/Paris' => 'Paris (GMT+1)',
            'Africa/Conakry' => 'Conakry (GMT+0)',
            'America/New_York' => 'New York (GMT-5)',
            'Asia/Tokyo' => 'Tokyo (GMT+9)',
            'UTC' => 'UTC (GMT+0)'
        ];
    }

    public static function getAvailableLanguages()
    {
        return [
            'fr' => 'Français',
            'en' => 'English',
            'es' => 'Español'
        ];
    }

    public static function getAvailableDateFormats()
    {
        return [
            'DD/MM/YYYY' => 'DD/MM/YYYY (31/12/2023)',
            'MM/DD/YYYY' => 'MM/DD/YYYY (12/31/2023)',
            'YYYY-MM-DD' => 'YYYY-MM-DD (2023-12-31)',
            'DD-MM-YYYY' => 'DD-MM-YYYY (31-12-2023)'
        ];
    }

    public static function getAvailableNumberFormats()
    {
        return [
            'fr' => 'Français (1 234,56)',
            'en' => 'Anglais (1,234.56)',
            'de' => 'Allemand (1.234,56)'
        ];
    }
}
