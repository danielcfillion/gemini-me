import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.info('[ErrorBoundary caught error]:', error?.message, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 dark:bg-stone-900 p-6 text-stone-900 dark:text-stone-100">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800/90 p-6 shadow-xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 font-serif">
              Gemini Me encountered an issue
            </h2>
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Your journal data is safely preserved. Tap reload below to restore your session.
            </p>
            {this.state.errorMessage && (
              <p className="mt-3 rounded-lg bg-stone-100 dark:bg-stone-900/60 p-2.5 text-[11px] font-mono text-stone-600 dark:text-stone-300 break-words text-left">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 dark:bg-stone-100 px-4 py-2.5 text-xs font-semibold text-white dark:text-stone-900 shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Gemini Me</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
