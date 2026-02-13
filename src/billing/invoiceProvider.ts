import { InvoiceInput } from "@/schemas/invoice";

export interface ProviderInvoiceResult {
    providerInvoiceId: string;
    invoiceNumber: string;
    pdfUrl: string;
    externalUrl: string;
}

export async function issueInvoiceMock(payload: { amount: number, currency: string, description?: string, clientId: string }): Promise<ProviderInvoiceResult> {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const invoiceNumber = `TEST-${dateStr}-${randomId}`;

    return {
        providerInvoiceId: `mock_inv_${Date.now()}_${randomId}`,
        invoiceNumber,
        pdfUrl: `https://mock-provider.com/invoices/${invoiceNumber}.pdf`,
        externalUrl: `https://mock-provider.com/view/${invoiceNumber}`
    };
}
