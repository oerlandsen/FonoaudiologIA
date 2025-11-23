interface SpeechRateIndicatorProps {
  wordsPerMinute: number;
  isActive: boolean;
}

export default function SpeechRateIndicator({ wordsPerMinute, isActive }: SpeechRateIndicatorProps) {
  // Parámetros según parameters.json
  const MIN_WPM = 30;
  const MAX_WPM = 300;
  const IDEAL_MIN = 120;
  const IDEAL_MAX = 160;
  const IDEAL_CENTER = (IDEAL_MIN + IDEAL_MAX) / 2; // 140 WPM

  // Calcular la posición del indicador (0-100%)
  const getPosition = () => {
    // Si no hay medición aún, mostrar en el centro óptimo
    const wpm = wordsPerMinute > 0 ? wordsPerMinute : IDEAL_CENTER;
    
    if (wpm <= MIN_WPM) return 0;
    if (wpm >= MAX_WPM) return 100;
    return ((wpm - MIN_WPM) / (MAX_WPM - MIN_WPM)) * 100;
  };

  // Determinar el color según el rango
  const getColor = () => {
    if (wordsPerMinute >= IDEAL_MIN && wordsPerMinute <= IDEAL_MAX) {
      return 'bg-green-500';
    } else if (wordsPerMinute < IDEAL_MIN - 30 || wordsPerMinute > IDEAL_MAX + 40) {
      return 'bg-red-500';
    } else {
      return 'bg-yellow-500';
    }
  };

  // Obtener el texto de sugerencia
  const getLabel = () => {
    if (wordsPerMinute < IDEAL_MIN - 20) {
      return 'Muy lento';
    } else if (wordsPerMinute < IDEAL_MIN) {
      return 'Un poco lento';
    } else if (wordsPerMinute >= IDEAL_MIN && wordsPerMinute <= IDEAL_MAX) {
      return 'Ritmo ideal';
    } else if (wordsPerMinute <= IDEAL_MAX + 20) {
      return 'Un poco rápido';
    } else {
      return 'Muy rápido';
    }
  };

  if (!isActive) return null;

  const position = getPosition();
  const color = getColor();
  const label = getLabel();

  return (
    <div className="w-full bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold text-gray-800">Velocidad de habla</span>
        <span className={`text-sm font-bold ${
          color === 'bg-green-500' ? 'text-green-600' :
          color === 'bg-yellow-500' ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {label}
        </span>
      </div>

      <div className="relative h-10 rounded-lg overflow-hidden" style={{
        background: 'linear-gradient(to right, rgba(239, 68, 68, 0.5) 0%, rgba(245, 158, 11, 0.5) 25%, rgba(34, 197, 94, 0.6) 40%, rgba(34, 197, 94, 0.6) 60%, rgba(245, 158, 11, 0.5) 75%, rgba(239, 68, 68, 0.5) 100%)'
      }}>
        <div
          className="absolute top-0 h-full transition-all duration-500 ease-out"
          style={{ left: `calc(${position}% - 2px)` }}
        >
          {/* Línea vertical */}
          <div className="w-1 h-full bg-gray-900 opacity-80" />
          {/* Punto superior */}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 rounded-full border-2 border-white shadow-lg" />
          {/* Punto inferior */}
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 rounded-full border-2 border-white shadow-lg" />
        </div>
      </div>

      {/* Valores numéricos y rangos */}
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-gray-500">{MIN_WPM} ppm</span>
        <span className="text-xs font-semibold text-green-600">{IDEAL_MIN}-{IDEAL_MAX} ppm</span>
        <span className="text-xs text-gray-500">{MAX_WPM} ppm</span>
      </div>

      {/* Valor actual centrado */}
      {wordsPerMinute > 0 ? (
        <div className="text-center mt-3 text-base text-gray-700">
          <span className="font-bold text-lg">{Math.round(wordsPerMinute)}</span>
          <span className="text-sm ml-1">palabras por minuto</span>
        </div>
      ) : (
        <div className="text-center mt-3 text-sm text-gray-400 italic">
          Esperando que comiences a hablar...
        </div>
      )}
    </div>
  );
}