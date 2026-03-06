/**
 * Contact Probe Module - V2.0
 * 
 * REDESIGNED: Executes ONLY for contact intent queries
 * 
 * Purpose:
 * - Probe common contact pages (/kontakt, /o-nama, etc.)
 * - Extract contact information (phone, email, address)
 * - Budget-aware execution (max 6 pages, 9s timeout)
 * 
 * Trigger conditions:
 * - classification.intent === 'contact'
 * - AND no contact info in main search results
 * 
 * @module contactProbe
 */

'use strict';

const { getDomain } = require('../../utils/url');

/**
 * Execute contact probe
 * 
 * @param {string} seedUrl - Starting URL (from search results)
 * @param {string} query - Original query
 * @param {object} options - Probe options
 * @returns {Promise<object>} Probe result
 */
async function executeContactProbe(seedUrl, query, options = {}) {
  const {
    maxPages = 6,           // Max pages to probe
    budgetMs = 9000,        // Total timeout (ms)
    goal = 'contact',       // 'contact' | 'about'
    readWebPage = null,     // Web page reader function
  } = options;
  
  if (!readWebPage) {
    throw new Error('readWebPage function is required');
  }
  
  console.log(`🔍 [CONTACT_PROBE] Starting probe for: ${seedUrl}`);
  console.log(`🔍 [CONTACT_PROBE] Budget: ${maxPages} pages, ${budgetMs}ms`);
  
  const startTime = Date.now();
  const domain = getDomain(seedUrl) || '';
  
  try {
    // Build candidate URLs
    const candidates = buildContactCandidateUrls(seedUrl, goal);
    console.log(`🔍 [CONTACT_PROBE] Candidates: ${candidates.length} URLs`);
    
    // Probe each candidate (budget-aware)
    let bestResult = null;
    let pagesProbed = 0;
    
    for (const url of candidates) {
      // Check timeout budget
      const elapsed = Date.now() - startTime;
      if (elapsed >= budgetMs) {
        console.log(`⏱️ [CONTACT_PROBE] Timeout budget exhausted (${elapsed}ms)`);
        break;
      }
      
      // Check page budget
      if (pagesProbed >= maxPages) {
        console.log(`📄 [CONTACT_PROBE] Page budget exhausted (${pagesProbed} pages)`);
        break;
      }
      
      try {
        console.log(`🔍 [CONTACT_PROBE] Probing: ${url}`);
        
        const page = await readWebPage(url, {
          hint: query || 'kontakt',
          timeout: Math.min(3000, budgetMs - elapsed),
        });
        
        pagesProbed++;
        
        // Extract contact information
        const contactInfo = extractContactInfo(page.text || page.content || '');
        
        // Score this page
        const pageScore = scoreContactPage(url, page, contactInfo);
        
        console.log(`📊 [CONTACT_PROBE] ${url}: score=${pageScore}, contacts=${contactInfo.emails.length + contactInfo.phones.length}`);
        
        // Keep best result
        if (!bestResult || pageScore > bestResult.score) {
          bestResult = {
            url,
            score: pageScore,
            contactInfo,
            page,
          };
        }
        
        // Early exit if we found excellent contact page
        if (pageScore >= 8.0 && contactInfo.emails.length > 0 && contactInfo.phones.length > 0) {
          console.log(`✅ [CONTACT_PROBE] Excellent contact page found, stopping early`);
          break;
        }
        
      } catch (pageError) {
        console.warn(`⚠️ [CONTACT_PROBE] Failed to probe ${url}:`, pageError.message);
        // Continue to next candidate
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    if (bestResult) {
      console.log(`✅ [CONTACT_PROBE] Success: ${bestResult.url} (score=${bestResult.score.toFixed(1)}, ${pagesProbed} pages, ${totalTime}ms)`);
      
      return {
        ok: true,
        url: bestResult.url,
        contactInfo: bestResult.contactInfo,
        score: bestResult.score,
        metadata: {
          pages_probed: pagesProbed,
          total_time_ms: totalTime,
          domain,
        },
      };
    } else {
      console.log(`❌ [CONTACT_PROBE] No contact info found (${pagesProbed} pages, ${totalTime}ms)`);
      
      return {
        ok: false,
        url: seedUrl,
        contactInfo: { emails: [], phones: [], addresses: [] },
        score: 0,
        metadata: {
          pages_probed: pagesProbed,
          total_time_ms: totalTime,
          domain,
        },
      };
    }
    
  } catch (error) {
    console.error(`❌ [CONTACT_PROBE] Error:`, error.message);
    
    return {
      ok: false,
      url: seedUrl,
      contactInfo: { emails: [], phones: [], addresses: [] },
      score: 0,
      error: error.message,
      metadata: {
        pages_probed: 0,
        total_time_ms: Date.now() - startTime,
        domain,
      },
    };
  }
}

/**
 * Build candidate URLs for contact probe
 * 
 * Strategy:
 * - Common contact pages: /kontakt, /contact, /kontakti, /contacts
 * - About pages: /o-nama, /about, /impressum
 * - Working hours: /radno-vrijeme, /working-hours
 * - Language variants: /hr/kontakt, /en/contact, etc.
 */
function buildContactCandidateUrls(seedUrl, goal = 'contact') {
  let u;
  try {
    u = new URL(String(seedUrl || '').trim());
  } catch {
    return [];
  }
  
  const origin = u.origin;
  const basePathParts = u.pathname.split('/').filter(Boolean);
  const langPrefixes = new Set(['hr', 'bs', 'ba', 'sr', 'en', 'de', 'it']);
  const maybeLang = basePathParts.length ? String(basePathParts[0]).toLowerCase() : '';
  const langPrefix = langPrefixes.has(maybeLang) ? `/${maybeLang}` : '';
  
  const contactPaths = [
    '/kontakt',
    '/kontakti',
    '/kontakt.html',
    '/kontakti.html',
    '/contact',
    '/contacts',
    '/contact.html',
    '/contacts.html',
  ];
  
  const aboutPaths = [
    '/o-nama',
    '/o-nama.html',
    '/about',
    '/about.html',
    '/about-us',
    '/impressum',
    '/impressum.html',
  ];
  
  const workingHoursPaths = [
    '/radno-vrijeme',
    '/radno-vreme',
    '/radno-vrijeme.html',
    '/working-hours',
    '/opening-hours',
  ];
  
  // Choose paths based on goal
  let primaryPaths = contactPaths;
  if (goal === 'about') {
    primaryPaths = [...aboutPaths, ...contactPaths];
  } else if (goal === 'working_hours') {
    primaryPaths = [...workingHoursPaths, ...contactPaths];
  }
  
  const candidates = new Set();
  
  // Add primary paths (without lang prefix)
  for (const path of primaryPaths) {
    candidates.add(`${origin}${path}`);
  }
  
  // Add with lang prefix (if detected)
  if (langPrefix) {
    for (const path of primaryPaths) {
      candidates.add(`${origin}${langPrefix}${path}`);
    }
  }
  
  // Add root as fallback
  candidates.add(origin);
  
  return Array.from(candidates);
}

/**
 * Extract contact information from page text
 * 
 * Extracts:
 * - Emails
 * - Phone numbers
 * - Addresses
 */
function extractContactInfo(text) {
  const contactInfo = {
    emails: [],
    phones: [],
    addresses: [],
  };
  
  // Email regex
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const emails = text.match(emailRegex) || [];
  contactInfo.emails = [...new Set(emails)]; // Deduplicate
  
  // Phone regex (international + local)
  const phoneRegex = /(?:\+?38[79]|0)?[\s\-\(]?\d{2,3}[\s\-\)]?\d{3}[\s\-]?\d{2,4}/g;
  const phones = text.match(phoneRegex) || [];
  contactInfo.phones = [...new Set(phones.map(p => p.trim()))]; // Deduplicate & trim
  
  // Address (simple heuristic - street number + street name)
  const addressRegex = /\d+\s+[A-ZČĆŠĐŽ][a-zčćšđž]+\s+(ulica|ul\.|bb|street|st\.)/gi;
  const addresses = text.match(addressRegex) || [];
  contactInfo.addresses = [...new Set(addresses)]; // Deduplicate
  
  return contactInfo;
}

/**
 * Score contact page quality
 * 
 * Scoring:
 * +3: Has /kontakt or /contact in URL
 * +2: Has email
 * +2: Has phone
 * +1: Has address
 * +1: Has working hours
 * +1: Page title contains "kontakt" or "contact"
 */
function scoreContactPage(url, page, contactInfo) {
  let score = 0;
  
  // URL contains contact
  if (/\/kontakt|\/contact/i.test(url)) {
    score += 3;
  }
  
  // Has email
  if (contactInfo.emails.length > 0) {
    score += 2;
  }
  
  // Has phone
  if (contactInfo.phones.length > 0) {
    score += 2;
  }
  
  // Has address
  if (contactInfo.addresses.length > 0) {
    score += 1;
  }
  
  // Has working hours
  const text = page.text || page.content || '';
  if (/radno\s+vrijeme|working\s+hours|otvoreno|open/i.test(text)) {
    score += 1;
  }
  
  // Title contains contact
  const title = page.title || '';
  if (/kontakt|contact|o\s+nama|about/i.test(title)) {
    score += 1;
  }
  
  return score;
}

/**
 * Check if search results already have contact info
 * 
 * Used to skip contact probe if main results are sufficient
 */
function resultsHaveContactInfo(results) {
  for (const result of results) {
    const text = `${result.snippet || ''} ${result.content || ''}`;
    
    // Check for email
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) {
      return true;
    }
    
    // Check for phone
    if (/(?:\+?38[79]|0)?[\s\-\(]?\d{2,3}[\s\-\)]?\d{3}[\s\-]?\d{2,4}/.test(text)) {
      return true;
    }
    
    // Check for contact signals
    if (/(tel|telefon|mob|phone|email|e-mail|kontakt|contact)/i.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Export helpers for testing
 */
const _internal = {
  buildContactCandidateUrls,
  extractContactInfo,
  scoreContactPage,
};

module.exports = {
  executeContactProbe,
  resultsHaveContactInfo,
  _internal,
};
