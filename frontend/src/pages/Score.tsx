import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { getResults } from '../services/api';
import { ResultsResponse } from '../types/requests';

// Feedback estático por dimensión (puede venir del backend más adelante)
const feedbackMap: Record<string, string> = {
  vocabulary: 'Practica ampliar tu variedad de palabras y evita repeticiones frecuentes.',
  clarity: 'Tu claridad mejora evitando muletillas y articulando cada sílaba.',
  rhythm: 'Mantén un ritmo constante; evita acelerarte o hacer pausas muy largas.',
  overall: 'Buen progreso general; enfócate en balancear ritmo y vocabulario.',
};

export default function ScorePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<Array<{ name: string; value: number; feedback?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const updateMetrics = useCallback((results: ResultsResponse) => {
    const lower = (s: string) => s.toLowerCase();
    const dims = results.dimensions || [];

    const normalized = dims.map(d => ({
      name: lower(d.name),
      value: Math.round(d.score),
      feedback: d.feedback
    }));

    const findValue = (aliases: string[]) => {
      const hit = normalized.find(d => aliases.some(a => d.name.includes(a)));
      return hit ? hit.value : 0;
    };

    const vocabulary = findValue(['vocabulary','vocabulario']);
    const clarity = findValue(['clarity','claridad']);
    const rhythm = findValue(['rhythm','ritmo']);
    let overall = findValue(['overall','general']);
    if (!overall) {
      const present = [vocabulary, clarity, rhythm].filter(v => v > 0);
      overall = present.length ? Math.round(present.reduce((a,b)=>a+b,0)/present.length) : 0;
    }

    const derived: Array<{ name:string; value:number; feedback?:string }> = [];
    if (overall) derived.push({ name:'overall', value: overall, feedback: feedbackMap.overall });
    if (vocabulary) derived.push({ name:'vocabulary', value: vocabulary, feedback: feedbackMap.vocabulary });
    if (clarity) derived.push({ name:'clarity', value: clarity, feedback: feedbackMap.clarity });
    if (rhythm) derived.push({ name:'rhythm', value: rhythm, feedback: feedbackMap.rhythm });

    const baseNames = derived.map(d => d.name);
    normalized.forEach(d => {
      if (!baseNames.includes(d.name)) {
        derived.push(d);
      }
    });

    setDimensions(derived);
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchAndProcess = async () => {
      try {
        const fetched = await getResults();
        updateMetrics(fetched);
      } catch (err) {
        console.error('Error obteniendo métricas:', err);
        setError((err as Error).message);
        setLoading(false);
      }
    };
    fetchAndProcess();
  }, [updateMetrics]);

  // (Placeholder) Si en el futuro se reciben análisis textuales separados
  // se puede implementar aquí sin afectar la lógica de métricas.
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

  const getDim = (name: string) => dimensions.find(d => d.name === name)?.value || 0;
  const radarData = [
    { dimension: 'Vocabulario', value: getDim('vocabulary'), fullMark: 100 },
    { dimension: 'Ritmo', value: getDim('rhythm'), fullMark: 100 },
    { dimension: 'Claridad', value: getDim('clarity'), fullMark: 100 },
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
            <p className="text-base text-gray-600">Prueba completada exitosamente</p>
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
                  {getDim('overall') || 0}
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
                <p className="text-3xl text-gray-900 mb-1">
                  <span className="font-bold">{getDim('vocabulary')}</span>
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
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-48 mt-1">
                      <p className="leading-relaxed">Variedad y riqueza de las palabras usadas.</p>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl text-gray-900 mb-1">
                  <span className="font-bold">{getDim('rhythm')}</span>
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
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-48 mt-1">
                      <p className="leading-relaxed">Patrón de velocidad y cadencia al hablar, relacionado con la fluidez.</p>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl text-gray-900 mb-1">
                  <span className="font-bold">{getDim('clarity')}</span>
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
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-48 mt-1">
                      <p className="leading-relaxed">Qué tan fácil es entender lo que dices.</p>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback por dimensión */}
          {dimensions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Feedback por Dimensión
              </h2>
              {dimensions.filter(d => ['overall','vocabulary','clarity','rhythm'].includes(d.name)).map(d => (
                <div key={d.name} className="bg-white rounded-2xl p-6 mb-4 border border-gray-200">
                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-indigo-500 uppercase tracking-wide">
                      {d.name}
                    </h3>
                  </div>
                  {d.feedback && (
                    <p className="text-gray-700 leading-relaxed text-sm">
                      {d.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-indigo-500 text-white py-4 rounded-xl font-semibold hover:bg-indigo-600"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}