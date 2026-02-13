import { ClientBillingConfig } from "@/types/client";

export function getInvoiceRecipients(billing: ClientBillingConfig): string[] {
    const { sending } = billing;

    // Validate again just in case (though schema handles it)
    if (!sending.invoiceEmails || sending.invoiceEmails.length === 0) return [];

    if (sending.invoiceEmailsEnabled) {
        // Return all unique emails
        return Array.from(new Set(sending.invoiceEmails.map(e => e.trim().toLowerCase())));
    } else {
        // Return first email only
        const first = sending.invoiceEmails[0];
        return first ? [first.trim().toLowerCase()] : [];
    }
}
