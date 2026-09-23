import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ModuleBlockedPage } from './ModuleBlockedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  moduleCode?: string; // Opcional: se fornecido, verifica permissão do módulo
  moduleName?: string; // Nome amigável do módulo para exibição
  subPermissionKey?: string; // Novo: sub-permissão opcional para verificar
}

export function ProtectedRoute({ children, moduleCode, moduleName, subPermissionKey }: ProtectedRouteProps) {
  const { professional, hasModuleAccess, hasPermission, permissions, permissionsLoaded, isLoading } = useAuth();

  // Aguardar carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não está autenticado, redirecionar para login
  if (!professional) {
    return <Navigate to="/entrar" replace />;
  }

  // Se um módulo foi especificado, verificar permissão
  if (moduleCode) {
    // Aguardar permissões serem carregadas
    if (!permissionsLoaded) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }

    // Verificar se tem acesso ao módulo
    if (!hasModuleAccess(moduleCode)) {
      const permission = permissions.find((item) => item.moduleCode === moduleCode);
      return (
        <ModuleBlockedPage
          moduleName={moduleName || moduleCode}
          reason={permission?.blockedByPlan ? 'plan' : 'permission'}
        />
      );
    }

    // Verificar sub-permissão se informada
    if (subPermissionKey && !hasPermission(moduleCode, subPermissionKey)) {
      return (
        <ModuleBlockedPage
          moduleName={`${moduleName || moduleCode} (Acesso Restrito)`}
          reason="permission"
        />
      );
    }
  }

  return <>{children}</>;
}
