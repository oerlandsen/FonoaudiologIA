import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Info } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface ExerciseDetail {
  type: string;
  title: string;
  score: number;
  feedback: string;
  transcription: string;
}

interface ExerciseResult {
  type: string;
  [key: string]: unknown;
}

interface ScoreData {
  overallScore: number;
  vocabulary: number;
  rhythm: number;
  clarity: number;
  exercises: ExerciseDetail[];
}

export default function ScorePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    const analyzeExercises = async () => {
      try {
        const allExerciseResults = JSON.parse(sessionStorage.getItem('exerciseResults') || '[]');
        const exerciseResults = allExerciseResults.slice(-3) as ExerciseResult[];

        const hasReading = exerciseResults.some((ex: ExerciseResult) => ex.type === 'reading');
        const hasDescription = exerciseResults.some((ex: ExerciseResult) => ex.type === 'description');
        const hasQuestion = exerciseResults.some((ex: ExerciseResult) => ex.type === 'question');

        if (exerciseResults.length !== 3 || !hasReading || !hasDescription || !hasQuestion) {
          setError('Datos de prueba incompletos o incorrectos');
          setLoading(false);
          return;
        }

        // Simulate API call - replace with real API when ready
        setTimeout(() => {
          const mockScores: ScoreData = {
            overallScore: 75,
            vocabulary: 80,
            rhythm: 65,
            clarity: 80,
            exercises: [
              {
                type: 'reading',
                title: 'LECTURA',
                score: 75,
                feedback: 'Tu lectura fue clara y a buen ritmo. Se nota que comprendes el texto. Para mejorar, intenta mantener un tono más natural y evita las pausas muy largas entre palabras.',
                transcription: 'El veloz zorro marrón salta sobre el perro perezoso. Esta frase contiene muchas letras del alfabeto...'
              },
              {
                type: 'description',
                title: 'DESCRIPCIÓN',
                score: 72,
                feedback: 'Buena capacidad descriptiva y uso de vocabulario variado. Tu claridad al hablar es excelente. Trabaja en mantener un ritmo más constante durante descripciones largas.',
                transcription: 'Veo un paisaje con montañas hermosas en el fondo, un lago azul y varios árboles...'
              },
              {
                type: 'question',
                title: 'PREGUNTA',
                score: 78,
                feedback: 'Respuesta coherente y bien estructurada. Tu vocabulario es adecuado y la claridad es muy buena. Considera practicar con respuestas más largas para mejorar tu fluidez.',
                transcription: 'Mis objetivos son mejorar mi pronunciación y hablar con más confianza en público...'
              }
            ]
          };
          setScores(mockScores);
          sessionStorage.removeItem('exerciseResults');
          setLoading(false);
        }, 2000);
      } catch (err) {
        console.error('Error al analizar los ejercicios:', err);
        setError((err as Error).message);
        setLoading(false);
      }
    };

    analyzeExercises();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-base text-gray-600">Analizando tu forma de hablar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-500 mb-4">Error</h2>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-600"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // Preparar datos para el radar chart
  const radarData = [
    { dimension: 'Vocabulario', value: scores?.vocabulary || 0, fullMark: 100 },
    { dimension: 'Ritmo', value: scores?.rhythm || 0, fullMark: 100 },
    { dimension: 'Claridad', value: scores?.clarity || 0, fullMark: 100 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Tus Resultados
            </h1>
          </div>

          {/* Radar Chart Section */}
          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Overall Score */}
              <div className="flex-shrink-0 text-center">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Puntaje General
                </p>
                <p className="text-7xl font-bold text-indigo-500">
                  {scores?.overallScore || 0}
                </p>
              </div>

              {/* Radar Chart */}
              <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis 
                      dataKey="dimension" 
                      tick={{ fill: '#6B7280', fontSize: 14, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                    <Radar
                      name="Puntaje"
                      dataKey="value"
                      stroke="#6366F1"
                      fill="#6366F1"
                      fillOpacity={0.6}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-4xl text-gray-900 mb-1">
                  <span className="font-bold">{scores?.vocabulary || 0}</span>
                  <span className="font-normal text-xl align-bottom">%</span>
                </p>
                <div className="flex items-center justify-center gap-1 relative">
                  <p className="text-sm font-semibold text-gray-600">Vocabulario</p>
                  <button
                    onClick={() => setActiveTooltip(activeTooltip === 'vocabulary' ? null : 'vocabulary')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  {activeTooltip === 'vocabulary' && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-56 mt-1">
                      <p className="leading-relaxed">Variedad y riqueza de las palabras usadas: cuántos términos distintos empleas y cuán repetitivo es el lenguaje.</p>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-4xl text-gray-900 mb-1">
                  <span className="font-bold">{scores?.rhythm || 0}</span>
                  <span className="font-normal text-xl align-bottom">%</span>
                </p>
                <div className="flex items-center justify-center gap-1 relative">
                  <p className="text-sm font-semibold text-gray-600">Ritmo</p>
                  <button
                    onClick={() => setActiveTooltip(activeTooltip === 'rhythm' ? null : 'rhythm')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  {activeTooltip === 'rhythm' && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-56 mt-1">
                      <p className="leading-relaxed">Patrón de velocidad y cadencia al hablar, vinculado a la fluidez global e influido por la presencia de pausas y muletillas.</p>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-4xl text-gray-900 mb-1">
                  <span className="font-bold">{scores?.clarity || 0}</span>
                  <span className="font-normal text-xl align-bottom">%</span>
                </p>
                <div className="flex items-center justify-center gap-1 relative">
                  <p className="text-sm font-semibold text-gray-600">Claridad</p>
                  <button
                    onClick={() => setActiveTooltip(activeTooltip === 'clarity' ? null : 'clarity')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  {activeTooltip === 'clarity' && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-56 mt-1">
                      <p className="leading-relaxed">Qué tan fácil es entender lo que dices: si las palabras se escuchan nítidas, sin errores importantes y con ideas bien articuladas.</p>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Feedback */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Feedback Detallado
            </h2>

            {scores?.exercises && scores.exercises.map((exercise, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 mb-4 border border-gray-200">
                {/* Exercise Header */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-indigo-500 uppercase tracking-wide">
                    {exercise.title}
                  </h3>
                </div>

                {/* Feedback */}
                <p className="text-gray-700 leading-relaxed mb-4">
                  {exercise.feedback}
                </p>

                {/* Transcription */}
                <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-indigo-500">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Transcripción
                  </p>
                  <p className="text-sm text-gray-600 italic">
                    "{exercise.transcription}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-indigo-500 text-white py-4 rounded-xl font-semibold hover:bg-indigo-600 flex items-center justify-center"
          >
            <Home className="mr-2" size={20} />
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}