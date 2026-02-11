
export function normalizeEmail(email: string | undefined | null): string | undefined {
    if (!email) return undefined;
    return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | undefined | null): string | undefined {
    if (!phone) return undefined;
    // Remove all non-digits
    return phone.replace(/\D/g, '');
}
