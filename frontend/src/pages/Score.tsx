import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ChevronDown } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { getResults } from '../services/api';
import { ResultsResponse } from '../types/requests';


// Tipos extendidos para soportar métricas detalladas desde el backend
type MetricScore = {
  raw?: number;
  score?: number;
};

const METRIC_LABELS: Record<string, string> = {
  precision_transcription: 'Precisión',
  words_per_minute: 'Palabras por minuto',
  filler_word_per_minute: 'Muletillas por minuto',
  lexical_variability: 'Variabilidad léxica',
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  precision_transcription:
    'Proporción de palabras correctamente mencionadas.',
  words_per_minute:
    'Puntaje según cercanía a rango óptimo.',
  filler_word_per_minute:
    'Puntaje según cercanía a rango óptimo.',
  lexical_variability:
    'Puntaje según uso de diferentes palabras.',
};

export default function ScorePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<Array<{ name: string; value: number; feedback?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [metricDetails, setMetricDetails] = useState<Array<{ name: string; label: string; value: number }>>([]);
  const [activeMetricTooltip, setActiveMetricTooltip] = useState<string | null>(null);

  const updateMetrics = useCallback((results: ResultsResponse) => {
    const lower = (s: string) => s.toLowerCase();
    const dims = results.dimensions || [];

    // Mapear dimensiones con su feedback real del backend
    const normalized = dims.map(d => ({
      name: lower(d.name),
      value: Math.round(d.score),
      feedback: d.feedback
    }));

    // Usar las dimensiones tal cual vienen del backend, con su feedback incluido
    setDimensions(normalized);

    // Extraer métricas de dentro de cada dimensión
    const allMetrics: Record<string, MetricScore> = {};
    
    dims.forEach(dim => {
      if (dim.metrics) {
        Object.entries(dim.metrics).forEach(([key, value]) => {
          allMetrics[key] = value as MetricScore;
        });
      }
    });

    const metricKeys = [
      'precision_transcription',
      'words_per_minute',
      'filler_word_per_minute',
      'lexical_variability',
    ];

    const metricsArray: Array<{ name: string; label: string; value: number }> = metricKeys
      .map((key) => {
        const metric = allMetrics[key];
        if (!metric) return null;
        const score = typeof metric.score === 'number' ? Math.round(metric.score) : 0;
        return {
          name: key,
          label: METRIC_LABELS[key] || key,
          value: score,
        };
      })
      .filter((m): m is { name: string; label: string; value: number } => m !== null);

    setMetricDetails(metricsArray);

    setLoading(false);
  }, []);

  // Conectar con el backend para obtener resultados
  useEffect(() => {
    const fetchAndProcess = async () => {
      try {
        const sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
          throw new Error('No hay sesión activa. Por favor inicia un nuevo ejercicio.');
        }
        
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

  const getDim = (name: string) => {
    const dim = dimensions.find(d => d.name.toLowerCase() === name.toLowerCase());
    return dim ? dim.value : 0;
  };
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

          {/* Radar 
           */}
          <div
            className="bg-white rounded-2xl p-6 mb-6 border border-gray-200 cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setShowDetails(prev => !prev)}
          >
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

            {/* Tabla desplegable de métricas (barras de progreso) */}
            {metricDetails.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Detalle de métricas
                  </p>
                  <ChevronDown
                    size={18}
                    className={`text-gray-500 transition-transform ${
                      showDetails ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>

                {showDetails && (
                  <div className="space-y-3">
                    {metricDetails.map((metric) => {
                      const safeValue = Math.max(0, Math.min(100, metric.value || 0));

                      // Reference values per metric (in %)
                      let referenceValue: number;
                      if (metric.name === 'precision_transcription') {
                        referenceValue = 97;
                      } else if (metric.name === 'words_per_minute') {
                        referenceValue = 100;
                      } else if (metric.name === 'filler_word_per_minute') {
                        referenceValue = 78.57;
                      } else if (metric.name === 'lexical_variability') {
                        referenceValue = 100;
                      } else {
                        referenceValue = 90; // fallback
                      }

                      const clampedValue = Math.max(0, Math.min(100, safeValue));
                      const currentWidth = Math.min(clampedValue, referenceValue);

                      const colorClass =
                        metric.name === 'precision_transcription'
                          ? 'bg-indigo-500'
                          : metric.name === 'words_per_minute'
                          ? 'bg-orange-500'
                          : metric.name === 'filler_word_per_minute'
                          ? 'bg-teal-500'
                          : metric.name === 'lexical_variability'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500';

                      return (
                        <div key={metric.name}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <div className="flex items-center gap-1 relative">
                              <span className="font-medium text-gray-700">
                                {metric.label}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMetricTooltip(
                                    activeMetricTooltip === metric.name ? null : metric.name
                                  );
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Info size={12} />
                              </button>
                              {activeMetricTooltip === metric.name && (
                                <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10 w-56 mt-1">
                                  <p className="leading-relaxed">
                                    {METRIC_DESCRIPTIONS[metric.name] || ''}
                                  </p>
                                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                                </div>
                              )}
                            </div>
                            <span className="text-gray-500">{clampedValue}%</span>
                          </div>

                          {/* Barra única + marca de referencia y logo alineado al referenceValue */}
                          <div className="relative w-full h-8">
                            {/* Barra de fondo y referencia */}
                            <div
                              className="absolute top-0 left-0 right-0 h-2 rounded-full bg-gray-100 overflow-hidden"
                              aria-label={`Barra de progreso, valor actual ${clampedValue}%, referencia ${referenceValue}%`}
                            >
                              {/* Tramo de referencia: 0–referenceValue% */}
                              <div
                                className="absolute inset-y-0 left-0 bg-gray-400/50"
                                style={{ width: `${referenceValue}%` }}
                              />
                              {/* Tramo de valor actual encima: 0–min(valor, referenceValue) */}
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full ${colorClass}`}
                                style={{ width: `${currentWidth}%` }}
                              />

                              {/* Línea vertical roja en el punto de referencia */}
                              <div
                                className="absolute top-0 h-2 w-[2px] bg-red-500 -translate-x-1/2"
                                style={{ left: `${referenceValue}%` }}
                              />
                            </div>

                            {/* Logo alineado horizontalmente con el referenceValue y justo debajo de la barra */}
                            <div
                              className="absolute top-4 -translate-x-[-80%]"
                              style={{ left: `${referenceValue-15}%` }}
                            >
                              <img
                                src="/images/ted_logo.png"
                                alt="TED"
                                className="h-3 w-auto opacity-80"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feedback por dimensión */}
          {dimensions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Feedback por Dimensión
              </h2>
              {dimensions.map(d => (
                <div key={d.name} className="bg-white rounded-2xl p-6 mb-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-indigo-500 uppercase tracking-wide">
                      {d.name === 'overall' ? 'General' :
                       d.name === 'vocabulary' ? 'Vocabulario' :
                       d.name === 'clarity' ? 'Claridad' :
                       d.name === 'rhythm' ? 'Ritmo' : d.name}
                    </h3>
                    <span className="text-2xl font-bold text-gray-900">{d.value}%</span>
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