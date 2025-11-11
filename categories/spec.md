# SpendScope Category System Specification

## Overview

This document defines the categorization system for the SpendScope spending analyzer. The goal is to accurately categorize credit card transactions to provide meaningful spending insights.

## Design Principles

1. **Specificity over generality**: More specific categories (e.g., "Japanese Restaurants") are checked before general ones (e.g., "Restaurants (General)")
2. **Priority-based matching**: Categories have priority levels (0-100) to control matching order
3. **Pattern + Keyword matching**: Uses both regex patterns (precise) and keyword substring matching (flexible)
4. **Exclusion patterns**: Some categories can exclude transactions matching certain patterns (e.g., Rideshare excludes "eats")
5. **Extensible**: Easy to add new merchants, keywords, and categories

## Category Hierarchy

### Food Delivery Apps (Priority: 100)
Separate from regular restaurants for tracking delivery habits:

| Category | Examples |
|----------|----------|
| **Uber Eats** | UBER CANADA/UBEREATS, UBER* EATS |
| **DoorDash** | DOORDASH |
| **Skip The Dishes** | SKIPTHEDISHES |
| **Fantuan** | FANTUAN |
| **Hungry Panda** | HUNGRY PANDA |

> **Note**: Uber Eats is its own category, separate from Rideshare. This allows tracking food delivery spending independently.

### Rideshare & Transportation (Priority: 80-95)

| Category | Examples |
|----------|----------|
| **Rideshare** | UBER CANADA, UBER HOLDINGS, LYFT, UBERTRIP |
| **Public Transit** | COMPASS ACCOUNT, TRANSLINK |
| **Parking** | EASY PARK, PAYBYPHONE, IMPARK |

### Restaurants by Cuisine (Priority: 85)
Fine-grained restaurant categorization by cuisine type:

| Category | Common Keywords/Merchants |
|----------|---------------------------|
| **Japanese Restaurants** | sushi, ramen, izakaya, teriyaki, GAYA SUSHI, NEMO SUSHI BAR, SAKU |
| **Chinese Restaurants** | dim sum, dumpling, wok, PEKING RESTAURANT, T&T |
| **Vietnamese Restaurants** | pho, banh mi, LE PETIT SAIGON |
| **Korean Restaurants** | korean bbq, bulgogi, bibimbap |
| **Indian Restaurants** | curry, tandoori, masala |
| **Thai Restaurants** | pad thai, tom yum |
| **Mexican Restaurants** | taco, burrito, CHIPOTLE |
| **Italian Restaurants** | pizza, pasta, BOSTON PIZZA |
| **Fish & Chips** | COCKNEY KINGS, fish and chips |
| **Fast Food** | MCDONALD'S, A AND W, SUBWAY, WENDY'S |
| **Cafes & Coffee** | STARBUCKS, TIM HORTONS, BASTION CAFE |
| **Restaurants (General)** | Generic restaurants, TST- prefix, bistro, grill |

### Groceries & Food Shopping (Priority: 72-78)

| Category | Examples |
|----------|----------|
| **Groceries** | COSTCO, SUPERSTORE, SAFEWAY, INSTACART, HARVEST GROCERY |
| **Convenience Stores** | 7-ELEVEN (non-gas transactions), CIRCLE K |

### Shopping & Retail (Priority: 70-90)

| Category | Examples |
|----------|----------|
| **Amazon** | AMAZON, AMZN MKTP, AMAZON.CA |
| **Clothing & Fashion** | UNIQLO, H&M, JACK & JONES, LULULEMON |
| **Electronics** | BEST BUY, APPLE STORE, MEMORY EXPRESS |
| **Home & Hardware** | IKEA, HOME DEPOT, CANADIAN TIRE |
| **Books & Education** | UBC BOOKSTORE, CHAPTERS, INDIGO |
| **Shopping (General)** | EBAY, ETSY, DOLLARAMA |

### Gas & Auto (Priority: 80-85)

| Category | Examples |
|----------|----------|
| **Gas** | ESSO 7-ELEVEN, SHELL, PETRO CANADA |
| **Auto & Vehicle** | DRIVER SERVICES CENTRE, MR LUBE, KAL TIRE |

### Entertainment & Gaming (Priority: 82-85)

| Category | Examples |
|----------|----------|
| **Gaming** | STEAM, PLAYSTATION, LOOTBAR, KURO GAMES |
| **Movies & Events** | CINEPLEX, TICKETMASTER, VIAGOGO, PNE |

### Subscriptions (Priority: 88)

A unified category for all recurring subscription-based services:

| Category | Examples |
|----------|----------|
| **Subscriptions** | All recurring subscription services consolidated |

**Includes:**
- **AI Services**: OPENAI, CHATGPT, CLAUDE, ANTHROPIC, MIDJOURNEY, COPILOT, PERPLEXITY
- **Software & Productivity**: ADOBE, NOTION, FIGMA, CANVA, SLACK, ZOOM
- **Cloud Storage**: GOOGLE ONE, GOOGLE PREMIUM, ICLOUD, MICROSOFT 365
- **Streaming & Entertainment**: NETFLIX, SPOTIFY, DISNEY+, YOUTUBE PREMIUM, CRAVE, AUDIBLE
- **Municipal Memberships**: CITY BURNABY RECREATIO, CHRISTINE SINCLAIR, CITY RECREATION
- **App Store & General**: APPLE.COM/BILL, GOOGLE PLAY, PATREON

> **Note**: Recreation memberships (City of Burnaby, community centres) are grouped with subscriptions since they represent recurring monthly/annual payments.

### Health & Fitness (Priority: 78-80)

| Category | Examples |
|----------|----------|
| **Recreation & Fitness** | GOODLIFE, YMCA, YOGA, POOL, GYM visits |
| **Health & Pharmacy** | SHOPPERS DRUG MART, RISE SLEEP |

> **Note**: Pay-per-visit fitness activities go here, while recurring memberships (City of Burnaby, etc.) go to Subscriptions.

### Financial (Priority: 95)

| Category | Examples |
|----------|----------|
| **Fees & Interest** | INTEREST CHARGE, ANNUAL FEE, SERVICE FEE |

### Travel (Priority: 82)

| Category | Examples |
|----------|----------|
| **Travel** | AIRBNB, AIR CANADA, EXPEDIA |

## Matching Algorithm

1. Get all categories sorted by priority (highest first)
2. For each category:
   a. If `excludePatterns` exist and any match, skip this category
   b. Check `patterns` (regex) - if any match, return this category
   c. Check `keywords` (substring) - if any match, return this category
3. If no category matches, return "Other"

## Adding New Merchants

To add a new merchant to categorization:

1. Identify the correct category based on the merchant type
2. Add the merchant name (lowercase) to the `keywords` array
3. If the merchant name has variations, add a regex pattern

### Example: Adding "New Sushi Place"

```javascript
'Japanese Restaurants': {
    keywords: [
        // ... existing keywords ...
        'new sushi place'  // Add here
    ],
    // ...
}
```

## Category Colors

Each category has an assigned color for consistent UI display:

| Color Hex | Usage |
|-----------|-------|
| `#22d3ee` | Uber Eats (cyan) |
| `#000000` | Rideshare (black) |
| `#dc2626` | Japanese Restaurants (red) |
| `#f59e0b` | Chinese Restaurants (amber) |
| `#84cc16` | Groceries, Vietnamese (lime) |
| `#ff9900` | Amazon (orange) |
| `#eab308` | Gas (yellow) |
| `#8b5cf6` | Subscriptions, Gaming, Books (purple) |
| `#ef4444` | Fees & Interest (red) |
| `#06b6d4` | Recreation & Fitness (cyan) |

## Future Improvements

1. **Machine Learning**: Train a model on categorized transactions for better fuzzy matching
2. **User Corrections**: Allow users to re-categorize and learn from corrections
3. **Merchant Database**: Build a database of known merchants with their categories
4. **MCC Codes**: Integrate with Merchant Category Codes if available in transaction data
5. **Subcategories**: Add parent/child category relationships for drill-down analysis

## Changelog

### v2.1 (Current)
- **Consolidated Subscriptions**: Merged "Streaming", "AI & Software", and "Subscriptions (General)" into a unified "Subscriptions" category
- Subscriptions now includes: AI services (OpenAI, ChatGPT, Claude, etc.), streaming (Netflix, Spotify, etc.), software (Adobe, Notion, etc.), cloud storage (Google One, iCloud, etc.), and municipal memberships (City of Burnaby recreation, etc.)
- Updated Recreation & Fitness to exclude recurring memberships (those go to Subscriptions)
- Added exclude patterns to Recreation & Fitness to prevent overlap with Subscriptions

### v2.0
- Separated food delivery apps (Uber Eats, DoorDash, etc.) into individual categories
- Added cuisine-specific restaurant categories (Japanese, Chinese, Vietnamese, etc.)
- Added pattern-based matching with regex
- Added priority system for category matching
- Added exclude patterns to prevent false matches
- Expanded keyword lists with common Canadian merchants

### v1.0 (Original)
- Basic keyword-only categorization
- Single "Restaurants" category for all dining
- Limited merchant coverage

