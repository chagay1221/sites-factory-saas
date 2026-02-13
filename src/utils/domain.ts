/**
 * Normalizes a domain string for consistent storage and comparison.
 * Rules:
 * - Trim spaces
 * - Lowercase
 * - Remove "http://", "https://"
 * - Remove leading "www."
 * - Remove trailing slashes
 * - If empty after normalization -> undefined
 */
export function normalizeDomain(input: string | undefined | null): string | undefined {
    if (!input) return undefined;

    let domain = input.trim().toLowerCase();

    // Remove protocol (recursive to handle pasted duplicates like https://https://)
    while (domain.startsWith('http://') || domain.startsWith('https://')) {
        domain = domain.replace(/^https?:\/\//, '');
    }

    // Remove trailing slash
    while (domain.endsWith('/')) {
        domain = domain.slice(0, -1);
    }

    // Remove leading www.
    domain = domain.replace(/^www\./, '');

    // Final check for empty string
    if (!domain) return undefined;

    return domain;
}

export function ensureProtocol(url: string | undefined | null): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;

    // If it already has protocol, return
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    // Otherwise prepend https
    return `https://${trimmed}`;
}
