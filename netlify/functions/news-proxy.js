/**
 * Netlify Function: News Proxy
 * Fetches Google News RSS feed on the server side to bypass CORS restrictions
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Cache to avoid hitting Google News too frequently
let cache = {
  data: null,
  timestamp: 0,
  ttl: 3600000 // 1 hour
};

/**
 * Fetch RSS feed using Node.js https module (server-side, no CORS issues)
 */
function fetchRSSFeed(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    }, (response) => {
      let data = '';
      
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchRSSFeed(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
      });
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Parse RSS XML and extract deal-related articles
 */
function parseRSSFeed(xmlString) {
  const deals = [];
  
  // Simple XML parsing without external dependencies
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const items = xmlString.match(itemRegex) || [];
  
  const dealKeywords = [
    'acquir', 'buy', 'merge', 'deal', 'acquisition', 'purchase', 'patent',
    'license', 'partner', 'collaboration', 'agreement', 'announce', 'fda',
    'approval', 'clinical', 'invest', 'fund', 'raise', 'pharmaceutical',
    'biotech', 'pharma', 'drug', 'medicine'
  ];
  
  items.forEach((itemXml) => {
    try {
      const titleMatch = itemXml.match(/<title[^>]*>[\s\S]*?<\/title>/);
      const descriptionMatch = itemXml.match(/<description[^>]*>[\s\S]*?<\/description>/);
      const linkMatch = itemXml.match(/<link[^>]*>[\s\S]*?<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate[^>]*>[\s\S]*?<\/pubDate>/);
      
      if (!titleMatch || !linkMatch) return;
      
      const title = titleMatch[0]
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      
      const description = descriptionMatch
        ? descriptionMatch[0]
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .substring(0, 300)
            .trim()
        : '';
      
      const link = linkMatch[0]
        .replace(/<[^>]*>/g, '')
        .trim();
      
      const pubDate = pubDateMatch
        ? pubDateMatch[0]
            .replace(/<[^>]*>/g, '')
            .trim()
        : new Date().toISOString();
      
      // Check if deal-related
      const combinedText = (title + ' ' + description).toLowerCase();
      const isDealRelated = dealKeywords.some(keyword => combinedText.includes(keyword));
      
      if (!isDealRelated) return;
      
      deals.push({
        title,
        description,
        link,
        pubDate,
        source: 'Google News'
      });
    } catch (error) {
      console.error('Error parsing item:', error);
    }
  });
  
  return deals;
}

/**
 * Extract company names and deal info from title
 */
function extractDealInfo(article) {
  const title = article.title.toLowerCase();
  
  // Common pharmaceutical companies
  const pharmaCompanies = [
    'pfizer', 'merck', 'johnson & johnson', 'j&j', 'eli lilly', 'roche', 'novartis',
    'astrazeneca', 'bristol myers', 'amgen', 'gilead', 'regeneron', 'vertex',
    'incyte', 'moderna', 'biontech', 'seagen', 'dexcom', 'allergan', 'allergan',
    'celgene', 'takeda', 'astellas', 'bayer', 'sanofi', 'abbott', 'boehringer'
  ];
  
  let acquirer = null;
  let target = null;
  
  // Try to find company pairs
  for (const company of pharmaCompanies) {
    if (title.includes(company)) {
      if (!acquirer) {
        acquirer = company.charAt(0).toUpperCase() + company.slice(1);
      } else if (!target) {
        target = company.charAt(0).toUpperCase() + company.slice(1);
        break;
      }
    }
  }
  
  // Extract deal type
  let dealType = 'Acquisition';
  if (title.includes('merge')) dealType = 'Merger';
  else if (title.includes('partner')) dealType = 'Partnership';
  else if (title.includes('license')) dealType = 'Licensing';
  else if (title.includes('joint venture')) dealType = 'Joint Venture';
  
  return {
    acquirer: acquirer || 'Unnamed Company',
    target: target || 'Unnamed Target',
    dealType,
    ...article
  };
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  try {
    // Allow CORS
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: 'OK'
      };
    }
    
    // Get search query from params
    const searchQuery = event.queryStringParameters?.query || 'pharmaceutical M&A acquisitions';
    
    // Check cache
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < cache.ttl) {
      console.log('Returning cached data');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          source: 'cache',
          items: cache.data,
          count: cache.data.length
        })
      };
    }
    
    // Build Google News RSS URL
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}`;
    
    console.log('Fetching from:', googleNewsUrl);
    
    // Fetch RSS feed
    const rssData = await fetchRSSFeed(googleNewsUrl);
    
    // Parse RSS
    const articles = parseRSSFeed(rssData);
    
    // Extract deal information
    const deals = articles.map(extractDealInfo);
    
    // Cache the results
    cache.data = deals;
    cache.timestamp = now;
    
    console.log(`Found ${deals.length} deals`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        source: 'google-news-rss',
        items: deals,
        count: deals.length,
        query: searchQuery,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message,
        fallback: true
      })
    };
  }
};
