// Payment Configuration - Single source of truth
// India - UPI
export const UPI_ID = 'choegyalsangpo@ibl';
export const UPI_PAYEE_NAME = 'Choegyal Sangpo';

// Canada - Interac e-Transfer
export const INTERAC_EMAIL = 'payments@sixseventambola.ca';
export const INTERAC_AUTO_DEPOSIT = true;

// Europe - Wero / SEPA
export const WERO_PHONE = '+33612345678';
export const WERO_RECIPIENT = 'SixSeven Tambola';
export const SEPA_IBAN = 'FR76 3000 1007 1600 0000 0000 123';
export const SEPA_BIC = 'BNPAFRPP';

// WhatsApp for all regions
export const WHATSAPP_NUMBER = '918837489781';
export const WHATSAPP_DISPLAY = '+91 8837489781';

// Exchange rates (INR as base currency)
export const EXCHANGE_RATES = {
  INR: 1,
  CAD: 0.016,  // 1 INR = 0.016 CAD (approx)
  EUR: 0.011   // 1 INR = 0.011 EUR (approx)
};

// Payment methods configuration
export const PAYMENT_METHODS = {
  upi: {
    id: 'upi',
    name: 'UPI',
    icon: '🇮🇳',
    currency: '₹',
    currencyCode: 'INR',
    region: 'india',
    exchangeRate: EXCHANGE_RATES.INR
  },
  interac: {
    id: 'interac',
    name: 'Interac e-Transfer',
    icon: '🇨🇦',
    currency: '$',
    currencyCode: 'CAD',
    region: 'canada',
    exchangeRate: EXCHANGE_RATES.CAD
  },
  wero: {
    id: 'wero',
    name: 'Wero',
    icon: '🇪🇺',
    currency: '€',
    currencyCode: 'EUR',
    region: 'europe',
    exchangeRate: EXCHANGE_RATES.EUR
  }
};

// Region to default payment method mapping
export const REGION_DEFAULTS = {
  india: 'upi',
  canada: 'interac',
  europe: 'wero',
  default: 'upi'
};
