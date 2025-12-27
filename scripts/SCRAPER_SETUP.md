# Agmarknet Mandi Data Scraper - Setup Guide

## Overview

This script injects into the Agmarknet 2.0 portal (https://agmarknet.gov.in) via **Requestly** browser extension to scrape live Mandi pricing data and sync it directly to Anna Bazaar's Firestore database.

## Prerequisites

1. **Requestly Browser Extension**
   - [Chrome](https://chrome.google.com/webstore/detail/requestly/mdnleldcmiljblolnjhpnblkcekpdkpa)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/requestly/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/requestly/fhopacabpgpplmjenggcnamnbgkfckhd)

2. **Firebase Firestore** - Ensure your Firestore security rules allow writes to `mandiPrices` collection

---

## Requestly Configuration

### Step 1: Open Requestly

1. Click the Requestly icon in your browser toolbar
2. Click **"New Rule"** → **"Insert Script"**

### Step 2: Configure the Rule

| Field | Value |
|-------|-------|
| **Rule Name** | `Anna Bazaar - Agmarknet Sync` |
| **Source URL** | `Contains` → `agmarknet.gov.in` |
| **Request URL Pattern** | `*://agmarknet.gov.in/*` |

### Step 3: Add the Script

1. Select **"Insert Custom Script"**
2. Choose **"After Page Load"** (critical!)
3. Paste the contents of `agmarknet-scraper.js`

### Step 4: Save & Enable

1. Click **Save Rule**
2. Ensure the toggle is **ON** (green)

---

## Usage Instructions

### During Hackathon Demo:

1. **Navigate to Agmarknet Portal**
   ```
   https://agmarknet.gov.in/daily-price-and-arrival-report
   ```

2. **Select Filters**
   - State → e.g., "West Bengal"
   - District → e.g., "Kolkata"
   - Commodity → e.g., "Rice" or "All"
   - Date Range → Today's date

3. **Click "Go" Button**
   - Wait for the data table to load
   - You'll see a toast: "Mandi data loaded! Click Anna Bazaar Sync to upload"

4. **Click the Floating "Anna Bazaar Sync" Button**
   - Located at bottom-right corner
   - Watch as rows turn green (successful sync)
   - Progress bar shows sync status

5. **Verify in Firebase Console**
   - Open Firebase Console → Firestore
   - Check `mandiPrices` collection for new documents

---

## Features

### Visual Feedback
- ✅ **Green rows** = Successfully synced to Firestore
- ❌ **Red rows** = Sync failed (check console)
- 🔄 **Spinning icon** = Sync in progress
- 📊 **Progress bar** = Shows completion percentage

### Deduplication
The script uses **PATCH** requests with deterministic document IDs:
```
{state}_{district}_{market}_{commodity}
```
This ensures the same market/commodity pair is always overwritten, preventing duplicates.

### Data Fields Synced

| Field | Source | Type |
|-------|--------|------|
| `state` | Dropdown/Table | String |
| `district` | Dropdown/Table | String |
| `market` | Column 4 | String |
| `commodity` | Column 5 | String |
| `variety` | Column 6 | String |
| `grade` | Column 7 | String |
| `minPrice` | Column 8 | Number (₹/Quintal) |
| `maxPrice` | Column 9 | Number (₹/Quintal) |
| `modalPrice` | Column 10 | Number (₹/Quintal) |
| `reportDate` | Column 11 | ISO Timestamp |
| `source` | Auto | "agmarknet" |
| `isVerified` | Auto | true |
| `lastUpdated` | Auto | ISO Timestamp |

---

## Firestore Security Rules

Add these rules to allow the scraper to write data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Mandi Prices - Allow authenticated writes OR from known origins
    match /mandiPrices/{docId} {
      allow read: if true;
      allow write: if request.auth != null 
        || request.resource.data.source == 'agmarknet';
    }
  }
}
```

> ⚠️ **For hackathon demo only** - In production, implement proper authentication.

---

## Troubleshooting

### "Table not found" Error
- Make sure you clicked the "Go" button on Agmarknet
- Wait for the table to fully load (network may be slow)

### CORS Errors
- The script attempts CORS-safe requests
- If blocked, check browser console for details
- Ensure Firestore project has correct CORS settings

### Sync Button Not Appearing
- Verify Requestly rule is enabled
- Refresh the Agmarknet page
- Check console for JavaScript errors

### Partial Sync (Some Rows Red)
- Check browser console for specific error messages
- May indicate rate limiting - wait a few seconds and retry
- Verify Firestore security rules allow writes

---

## Console Commands (Advanced)

Open DevTools (F12) and use these commands:

```javascript
// Check if scraper is loaded
console.log(window.__ANNA_BAZAAR_SCRAPER__);

// Manually trigger sync (if button doesn't work)
document.getElementById('anna-bazaar-sync-btn').click();

// View extracted data without syncing
// (Run this after table loads)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AGMARKNET PORTAL                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   User clicks "Go" → Table loads with pricing data    │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   MutationObserver detects table → Shows toast        │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   User clicks "Anna Bazaar Sync" button               │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    SCRAPER ENGINE                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   1. Extract rows from #cphBody_GridArrivalData       │  │
│  │   2. Parse prices (remove commas, convert to number)  │  │
│  │   3. Generate deterministic docId for dedup           │  │
│  │   4. Convert to Firestore document format             │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Batch PATCH requests (5 concurrent, 100ms delay)    │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE FIRESTORE                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Collection: mandiPrices                             │  │
│  │   Document: {state}_{district}_{market}_{commodity}   │  │
│  │                                                       │  │
│  │   {                                                   │  │
│  │     state: "West Bengal",                             │  │
│  │     district: "Kolkata",                              │  │
│  │     market: "Sealdah",                                │  │
│  │     commodity: "Rice",                                │  │
│  │     modalPrice: 2450,                                 │  │
│  │     minPrice: 2400,                                   │  │
│  │     maxPrice: 2500,                                   │  │
│  │     source: "agmarknet",                              │  │
│  │     isVerified: true,                                 │  │
│  │     lastUpdated: "2025-12-27T10:30:00Z"               │  │
│  │   }                                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    ANNA BAZAAR APP                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Real-time Firestore listener → Dynamic Price Engine │  │
│  │   FarmerView: Mandi rates widget shows latest prices  │  │
│  │   BuyerView: AI validates offers against mandi floor  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## License

MIT License - Anna Bazaar Team, Calcutta Hacks 2025
