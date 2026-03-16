"use client";

import React, { useState, useEffect, useRef } from "react";
import { FaPlus, FaMicrophone, FaPaperPlane, FaWhatsapp, FaRobot, FaEdit, FaStop } from "react-icons/fa";
import { createClient } from "@/utils/supabase/client";

// This will eventually go into a separate types or components file
interface Reservation {
  id: string;
  customer_name: string;
  reservation_date: string;
  reservation_time: string;
  service_type: "P" | "C";
  cover_count: number;
  customer_phone: string;
  notes: string | null;
  allergies: string | null;
  status: string;
  review_sent: boolean;
}

export default function PrenotazionePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false); // Estado para el botón de text AI
  const [isRecording, setIsRecording] = useState(false); // Estado de la grabación de voz
  const [voiceProcessing, setVoiceProcessing] = useState(false); // Estado subiendo audio
  const [transcribedVoiceText, setTranscribedVoiceText] = useState(""); // Texto final transcrito para confirmación
  
  // Referencias para MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Form state
  const [inputMode, setInputMode] = useState<"manual" | "voice" | "text">("manual");
  const [aiText, setAiText] = useState("");
  const [formData, setFormData] = useState({
    customer_name: "",
    reservation_date: "",
    reservation_time: "",
    service_type: "C",
    cover_count: 2,
    customer_phone: "",
    notes: "",
    allergies: ""
  });

  const supabase = createClient();

  const fetchReservations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("reservation_date", { ascending: false })
      .order("reservation_time", { ascending: false });
      
    if (!error && data) {
      setReservations(data as Reservation[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReservations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lógica principal para parsear un texto (venga de input manual o de voz transcrita)
  const processTextToReservation = async (textToProcess: string) => {
    if (!textToProcess.trim()) return false;

    try {
        const response = await fetch('/api/ai/parse-reservation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToProcess })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en la llamada a la API');
        }

        const data = await response.json();

        // Actualizamos el formulario con lo que entendió la IA
        setFormData(prev => ({
            ...prev,
            customer_name: data.customer_name || prev.customer_name,
            reservation_date: data.reservation_date || prev.reservation_date,
            reservation_time: data.reservation_time || prev.reservation_time,
            service_type: data.service_type || prev.service_type,
            cover_count: data.cover_count || prev.cover_count,
            customer_phone: data.customer_phone || prev.customer_phone,
            notes: data.notes || prev.notes,
            allergies: data.allergies || prev.allergies,
        }));

        // Cambiamos al modo manual para que el usuario pueda corroborar/editar
        setInputMode("manual");
        setAiText(""); 
        return true;

    } catch (error) {
        console.error("Failed to process AI text", error);
        alert("Oops! No pudimos analizar correctamente. Por favor, reintenta o escríbelo.");
        return false;
    }
  };

  const handleProcessAiText = async () => {
    setAiLoading(true);
    await processTextToReservation(aiText);
    setAiLoading(false);
  };

  // =============== LÓGICA DE GRABACIÓN DE VOZ ===============
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      alert("Por favor, permite el acceso al micrófono en tu navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        // Al terminar, construimos el archivo
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Detenemos todas las pistas del micrófono para que deje de salir el puntito rojo en chrome
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        
        await sendAudioToTranscribe(audioBlob);
      };

      mediaRecorderRef.current.stop();
    }
  };

  const sendAudioToTranscribe = async (audioBlob: Blob) => {
    setVoiceProcessing(true);
    try {
      // 1. Enviar a Whisper
      const form = new FormData();
      form.append('file', audioBlob, 'voice.webm');

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
          throw new Error("No se pudo transcribir el audio");
      }
      
      const { text } = await response.json();
      
      if (text) {
          // Mostramos el texto al usuario para que confirme antes del análisis
          setTranscribedVoiceText(text);
      }
    } catch (error) {
        console.error("Failed voice transcription", error);
        alert("Ocurrió un error al transcribir tu voz.");
    } finally {
      setVoiceProcessing(false);
    }
  };
  // ==========================================================


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("reservations").insert([formData]).select();
    
    if (!error && data) {
      const newReservation = data[0] as Reservation;
      setReservations(prev => [newReservation, ...prev]);
      setIsModalOpen(false);
      
      // Send confirmation message to new n8n workflow quietly in the background
      if (newReservation.customer_phone) {
          fetch("/api/n8n/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  reservation_id: newReservation.id,
                  customer_name: newReservation.customer_name,
                  customer_phone: newReservation.customer_phone,
                  reservation_date: newReservation.reservation_date,
                  reservation_time: newReservation.reservation_time,
                  service_type: newReservation.service_type === 'P' ? 'Pranzo' : 'Cena',
                  cover_count: newReservation.cover_count
              })
          }).catch(err => console.error("Error sending confirmation webhook:", err));
      }

      // Reset form
      setFormData({
        customer_name: "", reservation_date: "", reservation_time: "",
        service_type: "C", cover_count: 2, customer_phone: "", notes: "", allergies: ""
      });
    } else {
        console.error("Error inserting reservation:", error);
    }
  };

  const [sendingReviewId, setSendingReviewId] = useState<string | null>(null);

  const handleSendReview = async (res: Reservation) => {
      if (!res.customer_phone) {
          alert("El cliente no tiene teléfono asignado.");
          return;
      }
      
      setSendingReviewId(res.id);
      
      try {
          // 1. Enviar los datos del cliente al Webhook de n8n pasando por nuestro Proxy para evitar errores CORS
          const webhookUrl = "/api/n8n/review";
          
          const response = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({
                  reservation_id: res.id,
                  customer_name: res.customer_name,
                  customer_phone: res.customer_phone,
                  reservation_date: res.reservation_date,
                  reservation_time: res.reservation_time,
                  service_type: res.service_type === 'P' ? 'Pranzo' : 'Cena',
                  cover_count: res.cover_count
              })
          });

          if (!response.ok) {
              throw new Error("No se pudo contactar con el sistema de automatización (n8n).");
          }
          
          // 2. Si el envío funcionó, marcamos review_sent a true en supabase
          const { error } = await supabase
            .from('reservations')
            .update({ review_sent: true })
            .eq('id', res.id);
            
          if (error) {
              console.error("Error al actualizar estado en la base de datos", error);
              throw new Error("El mensaje se envió, pero hubo un error al actualizar la vista.");
          }

          // Éxito: Actualizamos la tabla visual
          setReservations(prev => 
              prev.map(r => r.id === res.id ? { ...r, review_sent: true } : r)
          );
          
      } catch (error) {
          console.error("Failed to send review request:", error);
          alert(error instanceof Error ? error.message : "Ocurrió un error desconocido al enviar el mensaje.");
      } finally {
          setSendingReviewId(null);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      

      {/* Tabla de Reservas */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Lista delle Prenotazioni</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestisci i tavoli e invia richieste di recensione via WhatsApp.</p>
            </div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md hover:shadow-brand-500/20 hover:-translate-y-0.5 transition-all duration-300 text-sm"
            >
                <FaPlus className="text-sm" />
                <span className="tracking-wide uppercase">Prenota</span>
            </button>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Cliente / Info</th>
                        <th className="px-6 py-4">Data & Ora</th>
                        <th className="px-6 py-4 text-center">Servizio</th>
                        <th className="px-6 py-4 text-center">Coperti</th>
                        <th className="px-6 py-4 text-center">Allergie</th>
                        <th className="px-6 py-4">Note Speciali</th>
                        <th className="px-6 py-4 text-right">Azione Recensione</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {loading ? (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Caricamento prenotazioni...</td></tr>
                    ) : reservations.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Nessuna prenotazione trovata.</td></tr>
                    ) : reservations.map(res => (
                        <tr key={res.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-6 py-4">
                                <p className="font-bold text-gray-900 dark:text-white text-base">{res.customer_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{res.customer_phone || 'Nessun telefono'}</p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-medium text-gray-800 dark:text-gray-200">{new Date(res.reservation_date).toLocaleDateString()}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{res.reservation_time.substring(0, 5)}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-black tracking-widest ${
                                    res.service_type === 'P' ? 'bg-brand-500/10 text-brand-500' : 'bg-[#034d63]/10 text-[#034d63]'
                                }`}>
                                    {res.service_type === 'P' ? 'PRANZO' : 'CENA'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-300">
                                    {res.cover_count}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                {res.allergies ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200/50">
                                        {res.allergies}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                {res.notes ? (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{res.notes}</p>
                                ) : (
                                    <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                {res.review_sent ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200/50">
                                        <FaWhatsapp /> Inviato
                                    </span>
                                ) : (
                                    <button 
                                        onClick={() => handleSendReview(res)}
                                        disabled={sendingReviewId === res.id}
                                        className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-green-500 rounded-lg shadow-sm shadow-green-500/20 transition-all ${
                                            sendingReviewId === res.id 
                                            ? 'opacity-80 cursor-wait' 
                                            : 'hover:bg-green-600 hover:shadow-md hover:-translate-y-0.5'
                                        }`}
                                    >
                                        {sendingReviewId === res.id ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                Inviando...
                                            </>
                                        ) : (
                                            <>
                                                <FaPaperPlane /> 
                                                Invia Recensione
                                            </>
                                        )}
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL DE RESERVA INTELLIGENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col max-h-[95vh]">
                
                {/* Header Modal */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Nuova Prenotazione</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inserimento tradizionale o con Aiuto IA</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Select Input Mode */}
                    <div className="flex gap-2 mb-8 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl">
                        <button 
                            onClick={() => setInputMode("manual")}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all ${inputMode === "manual" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
                        >
                            <FaEdit /> Tradizionale
                        </button>
                        <button 
                            onClick={() => setInputMode("text")}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all ${inputMode === "text" ? "bg-white dark:bg-gray-700 shadow-sm text-brand-500" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
                        >
                            <FaRobot /> Testo AI
                        </button>
                        <button 
                            onClick={() => setInputMode("voice")}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all ${inputMode === "voice" ? "bg-white dark:bg-gray-700 shadow-sm text-red-500" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
                        >
                            <FaMicrophone /> Voce AI
                        </button>
                    </div>

                    {/* AI TEXT/VOICE SECTION */}
                    {(inputMode === "text" || inputMode === "voice") && (
                        <div className="mb-8 p-4 bg-brand-50/50 dark:bg-brand-900/10 rounded-xl border border-brand-100 dark:border-brand-900/30">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                                {inputMode === "text" ? "Incolla il massaggio del cliente:" : "Registrazione Voce (Simulazione)"}
                            </label>
                            {inputMode === "text" ? (
                                <textarea 
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:text-white"
                                    rows={3}
                                    placeholder="Es: Ciao, vorrei prenotare per 4 persone stasera alle 21. Nessuna allergia. Il mio numero è +39 342..."
                                    value={aiText}
                                    onChange={(e) => setAiText(e.target.value)}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-5 px-4 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-red-200 dark:border-red-900/30 transition-all">
                                    {voiceProcessing ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-red-100 border-t-red-500 rounded-full animate-spin"></div>
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-3 animate-pulse">Trascrizione e Analisi in corso...</p>
                                        </div>
                                    ) : transcribedVoiceText ? (
                                        <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                                            <FaRobot className="text-3xl text-brand-500 mb-2" />
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 text-center bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 w-full mb-3 shadow-inner">
                                                &quot;{transcribedVoiceText}&quot;
                                            </p>
                                            <div className="flex gap-2 w-full justify-center">
                                                <button 
                                                    onClick={() => setTranscribedVoiceText("")}
                                                    className="px-3 py-1.5 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    Riprova
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        setVoiceProcessing(true);
                                                        await processTextToReservation(transcribedVoiceText);
                                                        setVoiceProcessing(false);
                                                        setTranscribedVoiceText(""); // Limpiamos después de procesar
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/30 rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <FaRobot /> Conferma
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={isRecording ? stopRecording : startRecording}
                                                className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${
                                                    isRecording 
                                                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40 hover:bg-red-600 scale-105' 
                                                    : 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 shadow-sm'
                                                }`}
                                            >
                                                {isRecording ? <FaStop className="text-2xl" /> : <FaMicrophone className="text-2xl" />}
                                            </button>
                                            <p className={`text-xs font-bold mt-3 ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {isRecording ? "Registrazione in corso... Clicca per fermare" : "Clicca per la registrazione vocale"}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {inputMode === "text" && (
                                <div className="mt-3 flex justify-end">
                                    <button 
                                        type="button"
                                        onClick={handleProcessAiText}
                                        disabled={aiLoading || !aiText.trim()}
                                        className="flex items-center gap-2 bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {aiLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <FaRobot /> 
                                        )}
                                        {aiLoading ? "Analizzando..." : "Analizza e Compila"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MANUAL FORM SECTION (Always visible, so user can edit AI results) */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Cliente Nome</label>
                                <input type="text" required className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm dark:text-white" placeholder="Es: Mario Rossi" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Telefono (Per Recensione)</label>
                                <div className="flex bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-shadow">
                                    <div className="flex items-center justify-center px-3 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-300 select-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" className="w-5 h-auto rounded-sm shrink-0 drop-shadow-sm border border-black/10 dark:border-white/10">
                                            <rect width="3" height="2" fill="#009246"/>
                                            <rect x="1" width="2" height="2" fill="#fff"/>
                                            <rect x="2" width="1" height="2" fill="#ce2b37"/>
                                        </svg>
                                        <span className="ml-2">+39</span>
                                    </div>
                                    <input 
                                        type="tel" 
                                        className="w-full bg-transparent p-2.5 text-sm dark:text-white focus:outline-none placeholder:text-gray-400" 
                                        placeholder="342 ..." 
                                        value={formData.customer_phone ? formData.customer_phone.replace(/^\+39\s*/, '') : ''} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^\d]/g, '');
                                            setFormData({...formData, customer_phone: val ? `+39 ${val}` : ''});
                                        }} 
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Data</label>
                                <input type="date" required className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm dark:text-white" value={formData.reservation_date} onChange={e => setFormData({...formData, reservation_date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Ora</label>
                                <input type="time" required className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm dark:text-white" value={formData.reservation_time} onChange={e => setFormData({...formData, reservation_time: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Servizio</label>
                                <select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm dark:text-white" value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value as "P" | "C"})}>
                                    <option value="P">Pranzo</option>
                                    <option value="C">Cena</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Coperti</label>
                                <input type="number" min="1" required className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm dark:text-white" value={formData.cover_count} onChange={e => setFormData({...formData, cover_count: parseInt(e.target.value)})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Allergie / Intolleranze</label>
                                <input type="text" className="w-full bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-2.5 text-sm dark:text-white" placeholder="Es: Celiaco, Lattosio..." value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Note Generali</label>
                                <input type="text" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm dark:text-white" placeholder="Tavolo vicino alla finestra..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Annulla</button>
                            <button type="submit" className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 shadow-xl">
                                Salva Prenotazione
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
