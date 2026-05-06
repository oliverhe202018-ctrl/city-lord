"use client";

import { useMemo } from "react";
import { sanitizeHTML } from "@/lib/utils/sanitize-html";

interface SafeHTMLProps {
    html: string;
    className?: string;
}

/**
 * SafeHTML Component
 * 
 * Safely renders user-provided HTML text by neutralizing potential XSS attack vectors.
 * Uses centralized DOMPurify configuration.
 * 
 * Supported Tags: <b>, <i>, <br>, <p>, <a>
 * Supported Attributes: href (on <a> tags only)
 * 
 * Target and rel attributes are automatically explicitly enforced for links.
 * All javascript: URIs and dangerous attributes (onerror, onload, style) are aggressively stripped.
 */
export function SafeHTML({ html, className = "" }: SafeHTMLProps) {
    // Isomorphic-dompurify handles SSR safely without needing useEffect mounting delays
    const sanitized = useMemo(() => sanitizeHTML(html), [html]);

    if (!sanitized) return null;

    return (
        <div
            className={`prose prose-sm max-w-none text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-p:my-1 first:prose-p:mt-0 last:prose-p:mb-0 ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitized }}
        />
    );
}
