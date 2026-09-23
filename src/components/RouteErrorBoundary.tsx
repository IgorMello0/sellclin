import React from 'react';
import { Button } from '@/components/ui/button';

type RouteErrorBoundaryProps = {
  children: React.ReactNode;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[RouteErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full flex items-center justify-center py-16">
          <div className="max-w-md text-center space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Nao foi possivel abrir esta tela</h2>
              <p className="mt-1 text-sm text-slate-500">
                Recarregue a pagina ou volte ao dashboard para continuar usando o sistema.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
              <Button onClick={() => { window.location.href = '/painel'; }}>
                Ir para dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
