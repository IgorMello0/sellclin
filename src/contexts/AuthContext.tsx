import React, { createContext, useContext, useState, useEffect } from 'react';
import { professionalsApi, permissionsApi, usuariosApi, authApi, type ModulePermission } from '@/lib/api';
import { canAccessHiddenDevelopmentPages, isHiddenDevelopmentModule } from '@/lib/internalAccess';

interface CompanyAccess {
  id: number;
  name: string;
  role?: string;
}

interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  role?: string;
  photoUrl?: string;
  companyId?: number;
  companyName?: string;
  companies?: CompanyAccess[];
  onboardingCompleted?: boolean;
}

type Permission = ModulePermission;

interface AuthContextType {
  professional: Professional | null;
  permissions: Permission[];
  permissionsLoaded: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  signup: (data: Omit<Professional, 'id'> & { password: string }) => Promise<{ success: boolean; error?: string; requiresEmailVerification?: boolean; email?: string }>;
  hasModuleAccess: (moduleCode: string) => boolean;
  hasPermission: (moduleCode: string, permissionKey: string) => boolean;
  isLoading: boolean;
  loadPermissions: () => Promise<void>;
  updateProfileData: (data: Partial<Professional>) => void;
  switchCompany: (companyId: number) => void;
  completeOnboarding: (data: any) => Promise<{success?: boolean}>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar permissões do usuário logado
  const loadPermissions = async () => {
    setPermissionsLoaded(false);
    try {
      const response = await permissionsApi.getMyPermissions();
      if (response.success && response.data) {
        setPermissions(Array.isArray(response.data) ? response.data : []);
        console.log('[Auth] Permissions loaded:', response.data);
      }
    } catch (error) {
      console.error('[Auth] Error loading permissions:', error);
    } finally {
      setPermissionsLoaded(true);
    }
  };

  // Carregar dados atualizados do profissional (incluindo foto)
  const loadProfessionalProfile = async () => {
    try {
      const type = localStorage.getItem('userType');
      if (type === 'professional') {
        const response = await professionalsApi.getMe();
        if (response.success && response.data) {
          const d = response.data;
          
          if (d.token) {
            localStorage.setItem('token', d.token);
          }
          
          setProfessional(prev => {
            if (!prev) return prev;
            const activeCompanyId = Number(localStorage.getItem('activeCompanyId')) || d.company?.id || d.companyId || prev.companyId;
            const activeCompany = (d.companies || prev.companies)?.find((c: any) => c.id === activeCompanyId);
            const updated = {
              ...prev,
              name: d.name,
              phone: d.phone || '',
              specialization: d.specialization || '',
              photoUrl: d.photoUrl || undefined,
              companyId: activeCompanyId,
              companyName: activeCompany?.name || d.company?.name || prev.companyName,
              companies: d.companies || prev.companies,
            };
            // Evitar QuotaExceededError limpando base64 do localStorage
            const storageUpdated = { ...updated };
            if (storageUpdated.photoUrl && storageUpdated.photoUrl.startsWith('data:')) {
              storageUpdated.photoUrl = undefined;
            }
            localStorage.setItem('professional', JSON.stringify(storageUpdated));
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('[Auth] Error loading professional profile:', error);
    }
  };

  const updateProfileData = (data: Partial<Professional>) => {
    setProfessional(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      
      // Evitar QuotaExceededError limpando base64 do localStorage
      const storageUpdated = { ...updated };
      if (storageUpdated.photoUrl && storageUpdated.photoUrl.startsWith('data:')) {
        storageUpdated.photoUrl = undefined;
      }
      
      localStorage.setItem('professional', JSON.stringify(storageUpdated));
      return updated;
    });
  };

  const switchCompany = (companyId: number) => {
    if (!professional || !professional.companies) return;
    
    const selectedCompany = professional.companies.find(c => c.id === companyId);
    if (!selectedCompany) return;

    const updated = {
      ...professional,
      companyId: selectedCompany.id,
      companyName: selectedCompany.name
    };

    setProfessional(updated);
    localStorage.setItem('professional', JSON.stringify(updated));
    localStorage.setItem('activeCompanyId', String(selectedCompany.id));
    
    // Recarrega as permissões e a página para isolar os dados
    window.location.href = '/painel';
  };

  // Verificar se o usuário tem acesso a um módulo
  const hasModuleAccess = (moduleCode: string): boolean => {
    // Admins (conta da Sellclin) têm acesso irrestrito a todos os módulos
    if (professional?.role === 'admin') return true;
    if (isHiddenDevelopmentModule(moduleCode) && canAccessHiddenDevelopmentPages(professional?.email)) return true;
    
    if (!permissionsLoaded) return false;
    const perms = Array.isArray(permissions) ? permissions : [];
    const permission = perms.find((p) => p.moduleCode === moduleCode);
    return permission ? permission.hasAccess : false;
  };

  // Verificar se o usuário tem uma sub-permissão específica
  const hasPermission = (moduleCode: string, permissionKey: string): boolean => {
    if (!permissionsLoaded) return false;
    
    // Usuários da equipe, inclusive administradores, respeitam as permissões do cargo.
    const type = localStorage.getItem('userType');
    if (type === 'professional') return true;

    const perms = Array.isArray(permissions) ? permissions : [];
    const permission = perms.find((p) => p.moduleCode === moduleCode);
    if (!permission || !permission.hasAccess) return false;

    const subPerms = permission.subPermissions;
    if (!subPerms || subPerms[permissionKey] === undefined) return true;

    return subPerms[permissionKey];
  };

  useEffect(() => {
    // Verificar sessão armazenada
    const savedProfessional = localStorage.getItem('professional');
    const savedToken = localStorage.getItem('token');
    
    if (savedProfessional && savedToken) {
      try {
        setProfessional(JSON.parse(savedProfessional));
        // Carregar permissões do usuário logado
        loadPermissions();
        // Carregar perfil atualizado (para manter foto em sincronia)
        loadProfessionalProfile();
      } catch (error) {
        // Se houver erro ao parsear, limpar dados inválidos
        localStorage.removeItem('professional');
        localStorage.removeItem('token');
        setPermissionsLoaded(true);
      }
    } else {
      setPermissionsLoaded(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      console.log('[Auth] Attempting login for:', email);
      
      // Tentar login como profissional primeiro
      const professionalResponse = await professionalsApi.login(email.trim().toLowerCase(), password);
      let response = professionalResponse;
      console.log('[Auth] Professional login response:', professionalResponse);
      
      // Professional e Usuario sao cadastros separados. O mesmo e-mail pode
      // ter um cadastro profissional pendente e um convite de equipe ativo.
      if (!professionalResponse.success) {
        console.log('[Auth] Professional login failed, trying user login...');
        const userResponse = await usuariosApi.login(email.trim().toLowerCase(), password);
        console.log('[Auth] User login response:', userResponse);

        if (userResponse.success) {
          response = userResponse;
        } else if (professionalResponse.error?.code === 403 || professionalResponse.error?.code === 500) {
          response = professionalResponse;
        } else {
          response = userResponse;
        }
      }
      
      if (response.success && response.data) {
        const { token, professional: profData, user: userData } = response.data as any;
        
        if ((!profData && !userData) || !token) {
          console.error('[Auth] Missing data in response:', response);
          setIsLoading(false);
          return { 
            success: false, 
            error: 'Resposta inválida do servidor. Tente novamente.' 
          };
        }
        
        // Criar dados do usuário logado (pode ser profissional ou usuário)
        const data = profData || userData;
        const professionalData: Professional = {
          id: data.id.toString(),
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          specialization: data.specialization || data.role || 'Usuário',
          role: data.email === 'admin@admin.com' ? 'admin' : (profData ? 'profissional' : (data.role || 'usuario')),
          photoUrl: data.photoUrl || undefined,
          onboardingCompleted: data.onboardingCompleted || false,
          companyId: profData ? profData.company?.id : userData?.companyId,
          companyName: profData ? profData.company?.name : userData?.companyName,
          companies: data.companies || [],
        };
        
        setProfessional(professionalData);
        localStorage.setItem('professional', JSON.stringify(professionalData));
        localStorage.setItem('token', token);
        localStorage.setItem('userType', profData ? 'professional' : 'user');
        if (professionalData.companyId) {
          localStorage.setItem('activeCompanyId', String(professionalData.companyId));
        }
        
        // Carregar permissões do usuário logado
        await loadPermissions();
        
        setIsLoading(false);
        console.log('[Auth] Login successful as', profData ? 'professional' : 'user');
        return { success: true };
      }
      
      console.error('[Auth] Login failed:', response.error);
      setIsLoading(false);
      return { 
        success: false, 
        error: response.error?.message || 'Email ou senha incorretos.' 
      };
    } catch (error) {
      console.error('[Auth] Login exception:', error);
      setIsLoading(false);
      return { 
        success: false, 
        error: 'Erro de conexão. Verifique se o servidor está rodando e tente novamente.' 
      };
    }
  };

  const loginWithGoogle = async (credential: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      console.log('[Auth] Attempting Google login...');
      const response = await authApi.loginWithGoogle(credential);
      console.log('[Auth] Google login response:', response);

      if (response.success && response.data) {
        const { token, professional: profData } = response.data as any;

        if (!profData || !token) {
          console.error('[Auth] Missing data in Google response:', response);
          setIsLoading(false);
          return {
            success: false,
            error: 'Resposta inválida do servidor. Tente novamente.'
          };
        }

        const professionalData: Professional = {
          id: profData.id.toString(),
          name: profData.name,
          email: profData.email,
          phone: profData.phone || '',
          specialization: profData.specialization || '',
          role: 'profissional',
          photoUrl: profData.photoUrl || undefined,
          onboardingCompleted: profData.onboardingCompleted || false,
          companyId: profData.company?.id,
          companyName: profData.company?.name,
          companies: profData.companies || [],
        };

        setProfessional(professionalData);
        localStorage.setItem('professional', JSON.stringify(professionalData));
        localStorage.setItem('token', token);
        localStorage.setItem('userType', 'professional');
        if (professionalData.companyId) {
          localStorage.setItem('activeCompanyId', String(professionalData.companyId));
        }

        // Carregar permissões do usuário logado
        await loadPermissions();

        setIsLoading(false);
        console.log('[Auth] Google login successful');
        return { success: true };
      }

      console.error('[Auth] Google login failed:', response.error);
      setIsLoading(false);
      return {
        success: false,
        error: (response.error as any)?.message || 'Erro ao fazer login com Google.'
      };
    } catch (error) {
      console.error('[Auth] Google login exception:', error);
      setIsLoading(false);
      return {
        success: false,
        error: 'Erro de conexão. Verifique se o servidor está rodando e tente novamente.'
      };
    }
  };

  const signup = async (data: Omit<Professional, 'id'> & { password: string }): Promise<{ success: boolean; error?: string; requiresEmailVerification?: boolean; email?: string }> => {
    setIsLoading(true);
    
    try {
      console.log('[Auth] Attempting signup for:', data.email);
      const response = await professionalsApi.signup({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        specialization: data.specialization
      });
      console.log('[Auth] Signup response:', response);
      
      if (response.success && response.data) {
        const { token, professional: profData, requiresEmailVerification } = response.data as any;
        
        if (requiresEmailVerification) {
          setIsLoading(false);
          return {
            success: true,
            requiresEmailVerification: true,
            email: response.data.email || data.email,
          };
        }

        if (!profData || !token) {
          console.error('[Auth] Missing data in response:', response);
          setIsLoading(false);
          return { 
            success: false, 
            error: 'Resposta inválida do servidor. Tente novamente.' 
          };
        }
        
        const professionalData: Professional = {
          id: profData.id.toString(),
          name: profData.name,
          email: profData.email,
          phone: profData.phone || '',
          specialization: profData.specialization || '',
          role: 'profissional',
          onboardingCompleted: profData.onboardingCompleted || false,
          companyId: profData.companyId || profData.company?.id,
          companyName: profData.companyName || profData.company?.name,
          companies: profData.companies || [],
        };
        
        setProfessional(professionalData);
        localStorage.setItem('professional', JSON.stringify(professionalData));
        localStorage.setItem('token', token);
        localStorage.setItem('userType', 'professional');
        
        // Carregar permissões do usuário logado
        await loadPermissions();
        
        setIsLoading(false);
        console.log('[Auth] Signup successful');
        return { success: true };
      }
      
      console.error('[Auth] Signup failed:', response.error);
      setIsLoading(false);
      return { 
        success: false, 
        error: response.error?.message || 'Erro ao criar conta. Tente novamente mais tarde.' 
      };
    } catch (error) {
      console.error('[Auth] Signup exception:', error);
      setIsLoading(false);
      return { 
        success: false, 
        error: 'Erro de conexão. Verifique se o servidor está rodando e tente novamente.' 
      };
    }
  };

  const completeOnboarding = async (data: any) => {
    try {
      const type = localStorage.getItem('userType');
      const response = type === 'user' 
        ? await usuariosApi.completeOnboarding(data)
        : await professionalsApi.completeOnboarding(data);
      
      if (!response.success) {
        console.error('[Auth] Erro na API ao concluir onboarding (ignorando para não travar o usuário):', response.error);
      }
    } catch (error) {
      console.error('[Auth] Falha na requisição de onboarding (ignorando para não travar):', error);
    }
    // Sempre marca como concluído localmente para liberar o acesso do usuário
    setProfessional(prev => {
      if (!prev) return prev;
      const updated = { ...prev, onboardingCompleted: true };
      localStorage.setItem('professional', JSON.stringify(updated));
      return updated;
    });
    return { success: true };
  };

  const logout = () => {
    setProfessional(null);
    setPermissions([]);
    setPermissionsLoaded(false);
    localStorage.removeItem('professional');
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('activeCompanyId');
  };

  return (
    <AuthContext.Provider value={{
      professional,
      permissions,
      permissionsLoaded,
      login,
      loginWithGoogle,
      logout,
      signup,
      hasModuleAccess,
      hasPermission,
      isLoading,
      loadPermissions,
      updateProfileData,
      switchCompany,
      completeOnboarding
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
