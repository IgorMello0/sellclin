import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LayoutProvider } from "./contexts/LayoutContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SelectPlan = lazy(() => import("./pages/SelectPlan"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Clients = lazy(() => import("./pages/Clients"));
const Conversations = lazy(() => import("./pages/Conversations"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const Integrations = lazy(() => import("./pages/Integrations"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Leads = lazy(() => import("./pages/Leads"));
const SalesFunnel = lazy(() => import("./pages/SalesFunnel"));
const Goals = lazy(() => import("./pages/Goals"));
const Tasks = lazy(() => import("./pages/Tasks"));
const FAQ = lazy(() => import("./pages/FAQ"));
const FunilPage = lazy(() => import("./pages/FunilPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const MetasPage = lazy(() => import("./pages/MetasPage"));
const PrecosPage = lazy(() => import("./pages/PrecosPage"));
const ClientesPage = lazy(() => import("./pages/ClientesPage"));
const SobrePage = lazy(() => import("./pages/SobrePage"));
const CampanhasPage = lazy(() => import("./pages/CampanhasPage"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const WhatsAppTemplates = lazy(() => import("./pages/WhatsAppTemplates"));
const WhatsAppTemplateCreate = lazy(() => import("./pages/WhatsAppTemplateCreate"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Carregando página">
    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
  </div>
);

const LegacyRedirect = ({ to }: { to: string }) => {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LayoutProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/entrar" element={<Login />} />
                <Route path="/cadastro" element={<Signup />} />
                <Route path="/verificar-email" element={<VerifyEmail />} />
                <Route path="/aceitar-convite" element={<AcceptInvite />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route path="/escolher-plano" element={<SelectPlan />} />
                <Route path="/login" element={<LegacyRedirect to="/entrar" />} />
                <Route path="/signup" element={<LegacyRedirect to="/cadastro" />} />
                <Route path="/verify-email" element={<LegacyRedirect to="/verificar-email" />} />
                <Route path="/accept-invite" element={<LegacyRedirect to="/aceitar-convite" />} />
                <Route path="/forgot-password" element={<LegacyRedirect to="/esqueci-senha" />} />
                <Route path="/reset-password" element={<LegacyRedirect to="/redefinir-senha" />} />
                <Route path="/select-plan" element={<LegacyRedirect to="/escolher-plano" />} />
                <Route path="/perguntas-frequentes" element={<FAQ />} />
                <Route path="/faq" element={<LegacyRedirect to="/perguntas-frequentes" />} />
                <Route path="/funcionalidades/funil" element={<FunilPage />} />
                <Route path="/funcionalidades/agenda" element={<AgendaPage />} />
                <Route path="/funcionalidades/metas" element={<MetasPage />} />
                <Route path="/funcionalidades/campanhas" element={<CampanhasPage />} />
                <Route path="/precos" element={<PrecosPage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/sobre" element={<SobrePage />} />
                <Route path="/termos-de-uso" element={<LegalPage kind="terms" />} />
                <Route path="/politica-de-privacidade" element={<LegalPage kind="privacy" />} />
                <Route path="/politica-de-cookies" element={<LegalPage kind="cookies" />} />
                <Route path="/seguranca" element={<LegalPage kind="security" />} />
                <Route path="/" element={<AppLayout />}>
                  <Route path="painel" element={<Dashboard />} />
                  <Route path="agenda" element={<ProtectedRoute moduleCode="agendamentos" moduleName="Agenda"><Appointments /></ProtectedRoute>} />
                  <Route path="pacientes" element={<ProtectedRoute moduleCode="clientes" moduleName="Clientes" subPermissionKey="verClientes"><Clients /></ProtectedRoute>} />
                  <Route path="appointments" element={<LegacyRedirect to="/agenda" />} />
                  <Route path="clients" element={<LegacyRedirect to="/pacientes" />} />
                  <Route path="oportunidades" element={<ProtectedRoute moduleCode="clientes" moduleName="Leads" subPermissionKey="verLeads"><Leads /></ProtectedRoute>} />
                  <Route path="conversas" element={<ProtectedRoute moduleCode="conversas" moduleName="Conversas"><Conversations /></ProtectedRoute>} />
                  <Route path="modelos" element={<ProtectedRoute moduleCode="conversas" moduleName="Templates"><WhatsAppTemplates /></ProtectedRoute>} />
                  <Route path="modelos/novo" element={<ProtectedRoute moduleCode="conversas" moduleName="Templates"><WhatsAppTemplateCreate /></ProtectedRoute>} />
                  <Route path="configuracoes" element={<Settings />} />
                  <Route path="integracoes" element={<ProtectedRoute moduleCode="integrations" moduleName="Integrações"><Integrations /></ProtectedRoute>} />
                  <Route
                    path="administracao"
                    element={
                      <Admin />
                    }
                  />
                  <Route path="perfil" element={<Navigate to="/configuracoes?tab=perfil" replace />} />
                  <Route path="comercial" element={<ProtectedRoute moduleCode="funnel" moduleName="Comercial"><SalesFunnel /></ProtectedRoute>} />
                  <Route path="metas" element={<ProtectedRoute moduleCode="metas" moduleName="Metas"><Goals /></ProtectedRoute>} />
                  <Route path="tarefas" element={<ProtectedRoute moduleCode="tarefas" moduleName="Tarefas"><Tasks /></ProtectedRoute>} />
                  <Route path="campanhas" element={<ProtectedRoute moduleCode="campanhas" moduleName="Campanhas"><Campaigns /></ProtectedRoute>} />
                  <Route path="dashboard" element={<LegacyRedirect to="/painel" />} />
                  <Route path="leads" element={<LegacyRedirect to="/oportunidades" />} />
                  <Route path="conversations" element={<LegacyRedirect to="/conversas" />} />
                  <Route path="templates" element={<LegacyRedirect to="/modelos" />} />
                  <Route path="templates/new" element={<LegacyRedirect to="/modelos/novo" />} />
                  <Route path="settings" element={<LegacyRedirect to="/configuracoes" />} />
                  <Route path="integrations" element={<LegacyRedirect to="/integracoes" />} />
                  <Route path="admin" element={<LegacyRedirect to="/administracao" />} />
                  <Route path="profile" element={<LegacyRedirect to="/perfil" />} />
                  <Route path="sales-funnel" element={<LegacyRedirect to="/comercial" />} />
                  <Route path="tasks" element={<LegacyRedirect to="/tarefas" />} />
                  <Route path="campaigns" element={<LegacyRedirect to="/campanhas" />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LayoutProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
