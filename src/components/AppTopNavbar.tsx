import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { getImageUrl, notificationsApi } from '@/lib/api';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: 'grid_view',
    moduleCode: 'dashboard',
  },
  {
    title: 'Clientes',
    url: '/pacientes',
    icon: 'group',
    moduleCode: 'clientes',
  },
  {
    title: 'Leads',
    url: '/leads',
    icon: 'person_add',
    moduleCode: 'clientes',
  },
  {
    title: 'Agenda',
    url: '/agenda',
    icon: 'calendar_month',
    moduleCode: 'agendamentos',
  },
  {
    title: 'Comercial',
    url: '/sales-funnel',
    icon: 'filter_alt',
    moduleCode: 'funnel',
  },
  {
    title: 'Tarefas',
    url: '/tasks',
    icon: 'task_alt',
    moduleCode: 'tarefas',
  },
  {
    title: 'Conversas',
    url: '/conversations',
    icon: 'message',
    moduleCode: 'conversas',
  },
  {
    title: 'Templates',
    url: '/templates',
    icon: 'text_snippet',
    moduleCode: 'conversas',
  },
  {
    title: 'Metas',
    url: '/metas',
    icon: 'track_changes',
    moduleCode: 'metas',
  },
  {
    title: 'Campanhas',
    url: '/campaigns',
    icon: 'rocket_launch',
    moduleCode: 'campanhas',
  },
];

export function AppTopNavbar() {
  const { logout, hasModuleAccess, permissionsLoaded, professional, switchCompany } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [blockedTooltip, setBlockedTooltip] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const companyMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtra módulos bloqueados por permissão.
  const visibleMenuItems = menuItems.filter((item) => {
    // Regra de Permissão Modular
    // Se tivermos permissões carregadas, verificamos o acesso
    if (!permissionsLoaded) return false;
    return hasModuleAccess(item.moduleCode);
  });

  // Verifica se um item está bloqueado por permissão (usado apenas em casos específicos se necessário)
  const isModuleBlocked = (moduleCode: string): boolean => {
    if (!permissionsLoaded) return false;
    return !hasModuleAccess(moduleCode);
  };

  // Mostra tooltip temporário ao clicar em módulo bloqueado
  const showBlockedTooltip = (title: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setBlockedTooltip(title);
    tooltipTimerRef.current = setTimeout(() => setBlockedTooltip(null), 2500);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Close company dropdown on outside click
  useEffect(() => {
    if (!companyMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (companyMenuRef.current && !companyMenuRef.current.contains(e.target as Node)) setCompanyMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [companyMenuOpen]);

  // Close notifications dropdown on outside click
  useEffect(() => {
    if (!notificationsOpen) return;
    const handler = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notificationsOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getAll();
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    }
  };

  useEffect(() => {
    if (professional) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [professional]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleReadAll = async () => {
    try {
      const res = await notificationsApi.readAll();
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReadSingle = async (n: any) => {
    if (!n.read) {
      try {
        await notificationsApi.read(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
      } catch (err) {
        console.error(err);
      }
    }
    setNotificationsOpen(false);
    if (n.taskId) {
      navigate('/tasks');
    }
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // User initials
  const initials = professional?.name
    ? professional.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const roleName = professional?.role === 'admin' ? 'ADMIN' : (professional?.role === 'profissional' ? 'PROFISSIONAL' : (professional?.role?.toUpperCase() || 'COLABORADOR'));
  const isProfileActive = location.pathname === '/settings';

  return (
    <>
      <header className="sticky top-0 w-full z-50 bg-[#0B1525] text-white shadow-lg shadow-[#0B1525]/10 border-b border-white/5">
        <div className="w-full px-3 sm:px-4 lg:px-6 flex items-center h-14 sm:h-16">
          
          {/* Mobile hamburger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors mr-2"
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 mr-4 lg:mr-6 shrink-0">
            <img
              alt="SellClin Logo"
              className="h-8 sm:h-10 w-auto object-contain"
              src="/logo-oficial-v3.png"
            />
          </Link>

          {/* Context Switcher (Clinic Selector) */}
          {professional?.companies && professional.companies.length > 0 && (
            <div className="relative z-[100]" ref={companyMenuRef}>
              <button 
                onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                className="flex items-center gap-2 bg-[#03071233] hover:bg-[#03071266] px-3 py-1.5 rounded-xl border-none transition-all duration-300 mr-2 sm:mr-4 max-w-[140px] sm:max-w-xs cursor-pointer group"
              >
                <div className="w-5 h-5 rounded-lg bg-orange-500/10 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[13px]">storefront</span>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors truncate">
                  {professional.companies.find(c => c.id === professional.companyId)?.name || professional.companyName || 'Clínica'}
                </span>
                <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-slate-500 group-hover:text-slate-300 transition-transform duration-300">
                  expand_more
                </span>
              </button>
              
              {companyMenuOpen && (
                <div className="absolute top-12 left-0 w-56 sm:w-64 bg-white rounded-xl shadow-2xl shadow-black/15 border border-slate-100 py-2 text-slate-700 animate-fade-in-up overflow-hidden z-[100]">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mudar de Clínica</p>
                    <p className="text-xs text-slate-600 font-medium">Selecione o contexto desejado</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {professional.companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setCompanyMenuOpen(false);
                          switchCompany(company.id);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left",
                          company.id === professional.companyId 
                            ? "bg-primary/5 text-primary" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <span className="material-symbols-outlined text-[18px] opacity-70">
                          {company.id === professional.companyId ? 'check_circle' : 'business'}
                        </span>
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate">{company.name}</span>
                          {company.role && <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{company.role}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Items — Desktop only */}
          <nav className="hidden lg:flex flex-1 justify-center items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide py-2">
            {visibleMenuItems.map((item) => {
              const isActive = location.pathname === item.url || 
                (item.url !== '/dashboard' && location.pathname.startsWith(item.url));
              
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className="flex flex-col items-center justify-center gap-1.5 group w-20 md:w-24 shrink-0 transition-all duration-200"
                  title={item.title}
                >
                  <span className={cn(
                    "material-symbols-outlined text-[24px] transition-colors",
                    isActive
                      ? "text-secondary drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                      : "text-slate-500 group-hover:text-slate-400"
                  )}>
                    {item.icon}
                  </span>
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-widest transition-colors font-headline mt-0.5",
                    isActive ? "text-secondary" : "text-slate-500 group-hover:text-slate-400"
                  )}>
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer for mobile */}
          <div className="flex-1 lg:hidden" />

          {/* Right Side — Bell + Avatar Dropdown */}
          <div className="flex items-center gap-2 sm:gap-4 ml-2 sm:ml-4 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (!notificationsOpen) {
                    fetchNotifications();
                  }
                }}
                className="relative flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-white/5"
                title="Notificações"
              >
                <span className="material-symbols-outlined text-[22px] sm:text-[26px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#0B1525]">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute top-12 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 text-slate-700 animate-fade-in-up z-[100] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 font-headline">Notificações</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Você tem {unreadCount} mensagens não lidas</p>
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleReadAll}
                        className="text-xs font-semibold text-primary hover:text-primary-dark hover:underline transition-colors cursor-pointer"
                      >
                        Limpar todas
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl opacity-50 mb-1">notifications_off</span>
                        <p className="text-xs font-medium">Nenhuma notificação por enquanto</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleReadSingle(n)}
                          className={cn(
                            "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 items-start cursor-pointer",
                            !n.read ? "bg-primary/5 font-semibold" : ""
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            n.type === 'task_assigned' 
                              ? "bg-blue-100 text-blue-600" 
                              : n.type === 'task_completed'
                              ? "bg-green-100 text-green-600"
                              : "bg-orange-100 text-orange-600"
                          )}>
                            <span className="material-symbols-outlined text-[18px]">
                              {n.type === 'task_assigned' ? 'assignment' : n.type === 'task_completed' ? 'check_circle' : 'info'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-800 break-words leading-tight">{n.content}</p>
                            <span className="text-[9px] text-slate-400 mt-1 block">
                              {new Date(n.createdAt).toLocaleDateString('pt-BR')} às {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] font-bold transition-all cursor-pointer shadow-sm overflow-hidden",
                isProfileActive 
                  ? "border-2 border-secondary shadow-[0_0_12px_rgba(249,115,22,0.3)]" 
                  : "border border-white/20 hover:border-white/40"
              )}
              title="Menu do usuário"
            >
              {professional?.photoUrl ? (
                <img 
                  src={getImageUrl(professional.photoUrl)} 
                  alt="Foto do perfil" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className={cn(
                  "w-full h-full flex items-center justify-center",
                  isProfileActive ? "bg-secondary/10 text-secondary" : "bg-white/5 text-slate-300"
                )}>
                  {initials}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute top-14 right-2 sm:right-4 w-56 sm:w-64 bg-white rounded-2xl shadow-2xl shadow-black/15 border border-slate-100 py-2 text-slate-700 animate-fade-in-up overflow-hidden z-[100]">
                {/* User info header */}
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100">
                  <span className="text-[10px] sm:text-[11px] font-bold text-primary/60 uppercase tracking-wider">{roleName}</span>
                  <p className="text-sm sm:text-base font-bold text-slate-900 font-headline mt-0.5">{professional?.name || 'Usuário'}</p>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  <Link
                    to="/settings?tab=profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-slate-400">person_outline</span>
                    Meu Perfil
                  </Link>
                  {(professional?.role === 'admin' || professional?.role === 'profissional') && (
                    <Link
                      to="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px] text-slate-400">settings</span>
                      Configurações
                    </Link>
                  )}
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 pt-1.5">
                  <button
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                    className="flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Sair da Conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Drawer */}
          <nav className="absolute top-14 left-0 right-0 bottom-0 bg-[#0B1525] overflow-y-auto animate-fade-in-up">
            <div className="p-4 space-y-1">
              {visibleMenuItems.map((item) => {
                const isActive = location.pathname === item.url || 
                  (item.url !== '/dashboard' && location.pathname.startsWith(item.url));
                
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all text-sm font-medium",
                      isActive
                        ? "bg-white/10 text-secondary"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span className={cn(
                      "material-symbols-outlined text-[22px]",
                      isActive ? "text-secondary" : "text-slate-500"
                    )}>
                      {item.icon}
                    </span>
                    {item.title}
                  </Link>
                );
              })}
            </div>

            {/* Mobile drawer footer */}
            <div className="border-t border-white/10 p-4 mt-2 space-y-1">
              <Link
                to="/settings?tab=profile"
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <span className="material-symbols-outlined text-[22px] text-slate-500">person_outline</span>
                Meu Perfil
              </Link>
              {(professional?.role === 'admin' || professional?.role === 'profissional') && (
                <Link
                  to="/settings"
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <span className="material-symbols-outlined text-[22px] text-slate-500">settings</span>
                  Configurações
                </Link>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full transition-all"
              >
                <span className="material-symbols-outlined text-[22px]">logout</span>
                Sair da Conta
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
