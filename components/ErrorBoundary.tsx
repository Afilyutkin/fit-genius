import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Language } from '../types';

interface Props {
  language: Language;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, any render error (usually a malformed AI plan) leaves the user
 * with a blank white page and no way out.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Fit Genius] Render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleHardReset = () => {
    localStorage.removeItem('zenith_user_profile');
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isRu = this.props.language === 'ru';

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="panel max-w-lg w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-500 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={26} />
          </div>
          <h2 className="font-display text-2xl font-semibold uppercase text-slate-900 dark:text-white mb-2">
            {isRu ? 'Что-то пошло не так' : 'Something went wrong'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {isRu
              ? 'Экран не удалось отобразить. Попробуйте снова, данные сохранены.'
              : 'This screen failed to render. Try again, your data is still saved.'}
          </p>
          <pre className="surface-muted rounded-xl p-3 text-[11px] text-left text-slate-500 dark:text-slate-400 overflow-x-auto mb-6">
            {error.message}
          </pre>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={this.handleReset} className="btn-primary">
              <RefreshCw size={16} />
              {isRu ? 'Попробовать снова' : 'Try again'}
            </button>
            <button onClick={this.handleHardReset} className="btn-secondary">
              {isRu ? 'Сбросить сохранённый план' : 'Reset saved plan'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
