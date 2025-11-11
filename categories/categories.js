// ===== SpendScope Category System =====
// Comprehensive categorization for spending analysis
// See spec.md for full specification details

/**
 * Category Schema Definition
 * Each category has:
 * - keywords: Array of strings to match (case-insensitive)
 * - patterns: Array of regex patterns for more complex matching
 * - color: Hex color for UI display
 * - icon: Emoji icon for the category
 * - priority: Number (higher = checked first) to handle overlapping matches
 */

const categorySchema = {
    // ============================================
    // FOOD DELIVERY APPS (Priority: Highest)
    // ============================================
    'Uber Eats': {
        keywords: [
            'ubereats', 'uber eats', 'uber canada/ubereats', 'uber* eats'
        ],
        patterns: [
            /uber.*eats/i,
            /ubereats/i
        ],
        color: '#22d3ee',
        icon: '🥡',
        priority: 100
    },
    'DoorDash': {
        keywords: [
            'doordash', 'door dash'
        ],
        patterns: [/door\s*dash/i],
        color: '#ff3008',
        icon: '🚪',
        priority: 100
    },
    'Skip The Dishes': {
        keywords: [
            'skip the dishes', 'skipthedishes', 'skip dishes'
        ],
        patterns: [/skip.*dish/i],
        color: '#ff6b00',
        icon: '🍱',
        priority: 100
    },
    'Fantuan': {
        keywords: ['fantuan', 'fan tuan'],
        patterns: [/fan\s*tuan/i],
        color: '#e60012',
        icon: '🥢',
        priority: 100
    },
    'Hungry Panda': {
        keywords: ['hungry panda', 'hungrypanda'],
        patterns: [/hungry\s*panda/i],
        color: '#ff6b6b',
        icon: '🐼',
        priority: 100
    },

    // ============================================
    // RIDESHARE & TRANSPORTATION
    // ============================================
    'Rideshare': {
        keywords: [
            'uber canada', 'uber holdings', 'lyft', 'uberdirect',
            'uber trip', 'ubertrip', 'uber* trip', 'uberonemem'
        ],
        patterns: [
            /uber\s*(?:canada|holdings|direct|trip)/i,
            /ubertrip/i,
            /lyft/i
        ],
        excludePatterns: [/eats/i], // Don't match if "eats" is present
        color: '#000000',
        icon: '🚗',
        priority: 95
    },
    'Public Transit': {
        keywords: [
            'compass', 'translink', 'transit', 'metro', 'bus pass'
        ],
        patterns: [
            /compass\s*account/i,
            /translink/i
        ],
        color: '#0072ce',
        icon: '🚌',
        priority: 80
    },
    'Parking': {
        keywords: [
            'parking', 'parkade', 'easy park', 'easypark', 'paybyphone',
            'impark', 'diamond parking'
        ],
        patterns: [
            /easy\s*park/i,
            /pay\s*by\s*phone/i,
            /park.*cp\d+/i
        ],
        color: '#6366f1',
        icon: '🅿️',
        priority: 80
    },

    // ============================================
    // RESTAURANTS & DINING
    // ============================================
    'Japanese Restaurants': {
        keywords: [
            // Common Japanese restaurant terms
            'sushi', 'ramen', 'izakaya', 'teriyaki', 'tempura', 'yakitori',
            'tonkatsu', 'udon', 'soba', 'donburi', 'bento', 'omakase',
            'teppanyaki', 'robata', 'kaiseki', 'gyudon', 'katsu',
            // Specific restaurants (add more as discovered)
            'gaya sushi', 'nemo sushi', 'saku', 'miku', 'minami',
            'guu', 'kingyo', 'jinya', 'santouka', 'marutama', 'hokkaido ramen',
            'kintaro', 'menya', 'taishoken'
        ],
        patterns: [
            /sushi/i,
            /ramen/i,
            /izakaya/i,
            /japanese/i,
            /\bjapan\b/i,
            /teriyaki/i,
            /gyoza/i
        ],
        color: '#dc2626',
        icon: '🍣',
        priority: 85
    },
    'Chinese Restaurants': {
        keywords: [
            // Common Chinese restaurant terms
            'chinese', 'dim sum', 'dumpling', 'wonton', 'chow mein',
            'fried rice', 'szechuan', 'sichuan', 'cantonese', 'hotpot',
            'hot pot', 'mapo', 'kung pao', 'peking', 'beijing',
            // Specific restaurants (add more as discovered)
            'peking restaurant', 'manchu wok', 'panda express',
            'chen\'s', 'golden dragon', 'jade garden', 'dynasty',
            't&t', 'hons', 'kirin'
        ],
        patterns: [
            /chinese/i,
            /peking/i,
            /szechuan/i,
            /dim\s*sum/i,
            /wok(?!\s*box)/i,
            /dragon.*(?:restaurant|kitchen|palace)/i
        ],
        color: '#f59e0b',
        icon: '🥟',
        priority: 85
    },
    'Vietnamese Restaurants': {
        keywords: [
            'pho', 'vietnamese', 'banh mi', 'bun', 'saigon', 'hanoi',
            'viet', 'vermicelli', 'spring roll',
            'le petit saigon', 'pho hoa', 'cau tre'
        ],
        patterns: [
            /pho\s/i,
            /vietnamese/i,
            /\bviet\b/i,
            /saigon/i,
            /banh\s*mi/i
        ],
        color: '#84cc16',
        icon: '🍜',
        priority: 85
    },
    'Korean Restaurants': {
        keywords: [
            'korean', 'bbq', 'bulgogi', 'bibimbap', 'kimchi', 'kbbq',
            'galbi', 'soju', 'jjigae', 'samgyeopsal', 'gopchang',
            'seoul', 'korea house'
        ],
        patterns: [
            /korean/i,
            /\bbbq\b.*(?:house|restaurant|grill)/i,
            /bulgogi/i,
            /bibimbap/i
        ],
        color: '#ef4444',
        icon: '🥘',
        priority: 85
    },
    'Indian Restaurants': {
        keywords: [
            'indian', 'curry', 'tandoori', 'naan', 'masala', 'biryani',
            'tikka', 'samosa', 'pakora', 'dosa', 'thali', 'dal',
            'bombay', 'punjabi', 'mughal', 'taj'
        ],
        patterns: [
            /indian/i,
            /curry\s*(?:house|palace|garden)/i,
            /tandoori/i,
            /masala/i
        ],
        color: '#f97316',
        icon: '🍛',
        priority: 85
    },
    'Thai Restaurants': {
        keywords: [
            'thai', 'pad thai', 'tom yum', 'green curry', 'satay',
            'bangkok', 'basil', 'mango sticky', 'larb'
        ],
        patterns: [
            /thai/i,
            /bangkok/i,
            /pad\s*thai/i
        ],
        color: '#a855f7',
        icon: '🍲',
        priority: 85
    },
    'Mexican Restaurants': {
        keywords: [
            'mexican', 'taco', 'burrito', 'quesadilla', 'nacho',
            'enchilada', 'fajita', 'guacamole', 'salsa', 'tortilla',
            'chipotle', 'taco bell', 'taco time', 'mucho burrito',
            'la taqueria', 'cantina'
        ],
        patterns: [
            /mexican/i,
            /taco/i,
            /burrito/i,
            /cantina/i
        ],
        color: '#22c55e',
        icon: '🌮',
        priority: 85
    },
    'Italian Restaurants': {
        keywords: [
            'italian', 'pizza', 'pasta', 'pizzeria', 'trattoria',
            'ristorante', 'lasagna', 'risotto', 'gnocchi', 'gelato',
            'olive garden', 'boston pizza', 'pizza hut', 'dominos',
            'little caesars', 'panago', 'fresh slice'
        ],
        patterns: [
            /italian/i,
            /pizza/i,
            /pasta/i,
            /trattoria/i
        ],
        color: '#16a34a',
        icon: '🍕',
        priority: 85
    },
    'Fast Food': {
        keywords: [
            'mcdonald', 'mcdonalds', 'burger king', 'wendys', 'wendy\'s',
            'kfc', 'popeyes', 'chick-fil-a', 'five guys', 'fatburger',
            'white castle', 'in-n-out', 'jack in the box', 'carl\'s jr',
            'hardees', 'sonic', 'dairy queen', 'arby\'s', 'taco bell',
            'subway', 'quiznos', 'mr sub', 'firehouse subs', 'jimmy johns',
            'a and w', 'a&w', 'triple o', 'white spot', 'mary brown',
            'harveys', 'new york fries', 'opa'
        ],
        patterns: [
            /mcdonald/i,
            /burger\s*king/i,
            /wendy'?s/i,
            /a\s*(?:and|&)\s*w/i,
            /kfc/i,
            /subway/i
        ],
        color: '#fbbf24',
        icon: '🍟',
        priority: 82
    },
    'Fish & Chips': {
        keywords: [
            'fish and chips', 'fish & chips', 'fish n chips',
            'cockney kings', 'pajo\'s', 'go fish', 'c-lovers'
        ],
        patterns: [
            /fish.*chip/i,
            /cockney/i
        ],
        color: '#0891b2',
        icon: '🐟',
        priority: 85
    },
    'Cafes & Coffee': {
        keywords: [
            'cafe', 'café', 'coffee', 'starbucks', 'tim hortons', 'tims',
            'second cup', 'blenz', 'jj bean', 'waves', 'matchstick',
            'revolver', 'prado', 'elysian', 'kafka', 'moja', 'bean around',
            'trees organic', 'caffe', 'espresso', 'latte', 'cappuccino',
            'bakery', 'patisserie', 'bastion cafe'
        ],
        patterns: [
            /caf[eé]/i,
            /coffee/i,
            /starbucks/i,
            /tim\s*horton/i,
            /bakery/i,
            /espresso/i
        ],
        color: '#92400e',
        icon: '☕',
        priority: 83
    },
    'Restaurants (General)': {
        keywords: [
            // Generic restaurant keywords
            'restaurant', 'dining', 'grill', 'kitchen', 'bistro',
            'eatery', 'diner', 'pub', 'tavern', 'bar & grill',
            'steakhouse', 'chophouse', 'seafood', 'buffet',
            // Casual dining chains
            'earls', 'cactus club', 'joeys', 'brown\'s', 'moxies',
            'milestones', 'the keg', 'original joes', 'montanas',
            'red lobster', 'the old spaghetti factory', 'denny\'s',
            'ihop', 'applebee\'s', 'chili\'s', 'tgi friday',
            // Food/Beverage generic
            'food & beverage', 'food and beverage', 'catering',
            'garlic & chili', 'garlic and chili'
        ],
        patterns: [
            /restaurant/i,
            /\bgrill\b/i,
            /\bbistro\b/i,
            /\bkitchen\b/i,
            /\bdiner\b/i,
            /tst-/i,  // Common restaurant POS prefix
            /food.*beverage/i
        ],
        color: '#f43f5e',
        icon: '🍽️',
        priority: 75
    },

    // ============================================
    // GROCERIES & FOOD SHOPPING
    // ============================================
    'Groceries': {
        keywords: [
            // Major grocery chains
            'costco', 'walmart', 'superstore', 'real canadian superstore',
            'safeway', 'save-on', 'save on foods', 'whole foods', 'no frills',
            'loblaws', 't&t', 't & t', 'h mart', 'hmart', 'kim\'s mart',
            'fresh st', 'fresh street', 'iga', 'thrifty foods', 'buy-low',
            'sunrise market', 'persia foods', 'choices market', 'nesters',
            'famous foods', 'donald\'s market', 'independent grocer',
            // Delivery services
            'instacart', 'cornershop', 'voila',
            // Generic
            'grocery', 'supermarket', 'market', 'harvest'
        ],
        patterns: [
            /costco/i,
            /superstore/i,
            /safeway/i,
            /walmart/i,
            /instacart/i,
            /grocery/i,
            /\bmarket\b/i,
            /harvest.*grocery/i
        ],
        color: '#84cc16',
        icon: '🛒',
        priority: 78
    },
    'Convenience Stores': {
        keywords: [
            '7-eleven', '7 eleven', 'circle k', 'mac\'s', 'hasty market',
            'variety', 'corner store', 'snack shop', 'quickie mart'
        ],
        patterns: [
            /7.*eleven/i,
            /circle\s*k/i,
            /convenience/i
        ],
        excludePatterns: [/esso/i, /shell/i, /gas/i], // These go to Gas
        color: '#38bdf8',
        icon: '🏪',
        priority: 72
    },

    // ============================================
    // SHOPPING & RETAIL
    // ============================================
    'Amazon': {
        keywords: [
            'amazon', 'amzn', 'amazon.ca', 'amazon prime', 'amzn mktp'
        ],
        patterns: [
            /amazon/i,
            /amzn/i
        ],
        color: '#ff9900',
        icon: '📦',
        priority: 90
    },
    'Clothing & Fashion': {
        keywords: [
            'uniqlo', 'h&m', 'zara', 'gap', 'old navy', 'forever 21',
            'nordstrom', 'the bay', 'hudson\'s bay', 'simons', 'aritzia',
            'lululemon', 'nike', 'adidas', 'foot locker', 'sportchek',
            'winners', 'marshalls', 'tj maxx', 'value village', 'jack jones',
            'jack & jones', 'roots', 'american eagle', 'banana republic',
            'marks work', 'moore\'s'
        ],
        patterns: [
            /uniqlo/i,
            /h\s*&\s*m/i,
            /clothing/i,
            /apparel/i,
            /jack.*jones/i
        ],
        color: '#ec4899',
        icon: '👕',
        priority: 80
    },
    'Electronics': {
        keywords: [
            'best buy', 'bestbuy', 'apple store', 'microsoft store',
            'london drugs', 'staples', 'memory express', 'canada computers',
            'ncix', 'newegg', 'visions electronics', 'the source'
        ],
        patterns: [
            /best\s*buy/i,
            /electronics/i,
            /computer/i
        ],
        color: '#3b82f6',
        icon: '📱',
        priority: 80
    },
    'Home & Hardware': {
        keywords: [
            'ikea', 'home depot', 'canadian tire', 'home hardware',
            'rona', 'lowe\'s', 'lowes', 'home sense', 'bed bath',
            'pottery barn', 'crate barrel', 'williams sonoma', 'kitchen stuff'
        ],
        patterns: [
            /ikea/i,
            /home\s*depot/i,
            /canadian\s*tire/i,
            /hardware/i
        ],
        color: '#f97316',
        icon: '🏠',
        priority: 80
    },
    'Books & Education': {
        keywords: [
            'bookstore', 'book store', 'chapters', 'indigo', 'coles',
            'amazon books', 'audible', 'ubc bookstore', 'university bookstore',
            'textbook', 'academic'
        ],
        patterns: [
            /book\s*store/i,
            /bookstore/i,
            /chapters/i,
            /indigo/i
        ],
        color: '#8b5cf6',
        icon: '📚',
        priority: 78
    },
    'Shopping (General)': {
        keywords: [
            'ebay', 'etsy', 'alibaba', 'aliexpress', 'wish',
            'dollarama', 'dollar tree', 'dollar store', 'daiso'
        ],
        patterns: [
            /ebay/i,
            /etsy/i,
            /shopping/i
        ],
        color: '#a855f7',
        icon: '🛍️',
        priority: 70
    },

    // ============================================
    // GAS & AUTO
    // ============================================
    'Gas': {
        keywords: [
            'esso', 'shell', 'petro canada', 'petro-canada', 'chevron',
            'husky', 'co-op gas', 'costco gas', 'mobil', 'pioneer',
            'ultramar', 'irving', 'domo', 'fas gas'
        ],
        patterns: [
            /esso/i,
            /shell.*gas/i,
            /petro/i,
            /chevron/i,
            /\bgas\b/i,
            /fuel/i
        ],
        color: '#eab308',
        icon: '⛽',
        priority: 85
    },
    'Auto & Vehicle': {
        keywords: [
            'icbc', 'autoplan', 'driver services', 'mvi', 'aircare',
            'oil change', 'mr lube', 'jiffy lube', 'canadian tire auto',
            'kal tire', 'ok tire', 'active green ross', 'midas',
            'speedy auto', 'auto repair', 'car wash', 'detail'
        ],
        patterns: [
            /driver\s*service/i,
            /auto.*(?:repair|service)/i,
            /car\s*wash/i,
            /\btire\b/i,
            /oil\s*change/i
        ],
        color: '#64748b',
        icon: '🚙',
        priority: 80
    },

    // ============================================
    // ENTERTAINMENT & GAMING
    // ============================================
    'Gaming': {
        keywords: [
            'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'epic games',
            'riot games', 'blizzard', 'ea games', 'ubisoft', 'lootbar',
            'kuro games', 'mihoyo', 'hoyoverse', 'genshin', 'twitch'
        ],
        patterns: [
            /steam/i,
            /playstation/i,
            /\bpsn\b/i,
            /xbox/i,
            /nintendo/i,
            /lootbar/i,
            /games?\b/i
        ],
        color: '#8b5cf6',
        icon: '🎮',
        priority: 85
    },
    'Movies & Events': {
        keywords: [
            'cinema', 'cineplex', 'theatre', 'theater', 'movie', 'imax',
            'landmark cinema', 'silvercity', 'scotiabank theatre',
            'ticketmaster', 'stubhub', 'viagogo', 'eventbrite', 'live nation',
            'concert', 'pne', 'exhibition', 'playland'
        ],
        patterns: [
            /cinema/i,
            /theatre/i,
            /theater/i,
            /movie/i,
            /ticket/i,
            /concert/i,
            /pne/i,
            /viagogo/i
        ],
        color: '#ec4899',
        icon: '🎬',
        priority: 82
    },

    // ============================================
    // SUBSCRIPTIONS & DIGITAL SERVICES
    // ============================================
    'Subscriptions': {
        keywords: [
            // AI Services
            'chatgpt', 'openai', 'claude', 'anthropic', 'midjourney',
            'copilot', 'github copilot', 'perplexity', 'cursor',
            // Software & Productivity
            'notion', 'todoist', 'evernote', 'dropbox', 'slack', 'zoom',
            'adobe', 'canva', 'figma', 'asana', 'trello', 'linear',
            // Cloud Storage & Google
            'google one', 'google storage', 'google premium', 'icloud',
            'microsoft 365', 'office 365', 'onedrive',
            // Streaming & Entertainment
            'netflix', 'disney plus', 'disney+', 'crave', 'amazon prime video',
            'hulu', 'paramount+', 'apple tv', 'youtube premium', 'spotify',
            'apple music', 'amazon music', 'tidal', 'deezer', 'audible',
            // Municipal & Recreation Memberships
            'city burnaby', 'burnaby recreation', 'burnaby recreatio',
            'city vancouver', 'vancouver recreation', 'city recreation',
            'christine sinclair', 'community centre', 'rec centre',
            // App Store & General
            'apple.com/bill', 'google play', 'app store',
            'subscription', 'membership', 'premium', 'patreon'
        ],
        patterns: [
            /openai/i,
            /chatgpt/i,
            /claude/i,
            /anthropic/i,
            /midjourney/i,
            /adobe/i,
            /microsoft\s*365/i,
            /netflix/i,
            /disney.*\+/i,
            /spotify/i,
            /youtube\s*premium/i,
            /apple\s*music/i,
            /apple\.com.*bill/i,
            /google\s*(?:play|one|premium)/i,
            /city\s*(?:of\s*)?burnaby/i,
            /burnaby\s*recreatio/i,
            /christine\s*sincl/i,
            /subscription/i,
            /membership/i
        ],
        color: '#8b5cf6',
        icon: '🔄',
        priority: 88
    },

    // ============================================
    // HEALTH & FITNESS
    // ============================================
    'Recreation & Fitness': {
        keywords: [
            'fitness', 'gym', 'goodlife', 'anytime fitness',
            'fit4less', 'planet fitness', 'ymca', 'ywca',
            'yoga', 'pilates', 'crossfit', 'swimming', 'pool',
            'sport', 'athletic', 'workout', 'studio'
        ],
        patterns: [
            /fitness/i,
            /\bgym\b/i,
            /yoga/i,
            /pool/i,
            /workout/i
        ],
        excludePatterns: [/burnaby/i, /city\s+of/i, /membership/i], // These go to Subscriptions
        color: '#06b6d4',
        icon: '🏃',
        priority: 80
    },
    'Health & Pharmacy': {
        keywords: [
            'pharmacy', 'shoppers drug mart', 'rexall', 'london drugs',
            'pharmasave', 'cvs', 'walgreens', 'medical', 'clinic',
            'doctor', 'dentist', 'optometrist', 'vision', 'dental',
            'health', 'wellness', 'massage', 'physio', 'chiropractic',
            'rise sleep'
        ],
        patterns: [
            /pharmacy/i,
            /drug\s*mart/i,
            /medical/i,
            /clinic/i,
            /health/i,
            /sleep/i
        ],
        color: '#14b8a6',
        icon: '💊',
        priority: 78
    },

    // ============================================
    // FEES & CHARGES
    // ============================================
    'Fees & Interest': {
        keywords: [
            'interest charge', 'interest -', 'annual fee', 'service fee',
            'late fee', 'overdraft', 'nsf', 'transfer fee', 'foreign transaction'
        ],
        patterns: [
            /interest\s*charge/i,
            /annual\s*fee/i,
            /service\s*fee/i,
            /late\s*fee/i,
            /fee\s*-/i
        ],
        color: '#ef4444',
        icon: '💳',
        priority: 95
    },

    // ============================================
    // TRAVEL & ACCOMMODATION
    // ============================================
    'Travel': {
        keywords: [
            'airbnb', 'vrbo', 'hotel', 'motel', 'inn', 'hostel',
            'marriott', 'hilton', 'hyatt', 'best western', 'holiday inn',
            'airline', 'air canada', 'westjet', 'united', 'delta',
            'expedia', 'booking.com', 'hotels.com', 'kayak', 'trivago',
            'flight', 'airport'
        ],
        patterns: [
            /hotel/i,
            /airbnb/i,
            /airline/i,
            /flight/i,
            /travel/i,
            /booking/i
        ],
        color: '#0ea5e9',
        icon: '✈️',
        priority: 82
    }
};

/**
 * Get all category names
 */
function getCategoryNames() {
    return Object.keys(categorySchema);
}

/**
 * Get category configuration by name
 */
function getCategoryConfig(categoryName) {
    return categorySchema[categoryName] || {
        color: '#64748b',
        icon: '📌',
        priority: 0
    };
}

/**
 * Get all categories sorted by priority (highest first)
 */
function getCategoriesByPriority() {
    return Object.entries(categorySchema)
        .sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0));
}

/**
 * Categorize a transaction description
 * Returns the best matching category or 'Other'
 */
function categorizeTransaction(description) {
    const descLower = description.toLowerCase();
    
    // Get categories sorted by priority
    const sortedCategories = getCategoriesByPriority();
    
    for (const [category, config] of sortedCategories) {
        // Check exclude patterns first
        if (config.excludePatterns) {
            const shouldExclude = config.excludePatterns.some(pattern => pattern.test(description));
            if (shouldExclude) continue;
        }
        
        // Check regex patterns (more precise)
        if (config.patterns) {
            for (const pattern of config.patterns) {
                if (pattern.test(description)) {
                    return category;
                }
            }
        }
        
        // Check keywords (substring match)
        if (config.keywords) {
            for (const keyword of config.keywords) {
                if (descLower.includes(keyword.toLowerCase())) {
                    return category;
                }
            }
        }
    }
    
    return 'Other';
}

/**
 * Category Groups - Aggregation mapping for display purposes
 * Maps a parent display category to its child categories
 * Categories not listed here display individually
 */
const categoryGroups = {
    'Restaurants': {
        children: [
            'Japanese Restaurants',
            'Chinese Restaurants',
            'Vietnamese Restaurants',
            'Korean Restaurants',
            'Indian Restaurants',
            'Thai Restaurants',
            'Mexican Restaurants',
            'Italian Restaurants',
            'Fast Food',
            'Fish & Chips',
            'Cafes & Coffee',
            'Restaurants (General)'
        ],
        color: '#f43f5e',
        icon: '🍽️'
    }
    // Food delivery apps (Uber Eats, DoorDash, etc.) remain separate
};

/**
 * Get the display category for a given category
 * Returns the parent group name if the category belongs to a group, otherwise returns the category itself
 */
function getDisplayCategory(category) {
    for (const [groupName, group] of Object.entries(categoryGroups)) {
        if (group.children.includes(category)) {
            return groupName;
        }
    }
    return category;
}

/**
 * Get the display config for a category (handles grouped categories)
 */
function getDisplayCategoryConfig(categoryName) {
    // Check if this is a group name
    if (categoryGroups[categoryName]) {
        return {
            color: categoryGroups[categoryName].color,
            icon: categoryGroups[categoryName].icon,
            priority: 85
        };
    }
    // Otherwise return the individual category config
    return getCategoryConfig(categoryName);
}

/**
 * Check if a category is a child of a group
 */
function isChildCategory(category) {
    for (const group of Object.values(categoryGroups)) {
        if (group.children.includes(category)) {
            return true;
        }
    }
    return false;
}

/**
 * Get all child categories for a group
 */
function getChildCategories(groupName) {
    return categoryGroups[groupName]?.children || [];
}

/**
 * Export for use in main app
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        categorySchema,
        categoryGroups,
        getCategoryNames,
        getCategoryConfig,
        getCategoriesByPriority,
        categorizeTransaction,
        getDisplayCategory,
        getDisplayCategoryConfig,
        isChildCategory,
        getChildCategories
    };
}

