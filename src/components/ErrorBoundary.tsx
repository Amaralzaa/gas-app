import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare state: State;
  declare props: Props;
  declare setState: (state: Partial<State> | ((prevState: State) => Partial<State>)) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro não tratado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 select-none">
          <div className="bg-slate-800 border border-slate-700 max-w-md w-full p-8 rounded-3xl shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-black mb-2 text-white">Ops! Algo deu errado</h1>
            <p className="text-slate-400 text-sm mb-6">
              Ocorreu uma instabilidade temporária no aplicativo. Toque abaixo para recarregar a tela.
            </p>

            {this.state.error?.message && (
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 mb-6 text-left overflow-auto max-h-32">
                <p className="text-[11px] font-mono text-red-300 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-slate-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
              <span>RECARREGAR APLICATIVO</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
