export interface EmailPayload {
    to: string[];
    subject: string;
    body: string;
    links?: { label: string, url: string }[];
}

export async function sendInvoiceEmailMock(payload: EmailPayload): Promise<void> {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 600));

    // Simulate random failure (10% chance) IF env var set, otherwise usually succeed
    // For MVP, enable failure simulation only if explicit
    if (process.env.MOCK_EMAIL_FAIL_RATE) {
        if (Math.random() < parseFloat(process.env.MOCK_EMAIL_FAIL_RATE)) {
            throw new Error("Simulated email provider failure");
        }
    }

    console.log(`[MockEmail] Sending to ${payload.to.join(', ')}: ${payload.subject}`);
    // Implicit success
}
