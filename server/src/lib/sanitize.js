// server/src/lib/sanitize.js
//
// NOTE: For production use, install sanitize-html for robust HTML sanitization:
//   npm install sanitize-html
// The sanitizeHtml function below provides a basic built-in implementation.
// Replace it with sanitize-html for full coverage.

/**
 * Basic allow-list of safe HTML tags for user content.
 */
const SAFE_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li', 'a', 'span',
]);

/**
 * Strip dangerous HTML tags while keeping safe formatting.
 * For production robustness, replace this with the sanitize-html package.
 *
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove script tags and their contents
  let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handler attributes
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove javascript: URIs in attributes
  cleaned = cleaned.replace(/\b(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');

  // Remove tags not in the safe list
  cleaned = cleaned.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    if (SAFE_TAGS.has(tagName.toLowerCase())) {
      // For safe tags, strip any remaining event handlers
      return match.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    }
    return '';
  });

  return cleaned.trim();
}

/**
 * Wrap user input in XML delimiters for safe inclusion in AI prompts.
 * Prevents prompt injection by clearly delimiting untrusted content.
 *
 * @param {string} input - Raw user input
 * @param {string} [tag='user_input'] - The XML tag name to use
 * @returns {string} Input wrapped in XML delimiters
 */
export function sanitizeForPrompt(input, tag = 'user_input') {
  if (typeof input !== 'string') {
    return `<${tag}></${tag}>`;
  }

  // Strip any attempts to close the delimiter tag
  const escaped = input
    .replace(new RegExp(`</${tag}>`, 'gi'), '')
    .replace(new RegExp(`<${tag}>`, 'gi'), '');

  return `<${tag}>${escaped}</${tag}>`;
}

/**
 * Remove script tags, event handlers, and javascript: URIs from input.
 * Use this for quick XSS prevention on plain text fields.
 *
 * @param {string} input - Raw user input
 * @returns {string} Cleaned string
 */
export function stripXSS(input) {
  if (typeof input !== 'string') {
    return '';
  }

  let cleaned = input;

  // Remove script tags and contents
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Remove event handlers that might survive tag stripping
  cleaned = cleaned.replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove javascript: URIs
  cleaned = cleaned.replace(/javascript\s*:/gi, '');

  // Remove data: URIs (potential XSS vector)
  cleaned = cleaned.replace(/data\s*:\s*text\/html/gi, '');

  return cleaned.trim();
}
