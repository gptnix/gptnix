'use strict';

/**
 * Chat Utilities
 * 
 * Helper functions extracted from chat.js
 */

/**
 * Check if query has contact intent (phone, email, address)
 * 
 * @param {string} q - User query
 * @returns {boolean}
 */
function isContactIntent(q) {
  const s = String(q || '').toLowerCase();
  return /(kontakt|contact|telefon|tel\.|mob|broj|pozovi|pozvati|email|e-mail|mail|radno vrijeme|radno vreme|working hours|adresa|lokacija)/i.test(
    s
  );
}

/**
 * Check if query has explicit date (29.12.2025, 27. prosinca 2025)
 * 
 * @param {string} q - User query
 * @returns {boolean}
 */
function isExplicitDateIntent(q) {
  const s = String(q || '');
  // 29.12.2025 or 29/12/2025 etc.
  if (/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/.test(s)) return true;
  // 27. prosinca 2025 (month words)
  if (
    /\b\d{1,2}\.\s*(siječnja|sijecnja|veljače|veljace|ožujka|ozujka|travnja|svibnja|lipnja|srpnja|kolovoza|rujna|listopada|studenoga|prosinca)\s*\d{4}\b/i.test(
      s
    )
  )
    return true;
  return false;
}

/**
 * Strip tool output format (XML, markdown) to plain text
 * Prevents LLM from echoing raw XML/markdown tags
 * 
 * @param {string} text - Tool output with formatting
 * @returns {string} - Clean plain text
 */
function stripToolFormat(text) {
  if (!text || typeof text !== 'string') return '';
  
  let s = text;
  
  // Remove XML tags
  s = s.replace(/<\/?[^>]+(>|$)/g, ' ');
  
  // Remove markdown images: ![alt](url)
  s = s.replace(/!\[.*?\]\(.*?\)/g, ' ');
  
  // Remove markdown headers: ### Title
  s = s.replace(/^#+\s+/gm, '');
  
  // Remove bold: **text**
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  
  // Remove italic: *text*
  s = s.replace(/\*(.*?)\*/g, '$1');
  
  // Remove bullets: - item
  s = s.replace(/^[\-\*]\s+/gm, '');
  
  // Remove blockquotes: > quote
  s = s.replace(/^>\s+/gm, '');
  
  // Decode HTML entities
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&apos;/g, "'");
  
  // Collapse excessive newlines
  s = s.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  s = s.trim();
  
  return s;
}

module.exports = {
  isContactIntent,
  isExplicitDateIntent,
  stripToolFormat,
};
