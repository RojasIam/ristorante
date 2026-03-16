import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        // Ignorar certificados autofirmados temporalmente para permitir conexión con Dokploy/Traefik
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        
        const body = await request.json();
        
        // Webhook URL for Reservation Confirmation (n8n).
        // Since the workflow is new, we initially use the test URL so user can configure n8n.
        const n8nWebhookUrl = process.env.N8N_CONFIRM_WEBHOOK_URL || "http://automatizaciones-n8n-7ea193-157-180-38-85.traefik.me/webhook-test/fe7f9dad-1464-4a57-8b4a-3dcf48d5f8fa";

        const response = await fetch(n8nWebhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("n8n responded with status", response.status, "and body:", errorText);
            return NextResponse.json({ error: "Failed to forward request to n8n", details: errorText }, { status: response.status });
        }

        const data = await response.text();
        let parsedData = { success: true };
        if (data) {
            try {
                parsedData = JSON.parse(data);
            } catch {
                // Ignore parse error if response is not JSON
            }
        }

        return NextResponse.json(parsedData);
    } catch (error) {
        console.error("Proxy error to n8n:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
