import { useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, ArrowLeft, Share2, Headphones } from 'lucide-react';
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
  const [transcript, setTranscript] = useState<string>('');
  const [cleanedText, setCleanedText] = useState<string>('');
  const [enhancedAudioUrl, setEnhancedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voiceId = '2EiwWnXFnvU5JabPnv8n';

  const ELEVEN_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

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
        if (enhancedAudioUrl) revokeAudioUrl(enhancedAudioUrl);
        setRecording(rec);
        setTranscript('');
        setCleanedText('');
        setEnhancedAudioUrl(null);
        setStatus('Grabación lista');
        
        // Automatically trigger pipeline processing
        handleRunPipeline(rec);
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

  async function handleRunPipeline(recordingToProcess?: AudioRecording) {
    setError(null);
    const recToUse = recordingToProcess || recording;
    if (!recToUse) {
      setError('No hay audio para procesar. Graba primero.');
      return;
    }

    setIsProcessing(true);
    setStatus('Optimizando con IA');

    try {
      // Agent 1
      const stt = await transcribeWithElevenLabs(recToUse.blob as Blob);
      setTranscript(String(stt));

      // Small pause to mimic processing time
      await new Promise((r) => setTimeout(r, 600));

      // Agent 2
      const cleaned = await cleanWithOpenAI(String(stt));
      setCleanedText(String(cleaned));

      // Agent 3: synthesize enhanced audio
      try {
        const audioUrl = await synthesizeWithElevenLabs(String(cleaned));
        setEnhancedAudioUrl(audioUrl);
      } catch (ttsErr) {
        console.warn('Enhanced TTS failed', ttsErr);
      }

      setStatus('Optimización lista');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleShare() {
    if (!enhancedAudioUrl) return;

    try {
      // Fetch the blob from the URL
      const response = await fetch(enhancedAudioUrl);
      const blob = await response.blob();
      const file = new File([blob], 'audio-mejorado.mp3', { type: 'audio/mpeg' });

      // Try Web Share API first (mobile devices)
      if (navigator.share) {
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Audio mejorado',
              text: 'Escucha mi audio mejorado'
            });
            return;
          }
        } catch (shareErr) {
          // If canShare check fails or share fails, fall through to download
          console.log('Web Share API not available, using download fallback');
        }
      }

      // Fallback: Download the file
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audio-mejorado.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error sharing audio:', err);
      // Fallback to download if share fails
      if (err instanceof Error && err.name !== 'AbortError') {
        const response = await fetch(enhancedAudioUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audio-mejorado.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
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
            <h2 className="text-lg font-semibold text-gray-900">Depurar con IA ✨</h2>
          </div>
         
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col items-center justify-center gap-4 min-w-0">
          <button
            onClick={handleCentralToggle}
            aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
            className={`w-24 h-24 rounded-full flex items-center justify-center mt-6 mb-4 mx-auto shadow-lg transition-all ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-indigo-500 hover:bg-indigo-600'
            }`}
          >
            {isRecording ? (
              <Square className="text-white" size={36} fill="white" />
            ) : (
              <Mic className="text-white" size={36} />
            )}
          </button>

          <div className="text-sm text-gray-600 text-center">
            {isRecording ? `Grabando • ${humanDuration(recorderDuration)}` : transcript ? 'Toca para grabar otra vez' : 'Toca para grabar'}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
            {error && <div className="text-sm text-red-600">{error}</div>}

            {transcript && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Transcripción original:</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{transcript}</p>
              </div>
            )}

            {cleanedText && (
              <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                <h3 className="text-sm font-semibold text-indigo-700 mb-2">Versión mejorada:</h3>
                <p className="text-sm text-indigo-900 whitespace-pre-wrap">{cleanedText}</p>
              </div>
            )}

            {enhancedAudioUrl && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-indigo-700">Audio mejorado:</h3>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    aria-label="Compartir audio"
                  >
                    <Share2 size={16} />
                    <span>Compartir</span>
                  </button>
                </div>
                <AudioPlayer audioUrl={enhancedAudioUrl} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Steps Cards */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Pasos
        </h3>
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-5 flex items-center border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mr-4">
              <Mic className="text-indigo-500" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <span className="text-sm font-semibold text-gray-600 mr-2">
                  Paso 1
                </span>
                <span className="text-base font-semibold text-gray-900">
                  Graba
                </span>
              </div>
              <p className="text-sm text-gray-600">Graba tu audio</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 flex items-center border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mr-4">
              <Headphones className="text-indigo-500" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <span className="text-sm font-semibold text-gray-600 mr-2">
                  Paso 2
                </span>
                <span className="text-base font-semibold text-gray-900">
                  Lee y Escucha
                </span>
              </div>
              <p className="text-sm text-gray-600">Revisa la transcripción y escucha el audio mejorado</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 flex items-center border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mr-4">
              <Share2 className="text-indigo-500" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <span className="text-sm font-semibold text-gray-600 mr-2">
                  Paso 3
                </span>
                <span className="text-base font-semibold text-gray-900">
                  Comparte
                </span>
              </div>
              <p className="text-sm text-gray-600">Comparte tu audio mejorado</p>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

export default EnhanceSpeech;
