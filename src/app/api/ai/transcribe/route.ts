import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Inicializar OpenAI de forma segura
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(req: Request) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key no está configurada.' },
        { status: 500 }
      );
    }

    // Recibir los datos del formulario (FormData) que contiene el archivo de audio
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No se recibió ningún archivo de audio.' },
        { status: 400 }
      );
    }

    // OpenAI necesita que el archivo tenga un nombre que pueda reconocer (ej. audio.webm)
    const buffer = Buffer.from(await file.arrayBuffer());
    // Convertimos el Buffer a un objeto File-like que OpenAI Node SDK pueda entender 
    // (usamos la propiedad de File de fetch API)
    const openAIFile = new File([buffer], file.name || 'audio.webm', { type: file.type || 'audio/webm' });

    // Llamada a la API de Whisper de OpenAI para transcribir el audio
    const transcription = await openai.audio.transcriptions.create({
      file: openAIFile,
      model: 'whisper-1',
      language: 'it', // Forzamos un poco que entienda que es un restaurante italiano (opcional pero ayuda)
    });

    if (!transcription || !transcription.text) {
        throw new Error("No se pudo transcribir el audio.");
    }

    // Devolvemos el texto que entendió la IA
    return NextResponse.json({ text: transcription.text });

  } catch (error: unknown) {
    console.error('API /ai/transcribe error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error transcribiendo el audio';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
