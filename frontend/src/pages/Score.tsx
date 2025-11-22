import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, TrendingUp, Volume2, Clock, Target } from 'lucide-react';

interface Metric {
  name: string;
  score: number;
  icon: string;
}

interface ScoreData {
  overallScore: number;
  metrics: Metric[];
  feedback: string;
}

export default function ScorePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyzeExercises = async () => {
      try {
        const exerciseResults = JSON.parse(sessionStorage.getItem('exerciseResults') || '[]');

        if (exerciseResults.length !== 3) {
          setError('Incomplete test data');
          setLoading(false);
          return;
        }

        // Simulate API call for now - replace with actual API when ready
        setTimeout(() => {
          const mockScores: ScoreData = {
            overallScore: 85,
            metrics: [
              { name: 'Clarity', score: 88, icon: 'clarity' },
              { name: 'Fluency', score: 82, icon: 'fluency' },
              { name: 'Pace', score: 87, icon: 'pace' },
              { name: 'Accuracy', score: 84, icon: 'accuracy' },
            ],
            feedback:
              'Tu pronunciación es buena, pero puedes mejorar la fluidez en frases más largas.',
          };
          setScores(mockScores);
          sessionStorage.removeItem('exerciseResults');
          setLoading(false);
        }, 2000);
      } catch (err) {
        console.error('Error analyzing exercises:', err);
        setError((err as Error).message);
        setLoading(false);
      }
    };

    analyzeExercises();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Tus Resultados
            </h1>
            <p className="text-base text-gray-600">Prueba completada exitosamente</p>
          </div>

          {/* Overall Score Card */}
          <div className="mb-6">
            <div className="bg-indigo-500 rounded-2xl p-8 text-center shadow-lg">
              <p className="text-base text-white/90 mb-2">Puntaje General</p>
              <p className="text-6xl font-bold text-white mb-2">
                {scores?.overallScore || 0}
              </p>
              <p className="text-lg text-white/90">de 100</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Métricas de Desempeño
            </h3>

            {scores?.metrics &&
              scores.metrics.map((metric, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-5 mb-3 flex items-center border border-gray-200"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mr-4">
                    {metric.icon === 'clarity' && (
                      <Volume2 className="text-indigo-500" size={24} />
                    )}
                    {metric.icon === 'fluency' && (
                      <TrendingUp className="text-indigo-500" size={24} />
                    )}
                    {metric.icon === 'pace' && (
                      <Clock className="text-indigo-500" size={24} />
                    )}
                    {metric.icon === 'accuracy' && (
                      <Target className="text-indigo-500" size={24} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-gray-900 mb-1">
                      {metric.name}
                    </p>
                    <div className="flex items-center">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full mr-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getScoreBgColor(metric.score)}`}
                          style={{ width: `${metric.score}%` }}
                        />
                      </div>
                      <span className={`text-base font-semibold ${getScoreColor(metric.score)}`}>
                        {metric.score}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Feedback */}
          {scores?.feedback && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Feedback
              </h3>
              <div className="bg-white rounded-2xl p-5 border border-gray-200">
                <p className="text-sm text-gray-700 leading-6">
                  {scores.feedback}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
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