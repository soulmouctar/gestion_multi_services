export const environment = {
  production: true,
  apiUrl: 'https://api.saas-management.com/api',
  appUrl: 'https://app.saas-management.com',
  
  // Multi-tenant configuration
  multiTenant: true,
  
  // Modules configuration
  modules: {
    COMMERCIAL: {
      code: 'COMMERCIAL',
      name: 'Gestion Commerciale',
      icon: 'cil-cart',
      enabled: true
    },
    FINANCE: {
      code: 'FINANCE',
      name: 'Gestion Financière',
      icon: 'cil-dollar',
      enabled: true
    },
    CLIENTS_SUPPLIERS: {
      code: 'CLIENTS_SUPPLIERS',
      name: 'Clients & Fournisseurs',
      icon: 'cil-people',
      enabled: true
    },
    PRODUCTS_STOCK: {
      code: 'PRODUCTS_STOCK',
      name: 'Produits & Stock',
      icon: 'cil-box',
      enabled: true
    },
    CONTAINERS: {
      code: 'CONTAINERS',
      name: 'Conteneurs',
      icon: 'cil-truck',
      enabled: true
    },
    RENTAL: {
      code: 'RENTAL',
      name: 'Location Immobilière',
      icon: 'cil-home',
      enabled: true
    },
    TAXI: {
      code: 'TAXI',
      name: 'Gestion Taxi',
      icon: 'cil-car-alt',
      enabled: true
    },
    STATISTICS: {
      code: 'STATISTICS',
      name: 'Statistiques',
      icon: 'cil-chart-pie',
      enabled: true
    }
  },
  
  // Currency configuration
  currencies: {
    default: 'USD',
    supported: ['USD', 'GNF'],
    exchangeRateApi: 'https://api.exchangerate-api.com/v4/latest/USD'
  },
  
  // File upload configuration
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    uploadUrl: 'https://api.saas-management.com/api/upload'
  },
  
  // PDF configuration
  pdf: {
    logoUrl: '/assets/images/logo.png',
    companyName: 'SaaS Management Platform',
    companyAddress: 'Conakry, Guinée',
    companyPhone: '+224 XXX XXX XXX',
    companyEmail: 'contact@saas-management.com'
  },
  
  // Payment configuration
  payment: {
    orangeMoney: {
      enabled: true,
      apiKey: 'prod-key'
    },
    bankTransfer: {
      enabled: true,
      accounts: [
        {
          bank: 'BCRG',
          accountNumber: 'XXXXXXX',
          accountName: 'SaaS Management'
        },
        {
          bank: 'Ecobank',
          accountNumber: 'XXXXXXX',
          accountName: 'SaaS Management'
        }
      ]
    }
  },
  
  // Notifications
  notifications: {
    email: {
      enabled: true,
      fromEmail: 'noreply@saas-management.com'
    },
    sms: {
      enabled: true,
      provider: 'orange-sms'
    }
  },
  
  // Security
  security: {
    tokenExpiration: 24 * 60 * 60, // 24 hours in seconds
    refreshTokenExpiration: 7 * 24 * 60 * 60, // 7 days in seconds
    passwordMinLength: 8,
    requireStrongPassword: true
  },
  
  // UI Configuration
  ui: {
    theme: 'default',
    language: 'fr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: '24h',
    pageSize: 20
  }
};
