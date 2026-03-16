import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Inicializar OpenAI de forma segura (si no hay key configurada, que no rompa el servidor al inicio)
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(req: Request) {
  try {
    // Verificar si la clave de API existe
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key no está configurada en .env.local' },
        { status: 500 }
      );
    }

    // Recibir el texto enviado desde el frontend
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere un texto para analizar.' },
        { status: 400 }
      );
    }

    // Promt para OpenAI: Le indicamos exactamente cómo queremos la respuesta
    const systemPrompt = `
      Eres un recepcionista experto de un restaurante de alta gama en Italia llamado Dellicatesen.
      El usuario te dará un texto (posiblemente de WhatsApp o una transcripción de voz) de un cliente que quiere hacer una reserva.
      Tu trabajo es analizar el texto, extraer los datos clave y devolver ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
      {
        "customer_name": "Nombre exacto o aproximado (Ej. Mario Rossi)",
        "reservation_date": "Fecha en formato YYYY-MM-DD. Hoy es ${new Date().toISOString().split('T')[0]}, calcula la fecha en base a esto si dicen 'hoy', 'mañana', etc.",
        "reservation_time": "Hora en formato HH:MM (24hrs)",
        "service_type": "P" si es almuerzo (pranzo), "C" si es cena. Si no se especifica y la hora es antes de las 16:00, asume 'P'. Si es después, asume 'C'.",
        "cover_count": "Número entero de personas (Ej. 4)",
        "customer_phone": "Número de teléfono. Añade SIEMPRE el prefijo de Italia (+39) si no se especifica otro código de país (Ej. +39333...). Vacio si no hay.",
        "notes": "Cualquier otra instrucción general, como 'quiero mesa afuera', 'es un cumpleaños'. Vacio si no hay.",
        "allergies": "Extrae EXCLUSIVAMENTE menciones de alergias o intollerancias aquí (Ej. Celiaco, Lattosio). Si no hay, vacio."
      }
      Es crítico que devuelvas SOLO formato JSON, sin texto explicativo extra, sin Markdown ni comillas backticks en los bordes.
    `;

    // Llamada real a OpenAI (GPT-4o mini, más que suficiente para esto y muy económico)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      temperature: 0.1, // Baja creatividad, necesitamos datos precisos
      response_format: { type: "json_object" } // Obliga a OpenAI a devolver JSON siempre
    });

    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent) {
        throw new Error("No se recibió respuesta de OpenAI");
    }

    // Parsear la respuesta y enviarla de vuelta al frontend
    const extractedData = JSON.parse(responseContent);

    return NextResponse.json(extractedData);

  } catch (error: unknown) {
    console.error('API /ai/parse-reservation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error analizando o parseando el texto con la IA';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
