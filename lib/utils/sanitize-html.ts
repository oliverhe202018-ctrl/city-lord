// Centralized DOMPurify configuration
import DOMPurify from 'isomorphic-dompurify';

/**
 * Global centralized HTML sanitization utility.
 * Strict configuration to perfectly mitigate XSS across all text components.
 */
export function sanitizeHTML(html: string): string {
    if (!html) return "";

    // Add hook to enforce target="_blank" and rel="noopener noreferrer" for safety
    DOMPurify.addHook("afterSanitizeAttributes", function (node: Element) {
        if (node.tagName === "A" && node.hasAttribute("href")) {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
        }
    });

    const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ["b", "i", "br", "p", "a"],
        ALLOWED_ATTR: ["href"], // Strip style, class, id, on* etc.
        FORBID_TAGS: ["script", "style", "form", "input", "button", "svg", "math", "iframe"], // Strict mitigation including <script>
        FORBID_ATTR: ["style", "onerror", "onload"], // Emergency fallback: strip dangerous ones even if ALLOWED_ATTR fails somehow
        ALLOW_DATA_ATTR: false, // Disallow data-* vectors
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i, // Prevent javascript: links
    });

    // Remove hook after sanitation to prevent side effects or memory leaks
    DOMPurify.removeAllHooks();

    return clean;
}
