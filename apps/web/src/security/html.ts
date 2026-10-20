import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist for the rare case a field is stored as HTML. Plain-text fields
 * stay React text children and are not passed through this.
 * The list is tags and attributes a note may contain. Scripts, event
 * handlers, and non-http links are removed.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
  allowProtocolRelative: false,
};

export function sanitizeRichHtml(value: string): string {
  return sanitizeHtml(value, OPTIONS);
}
