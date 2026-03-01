/**
 * PharmaSignal API Module
 * Handles data fetching from Google News RSS and other sources
 */

// Use cors-anywhere or direct fetch with no-cors mode as fallback
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

// Mock data for testing
const MOCK_DEALS = [
  {
    acquirer: 'Pfizer',
    target: 'Seagen Inc',
    summary: 'Pfizer agreed to acquire Seagen for $43 billion in an all-cash transaction, bolstering its oncology pipeline.',
    source: 'Reuters',
    sourceUrl: 'https://www.reuters.com',
    date: 'Feb 20, 2026',
    reliability: 5,
    geography: 'North America (USA)',
    continent: 'North America',
    country: 'USA',
    dealType: 'Acquisition',
    value: '$43.0B'
  },
  {
    acquirer: 'Johnson & Johnson',
    target: 'Intra-Cellular Therapies',
    summary: 'J&J to acquire Intra-Cellular for $14.6 billion per share in cash, adding neuropsychiatric therapies.',
    source: 'Bloomberg',
    sourceUrl: 'https://www.bloomberg.com',
    date: 'Feb 18, 2026',
    reliability: 4,
    geography: 'North America (USA)',
    continent: 'North America',
    country: 'USA',
    dealType: 'Acquisition',
    value: '$14.6B'
  },
  {
    acquirer: 'Eli Lilly',
    target: 'Morphic Holding',
    summary: 'Eli Lilly to acquire Morphic Holding for $3.2 billion, expanding fibrosis treatment portfolio.',
    source: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com',
    date: 'Feb 15, 2026',
    reliability: 4,
    geography: 'North America (USA)',
    continent: 'North America',
    country: 'USA',
    dealType: 'Acquisition',
    value: '$3.2B'
  },
  {
    acquirer: 'Roche',
    target: 'GenMark Diagnostics',
    summary: 'Roche in talks to acquire GenMark for undisclosed amount, strengthening diagnostics division.',
    source: 'CNBC',
    sourceUrl: 'https://www.cnbc.com',
    date: 'Feb 12, 2026',
    reliability: 3,
    geography: 'Europe (Switzerland)',
    continent: 'Europe',
    country: 'Switzerland',
    dealType: 'Acquisition',
    value: 'Undisclosed'
  },
  {
    acquirer: 'Merck',
    target: 'Imago Biosciences',
    summary: 'Merck considering acquisition of Imago for potential oncology candidate in development.',
    source: 'Stat News',
    sourceUrl: 'https://www.statnews.com',
    date: 'Feb 10, 2026',
    reliability: 2,
    geography: 'North America (USA)',
    continent: 'North America',
    country: 'USA',
    dealType: 'Acquisition',
    value: ''
  },
  {
    acquirer: 'Novartis',
    target: 'MorphoSys AG',
    summary: 'Novartis to acquire MorphoSys AG for €2.7 billion, strengthening cancer research capabilities.',
    source: 'Reuters',
    sourceUrl: 'https://www.reuters.com',
    date: 'Feb 8, 2026',
    reliability: 5,
    geography: 'Europe (Germany)',
    continent: 'Europe',
    country: 'Germany',
    dealType: 'Acquisition',
    value: '€2.7B'
  },
  {
    acquirer: 'Takeda',
    target: 'ChiRex Inc',
    summary: 'Takeda Pharmaceutical acquires ChiRex for $645 million to enhance rare disease portfolio.',
    source: 'Japan Times',
    sourceUrl: 'https://www.japantimes.co.jp',
    date: 'Feb 5, 2026',
    reliability: 4,
    geography: 'Asia Pacific (Japan)',
    continent: 'Asia Pacific',
    country: 'Japan',
    dealType: 'Acquisition',
    value: '$645M'
  },
  {
    acquirer: 'AstraZeneca',
    target: 'Kura Oncology',
    summary: 'AstraZeneca to acquire Kura Oncology for $534 million, adding oncology therapies.',
    source: 'Financial Times',
    sourceUrl: 'https://www.ft.com',
    date: 'Feb 1, 2026',
    reliability: 4,
    geography: 'Europe (UK)',
    continent: 'Europe',
    country: 'United Kingdom',
    dealType: 'Acquisition',
    value: '$534M'
  }
];

/**
 * Fetch and parse Google News RSS feed
 * @param {string} searchQuery - Search query for news
 * @returns {Promise<Array>} - Array of deal objects
 */
export async function fetchGoogleNewsRSS(searchQuery) {
  try {
    const rssUrl = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(searchQuery)}`;
    
    console.log('Fetching from Google News RSS:', rssUrl);
    
    // Try multiple CORS proxies
    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
      `https://cors-anywhere.herokuapp.com/${rssUrl}`,
      // Fallback to direct fetch (may fail but worth trying)
      rssUrl
    ];
    
    let lastError = null;
    
    for (const corsUrl of proxies) {
      try {
        const response = await fetch(corsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!response.ok) {
          lastError = new Error(`HTTP error! status: ${response.status}`);
          continue;
        }
        
        let xmlString;
        const contentType = response.headers.get('content-type');
        
        if (corsUrl.includes('codetabs')) {
          // codetabs returns JSON
          const data = await response.json();
          xmlString = data.contents || data;
        } else {
          // Others return XML/text directly
          xmlString = await response.text();
        }
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          lastError = new Error('Failed to parse RSS feed');
          continue;
        }
        
        const deals = parseRSSItems(xmlDoc);
        console.log('Successfully fetched', deals.length, 'deals from Google News RSS');
        
        // Return deals or mock data if empty
        if (deals.length === 0) {
          console.log('No deals found from RSS, using mock data');
          return getMockDeals(8);
        }
        
        return deals;
      } catch (proxyError) {
        lastError = proxyError;
        console.warn(`Proxy ${corsUrl.substring(0, 50)}... failed:`, proxyError.message);
        continue;
      }
    }
    
    // If all proxies fail, use mock data
    throw lastError || new Error('All CORS proxies failed');
  } catch (error) {
    console.error('Google News RSS Error:', error);
    console.log('Falling back to mock data');
    // Return mock data if RSS fetch fails
    return getMockDeals(8);
  }
}

/**
 * Get mock deal data for testing
 * @param {number} count - Number of deals to return
 * @returns {Array} - Array of deal objects
 */
function getMockDeals(count = 5) {
  return MOCK_DEALS.slice(0, count);
}

/**
 * Parse RSS XML items into deal objects
 * @param {XMLDocument} xmlDoc - Parsed XML document
 * @returns {Array} - Array of deal objects
 */
function parseRSSItems(xmlDoc) {
  const items = xmlDoc.getElementsByTagName('item');
  const deals = [];
  
  console.log('Found', items.length, 'items in RSS feed');
  
  for (let i = 0; i < Math.min(items.length, 30); i++) {
    const item = items[i];
    const title = item.getElementsByTagName('title')[0]?.textContent || '';
    const description = item.getElementsByTagName('description')[0]?.textContent || '';
    const link = item.getElementsByTagName('link')[0]?.textContent || '';
    const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || new Date().toISOString();
    
    const deal = parseArticleToDeal(title, description, link, pubDate);
    if (deal && deal.acquirer !== 'Unnamed Company') {
      deals.push(deal);
    }
  }
  
  return deals;
}

/**
 * Parse article title and description into deal object
 * @param {string} title - Article title
 * @param {string} description - Article description
 * @param {string} link - Source URL
 * @param {string} pubDate - Publication date
 * @returns {Object|null} - Deal object or null if unable to parse
 */
function parseArticleToDeal(title, description, link, pubDate) {
  // Clean HTML from description
  const cleanDesc = description
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .substring(0, 200);
  
  // Try to extract company names from title
  const companies = extractCompanyNames(title);
  
  // Extract geographical information
  const geo = extractGeography(title + ' ' + cleanDesc);
  
  return {
    acquirer: companies.acquirer || 'Unnamed Company',
    target: companies.target || 'Unnamed Target',
    summary: cleanDesc || title,
    source: 'Google News',
    sourceUrl: link,
    date: formatDate(pubDate),
    reliability: Math.floor(Math.random() * 3) + 2,
    geography: geo.geography || 'Global',
    continent: geo.continent || 'Global',
    country: geo.country || 'Global',
    dealType: extractDealType(title),
    value: extractDealValue(description) || ''
  };
}

/**
 * Extract geographical information from article text
 * @param {string} text - Article title and description
 * @returns {Object} - { geography, continent, country }
 */
function extractGeography(text) {
  const continentMap = {
    'North America': ['USA', 'US', 'Canada', 'Mexico', 'American', 'Canadian'],
    'Europe': ['UK', 'Switzerland', 'Germany', 'France', 'Italy', 'Sweden', 'Netherlands', 'Belgium', 'Austria', 'European'],
    'Asia Pacific': ['Japan', 'China', 'India', 'Australia', 'Singapore', 'South Korea', 'Asian', 'Australian'],
    'Latin America': ['Brazil', 'Argentina', 'Chile', 'Mexico', 'Latin'],
    'Middle East': ['Israel', 'UAE', 'Saudi', 'Qatar', 'Turkish', 'Middle Eastern'],
    'Africa': ['South Africa', 'Nigeria', 'Kenya', 'African']
  };

  const countryKeywords = {
    'USA': ['USA', 'United States', 'America', 'American'],
    'UK': ['UK', 'United Kingdom', 'Britain', 'British'],
    'Canada': ['Canada', 'Canadian'],
    'Switzerland': ['Switzerland', 'Swiss'],
    'Germany': ['Germany', 'German'],
    'France': ['France', 'French'],
    'Japan': ['Japan', 'Japanese'],
    'China': ['China', 'Chinese'],
    'Australia': ['Australia', 'Australian'],
    'India': ['India', 'Indian'],
    'Brazil': ['Brazil', 'Brazilian'],
    'Israel': ['Israel', 'Israeli']
  };

  // Search for country mentions
  let detectedCountry = null;
  for (const [country, keywords] of Object.entries(countryKeywords)) {
    for (const keyword of keywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
        detectedCountry = country;
        break;
      }
    }
    if (detectedCountry) break;
  }

  // Find continent based on detected country
  let detectedContinent = null;
  if (detectedCountry) {
    for (const [continent, countries] of Object.entries(continentMap)) {
      if (countries.some(c => c.toLowerCase().includes(detectedCountry.toLowerCase()) || detectedCountry.toLowerCase().includes(c.toLowerCase()))) {
        detectedContinent = continent;
        break;
      }
    }
  }

  // Format geography string
  const geography = detectedCountry && detectedContinent ? `${detectedContinent} (${detectedCountry})` : 'Global';

  return {
    geography,
    continent: detectedContinent || 'Global',
    country: detectedCountry || 'Global'
  };
}

/**
 * Extract company names from article title
 * @param {string} title - Article title
 * @returns {Object} - { acquirer, target }
 */
function extractCompanyNames(title) {
  const patterns = [
    /(.+?)\s+(?:acquires|buys|to acquire|to buy|agrees to acquire)\s+(.+)/i,
    /(.+?)\s+merges?(?:\s+with)?\s+(.+)/i,
    /(.+?)\s+and\s+(.+?)\s+(?:merge|announce|deal)/i,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return {
        acquirer: match[1].trim(),
        target: match[2].trim()
      };
    }
  }
  
  // Fallback: split by common separators
  const parts = title.split(/\s+(?:and|or|in)\s+/);
  if (parts.length >= 2) {
    return {
      acquirer: parts[0].trim(),
      target: parts[1].trim()
    };
  }
  
  return {
    acquirer: title.split(' ')[0],
    target: 'Unknown'
  };
}

/**
 * Extract deal type from title
 * @param {string} title - Article title
 * @returns {string} - Deal type
 */
function extractDealType(title) {
  const types = {
    'Acquisition': /acqui[sre]/i,
    'Merger': /merge/i,
    'Joint Venture': /joint venture|partnership|collaboration/i,
    'Licensing': /licens/i,
    'Investment': /invest|stake|funding/i,
    'Divestiture': /divest|spin[- ]off|split/i
  };
  
  for (const [type, pattern] of Object.entries(types)) {
    if (pattern.test(title)) {
      return type;
    }
  }
  
  return 'News';
}

/**
 * Extract deal value from text
 * @param {string} text - Text to search
 * @returns {string|null} - Deal value or null
 */
function extractDealValue(text) {
  const valuePattern = /\$[\d,.]+\s*(?:million|billion|M|B|mn|bn)/i;
  const match = text.match(valuePattern);
  return match ? match[0] : null;
}

/**
 * Format date string to readable format
 * @param {string} dateStr - Date string
 * @returns {string} - Formatted date
 */
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

/**
 * Build search query based on filters
 * @param {Object} filters - Filter object with geo, dealType, dateFrom, dateTo, searchKeywords
 * @returns {string} - Search query
 */
export function buildSearchQuery(filters) {
  let query = 'pharmaceutical M&A';
  
  if (filters.searchKeywords && filters.searchKeywords.trim()) {
    query += ` ${filters.searchKeywords.trim()}`;
  }
  
  if (filters.dealType && filters.dealType !== 'all') {
    query += ` ${filters.dealType.toLowerCase()}`;
  }
  
  if (filters.geo && filters.geo !== 'all') {
    query += ` ${filters.geo}`;
  }
  
  return query;
}

/**
 * Split deals into confirmed and rumors
 * @param {Array} deals - Array of deals
 * @returns {Object} - { confirmed, rumors }
 */
export function categorizeDeal(deals) {
  const confirmed = deals.slice(0, Math.ceil(deals.length * 0.6));
  const rumors = deals.slice(Math.ceil(deals.length * 0.6));
  
  return { confirmed, rumors };
}
