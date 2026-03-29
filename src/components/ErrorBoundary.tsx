import * as React from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg p-6">
          <div className="max-w-md w-full bg-white border border-line p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-serif italic mb-4 text-ink">出错了</h2>
            <p className="text-ink/70 mb-6">
              抱歉，应用程序遇到了一个意外错误。这可能是由于配置问题或网络连接中断引起的。
            </p>
            <div className="bg-red-50 p-4 rounded border border-red-100 mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-600">{this.state.error?.message}</code>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-ink text-bg rounded hover:bg-ink/90 transition-colors"
            >
              重新加载页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
