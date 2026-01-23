# Frontend Refactoring Guide

This document outlines the modular structure for the Tambola PWA frontend.

## Current State
The application currently has two large files:
- `AdminPanel.js` (~2000 lines)
- `GameDetails.js` (~1200 lines)

## Proposed Component Structure

### GameDetails Page
```
/pages/GameDetails/
├── index.js           # Main container with state management
├── components/
│   ├── LottoTicketCard.js  ✅ Created
│   ├── FullSheet.js        ✅ Created
│   └── index.js            ✅ Created
└── (future) PaymentPanel.js
```

### AdminPanel Page  
```
/pages/AdminPanel/
├── index.js           # Main container, tab navigation
├── tabs/
│   ├── CreateGameTab.js
│   ├── ManageGamesTab.js
│   ├── PaymentsTab.js
│   ├── PlayersTab.js
│   ├── RequestsTab.js
│   ├── LogsTab.js
│   └── SettingsTab.js
└── components/
    ├── GameControlModal.js  (already exists)
    └── (other shared components)
```

## Shared Configuration
```
/config/
├── paymentConfig.js  ✅ Created
└── (future) gameConfig.js
```

## Migration Strategy

When adding new features or fixing bugs in these files:
1. Extract the relevant component to its own file
2. Import it in the main file
3. Gradually migrate logic to smaller components

## Component Imports

### LottoTicketCard
```javascript
import { LottoTicketCard } from './GameDetails/components';
```

### FullSheet  
```javascript
import { FullSheet } from './GameDetails/components';
```

### Payment Config
```javascript
import { 
  UPI_ID, 
  PAYMENT_METHODS, 
  EXCHANGE_RATES 
} from '@/config/paymentConfig';
```

## Notes
- Current files are working and tested
- Full migration should be done incrementally
- Each component should have its own test file
