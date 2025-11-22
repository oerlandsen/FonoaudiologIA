import type { Language } from '../types/audio';

interface LanguageSelectorProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({ language, onLanguageChange, disabled }: LanguageSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium text-gray-700">
        Language / Idioma:
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onLanguageChange('en')}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            language === 'en'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('es')}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            language === 'es'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Español
        </button>
      </div>
    </div>
  );
}

