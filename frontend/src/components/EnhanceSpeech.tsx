import { useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, ArrowLeft } from 'lucide-react';
import { createAudioUrl, revokeAudioUrl } from '../utils/audioUtils';
import { AudioPlayer } from './AudioPlayer';
import type { AudioRecording } from '../types/audio';
import fillerWordsJson from '../utils/filler_words.json';

/**
 * EnhanceSpeech
 * - Frontend-only chained agents pipeline (STT -> Cleaner -> TTS)
 * - Uses client-side fetch to call ElevenLabs (STT/TTS) and OpenAI (cleaner)
 * - Requires environment variables: VITE_OPENAI_API_KEY and VITE_ELEVENLABS_API_KEY
 *
 * IMPORTANT: Exposing API keys in frontend is insecure for production.
 * Recommended: move these calls to a backend for real deployments.
 */
export function EnhanceSpeech() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [_transcript, setTranscript] = useState<string>('');
  const [_cleanedText, setCleanedText] = useState<string>('');
  const [enhancedAudioUrl, setEnhancedAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoPlayEnhanced, setAutoPlayEnhanced] = useState(true);
  const [includeFeedbackAudio, setIncludeFeedbackAudio] = useState(false);
  

  const voiceId = '2EiwWnXFnvU5JabPnv8n';
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackAudioUrl, setFeedbackAudioUrl] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<'original' | 'enhanced' | 'feedback'>('original');
  
  const [, setFeedbackPlayed] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const ELEVEN_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const handleRecordingComplete = (r: AudioRecording) => {
    setRecording(r);
    setTranscript('');
    setCleanedText('');
    setEnhancedAudioUrl(null);
  };

  // useAudioRecorder hook for central recorder control
  const {
    isRecording,
    duration: recorderDuration,
    startRecording,
    stopRecording
  } = useAudioRecorder();

  async function handleCentralToggle() {
    setError(null);
    try {
      if (!isRecording) {
        await startRecording();
        setStatus('Grabando');
        return;
      }

      // stop recording and set as current reference
      const blob = await stopRecording();
      if (blob) {
        const url = createAudioUrl(blob);
        const rec: AudioRecording = {
          id: `recording-${Date.now()}`,
          blob,
          url,
          duration: recorderDuration || 0,
          timestamp: new Date(),
          mimeType: blob.type || 'audio/webm'
        };
        // replace any previous recording
        if (recording?.url) revokeAudioUrl(recording.url);
        setRecording(rec);
        setTranscript('');
        setCleanedText('');
        setEnhancedAudioUrl(null);
        setStatus('Grabación lista');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function humanDuration(sec: number) {
    if (!sec || !isFinite(sec)) return '00:00';
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Agent 1: Speech-to-text using ElevenLabs (frontend fetch)
  async function transcribeWithElevenLabs(blob: Blob) {
    if (!ELEVEN_KEY) throw new Error('VITE_ELEVENLABS_API_KEY not configured');

    const fd = new FormData();
    fd.append('file', blob, 'audio.webm');
    fd.append('model_id', 'scribe_v1');

    const resp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVEN_KEY } as Record<string, string>,
      body: fd,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`ElevenLabs STT failed: ${resp.status} ${resp.statusText} ${text}`);
    }

    const data = await resp.json();
    return data.transcript || data.text || data.result || JSON.stringify(data);
  }

  // Agent 2: Cleaner using OpenAI Chat API
  async function cleanWithOpenAI(originalText: string) {
    if (!OPENAI_KEY) throw new Error('VITE_OPENAI_API_KEY not configured');

    const typedFiller = (fillerWordsJson as unknown as { filler_words?: string[] });
    const fillerList = Array.isArray(typedFiller.filler_words) ? typedFiller.filler_words : [];

    const systemPrompt = `Eres un asistente que reestructura un texto hablado para hacerlo más legible y claro. ` +
      `Reglas importantes:\n` +
      `- Conserva TODAS las palabras relevantes del hablante en el mismo orden relativo (no inventes contenido).\n` +
      `- Elimina o reduce muletillas, interjecciones y pausas excesivas sin eliminar el significado.\n` +
      `- No agregues modismos, regionalismos ni cambies el registro (mantén tono neutro).\n` +
      `- Si hay frases fragmentadas por pausas, júntalas para que suenen naturales.\n` +
      `- Si algo es incomprensible, marca con [INAUDIBLE] pero no inventes palabras.\n` +
      `Muletillas conocidas (ejemplos, elimínalas o reduce su presencia): ${fillerList.slice(0,50).join(', ')} ... y más.`;

    const userPrompt = `Texto original:\n${originalText}\n\nDevuélveme únicamente la versión "limpia" respetando las reglas.`;

    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1200
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`OpenAI request failed: ${resp.status} ${resp.statusText} ${errText}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || JSON.stringify(data);
    return content;
  }

  // Agent 3: TTS using ElevenLabs
  async function synthesizeWithElevenLabs(text: string) {
    if (!ELEVEN_KEY) throw new Error('VITE_ELEVENLABS_API_KEY not configured');

    const voice = voiceId;

    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_KEY
      } as Record<string, string>,
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      let bodyText = '';
      try {
        const j = await resp.json();
        bodyText = JSON.stringify(j);
      } catch (e) {
        bodyText = await resp.text().catch(() => '');
      }

      if (resp.status === 401) {
        if (bodyText.includes('missing_permissions') || bodyText.includes('text_to_speech')) {
          throw new Error(
            `ElevenLabs TTS 401: falta permiso 'text_to_speech' en la API key. Crea o actualiza una API key en ElevenLabs con permiso de Text-to-Speech. Detalle: ${bodyText}`
          );
        }
        throw new Error(`ElevenLabs TTS unauthorized (401). Revisa tu API key. Detalle: ${bodyText}`);
      }

      if (resp.status === 404 && bodyText.includes('voice_not_found')) {
        throw new Error(
          `ElevenLabs TTS 404: voice not found (${voice}). Usa un voice_id válido o ajusta el predeterminado en la aplicación. Detalle: ${bodyText}`
        );
      }

      const txt = await resp.text().catch(() => '');
      throw new Error(`ElevenLabs TTS failed: ${resp.status} ${resp.statusText} ${txt || bodyText}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }

  function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }

  function analyzeFillers(text: string, fillers: string[]) {
    const lower = text.toLowerCase();
    const counts: Record<string, number> = {};
    let total = 0;
    for (const f of fillers) {
      try {
        const re = new RegExp('\\b' + escapeRegex(f.toLowerCase()) + '\\b', 'gi');
        const m = lower.match(re);
        const c = m ? m.length : 0;
        if (c > 0) {
          counts[f] = c;
          total += c;
        }
      } catch (e) {
        // skip
      }
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, counts, top };
  }

  async function generateFeedback(originalText: string, cleaned: string) {
    if (!OPENAI_KEY) throw new Error('VITE_OPENAI_API_KEY not configured');

    const typedFiller = (fillerWordsJson as unknown as { filler_words?: string[] });
    const fillerList = Array.isArray(typedFiller.filler_words) ? typedFiller.filler_words : [];

    const analysis = analyzeFillers(originalText, fillerList);

    const systemPrompt = `Eres un asistente que genera feedback breve y accionable para mejorar el habla basándote en una transcripción original y su versión limpia.`;
    const userPrompt = `Transcripción original:\n${originalText}\n\nVersión limpia:\n${cleaned}\n\nAnálisis de muletillas: total=${analysis.total}, top=${analysis.top.map(t=>t.join(':')).join(', ')}.\n\nPor favor, responde en español con: 1) Un resumen muy breve, 1 frase en punteo de los puntos a mejorar; 2) Máximo 3 consejos concretos y accionables para reducir muletillas y pausas; 3) Si procede, una sugerencia de práctica (una oración). No inventes contenido.`;

    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`OpenAI feedback request failed: ${resp.status} ${resp.statusText} ${errText}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || JSON.stringify(data);
    return String(content);
  }

  async function handleRunPipeline() {
    setError(null);
    if (!recording) {
      setError('No hay audio para procesar. Graba o sube un archivo primero.');
      return;
    }

    setIsProcessing(true);
    setStatus('Optimizando con IA');

    try {
      let feedbackDelivered = false;
      // Agent 1
      const stt = await transcribeWithElevenLabs(recording.blob as Blob);
      setTranscript(String(stt));

      // Small pause to mimic processing time
      await new Promise((r) => setTimeout(r, 600));

      // Agent 2
      const cleaned = await cleanWithOpenAI(String(stt));
      setCleanedText(String(cleaned));

      // Agent 3: always synthesize enhanced audio (so it's immediately available)
      try {
        const audioUrl = await synthesizeWithElevenLabs(String(cleaned));
        setEnhancedAudioUrl(audioUrl);
        // If autoPlayEnhanced, play it immediately
        if (autoPlayEnhanced) {
          setActivePlayer('enhanced');
            setTimeout(() => {
              const a = new Audio(audioUrl);
              setPlayingUrl(audioUrl);
              a.play().catch(() => {});
              a.addEventListener('ended', () => {
                setPlayingUrl(null);
              });
            }, 400);
        }
      } catch (ttsErr) {
        console.warn('Enhanced TTS failed', ttsErr);
      }

      // If feedback requested, generate feedback text and (optionally) its audio
      if (includeFeedbackAudio) {
        try {
          const fb = await generateFeedback(String(stt), String(cleaned));
          setFeedbackText(fb);
          // synthesize feedback audio (use same voiceId)
          const fbAudio = await synthesizeWithElevenLabs(fb);
          setFeedbackAudioUrl(fbAudio);
          feedbackDelivered = true;
        } catch (fbErr) {
          console.warn('Feedback generation failed', fbErr);
          // show error but don't fail the whole pipeline
          setError(fbErr instanceof Error ? fbErr.message : String(fbErr));
        }
      }

      setStatus(feedbackDelivered ? 'Feedback entregado' : 'Optimización lista');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Volver al inicio"
              className="p-2 rounded-full text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Enhance Speech</h2>
          </div>
          <div className="text-sm text-gray-600">Estado: <strong>{status || '—'}</strong></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col items-center justify-center gap-4 min-w-0">
          <div className="relative">
            <button
              onClick={handleCentralToggle}
              aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
              className={`w-36 h-36 rounded-full flex items-center justify-center transition-transform border-4 ${isRecording ? 'border-red-200 bg-red-50 scale-95' : 'border-indigo-100 bg-indigo-50 hover:scale-105'}`}
            >
              <div className={`w-28 h-28 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-indigo-500'}`}>
                {isRecording ? (
                  <Square className="text-white" size={40} />
                ) : (
                  <Mic className="text-white" size={40} />
                )}
              </div>
            </button>

            <div className="mt-3 text-sm text-gray-600 text-center">
              {isRecording ? `Grabando • ${humanDuration(recorderDuration)}` : 'Toca para grabar'}
            </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <input
                id="hidden-audio-input"
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = createAudioUrl(f);
                  const rec: AudioRecording = {
                    id: `upload-${Date.now()}`,
                    blob: f,
                    url,
                    duration: 0,
                    timestamp: new Date(),
                    mimeType: f.type || 'audio/*'
                  };
                  handleRecordingComplete(rec);
                  // reset input
                  (e.target as HTMLInputElement).value = '';
                }}
              />
              <button
                type="button"
                onClick={() => document.getElementById('hidden-audio-input')?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 bg-white border border-indigo-100 rounded-full shadow-md hover:shadow-lg hover:bg-indigo-50 transform transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v11"/><path d="M8 5a4 4 0 008 0"/><path d="M19 11a7 7 0 01-14 0"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                <span>Subir audio</span>
              </button>
            </div>
          </div>

        <div className="space-y-4 min-w-0">

            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center justify-between w-full max-w-md">
                <span className="text-sm whitespace-nowrap mr-4">Reproducir revisión automáticamente</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoPlayEnhanced}
                  onClick={() => setAutoPlayEnhanced(!autoPlayEnhanced)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${autoPlayEnhanced ? 'bg-indigo-500' : 'bg-gray-300'}`}
                >
                  <span className="sr-only">Alternar reproducción automática</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoPlayEnhanced ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between w-full max-w-md">
                <span className="text-sm whitespace-nowrap mr-4">Incluir feedback</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeFeedbackAudio}
                  onClick={() => setIncludeFeedbackAudio(!includeFeedbackAudio)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${includeFeedbackAudio ? 'bg-indigo-500' : 'bg-gray-300'}`}
                >
                  <span className="sr-only">Alternar audio de feedback</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${includeFeedbackAudio ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>

            {/* Voice selection UI removed as requested */}

            <div className="w-full">
              <button
                onClick={handleRunPipeline}
                disabled={!recording || isProcessing}
                className="w-full px-5 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Solicitar revisión'}
              </button>
            </div>

            {/* Estado mostrado solo en el header superior */}
            {error && <div className="text-sm text-red-600">{error}</div>}

            {/* Unified player area: tabs for Original / Mejorado / Feedback */}
            <div className="mt-2 bg-white rounded-lg p-4 shadow-sm">
              <div className="flex justify-center mb-3">
                <div className="inline-flex items-center gap-1 rounded-full bg-indigo-50/70 border border-indigo-200/70 p-1 shadow-inner">
                  <button onClick={() => setActivePlayer('original')} className={`px-4 py-1.5 rounded-full text-sm ${activePlayer==='original' ? 'bg-indigo-500 text-white' : 'text-gray-700 hover:bg-indigo-100'}`}>Original</button>
                  <button onClick={() => setActivePlayer('enhanced')} disabled={!enhancedAudioUrl} className={`px-4 py-1.5 rounded-full text-sm ${activePlayer==='enhanced' ? 'bg-indigo-500 text-white' : 'text-gray-700 hover:bg-indigo-100'} ${!enhancedAudioUrl ? 'opacity-50 cursor-not-allowed' : ''}`}>Revisado</button>
                  <button onClick={() => setActivePlayer('feedback')} disabled={!feedbackText} className={`px-4 py-1.5 rounded-full text-sm ${activePlayer==='feedback' ? 'bg-indigo-500 text-white' : 'text-gray-700 hover:bg-indigo-100'} ${!feedbackText ? 'opacity-50 cursor-not-allowed' : ''}`}>Feedback</button>
                </div>
              </div>
              <div className="text-center text-sm text-gray-500 h-5">{playingUrl ? 'Reproduciendo...' : ''}</div>

              <div className="min-h-[6rem]">
                {activePlayer === 'original' && recording && (
                  <div>
                    <AudioPlayer audioUrl={recording.url} />
                  </div>
                )}

                {activePlayer === 'enhanced' && (
                  <div>
                    {!enhancedAudioUrl ? (
                      <div className="text-sm text-gray-400">Audio mejorado no disponible aún.</div>
                    ) : (
                      <AudioPlayer audioUrl={enhancedAudioUrl} />
                    )}
                  </div>
                )}

                {activePlayer === 'feedback' && (
                  <div className="flex flex-col items-start gap-2 w-full">
                    {!feedbackText && <div className="text-sm text-gray-400">No hay feedback aún.</div>}
                    {feedbackText && (
                      <div className="w-full">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{feedbackText}</div>
                        {feedbackAudioUrl && (
                          <div className="mt-2 w-full">
                            <audio
                              src={feedbackAudioUrl}
                              controls
                              className="w-full"
                              onPlay={() => setPlayingUrl(feedbackAudioUrl)}
                              onEnded={() => { setPlayingUrl(null); setFeedbackPlayed(true); }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Panel de versión revisada eliminado: contenido accesible solo vía pestañas */}
          </div>
        </div>
      </div>
        </div>
      </div>
      {/* keep these values referenced to avoid unused-variable lint warnings */}
      <div style={{ display: 'none' }} aria-hidden>
        {_transcript}
        {_cleanedText}
      </div>
    </div>
  );
}

export default EnhanceSpeech;
