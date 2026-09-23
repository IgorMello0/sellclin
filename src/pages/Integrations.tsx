import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  MessageCircle,
  MessagesSquare,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Unplug,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { googleCalendarApi, whatsappMetaApi, whatsappUazapiApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TemplateCatalog } from '@/components/whatsapp/TemplateCatalog';

type IntegrationKey = 'whatsappOfficial' | 'whatsappCoexistence' | 'whatsappUazapi' | 'instagram' | 'messenger' | 'googleCalendar';

type MetaStatus = {
  connected?: boolean;
  status?: string;
  serverSecretConfigured?: boolean;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  businessId?: string | null;
  displayPhoneNumber?: string | null;
  webhookVerifyToken?: string | null;
  webhookUrl?: string | null;
  hasAccessToken?: boolean;
  hasTwoStepPin?: boolean;
  officialMode?: 'cloud_api' | 'coexistence';
  coexistenceAllowed?: boolean;
  coexistenceEnabled?: boolean;
  coexistenceConfigured?: boolean;
  webhookConfigured?: boolean;
  webhookDiagnostic?: string | null;
  subscribedAppId?: string | null;
  reportedCallbackUrl?: string | null;
  requestedWebhookFields?: string[];
  coexistenceWebhookFieldsRequested?: boolean;
  coexistenceWebhookFieldsRequestedAt?: string | null;
  missingCoexistenceWebhookFields?: string[];
  phoneNumberWebhookOverrideConfigured?: boolean;
  lastWebhookEvent?: {
    eventType?: string | null;
    status?: string;
    errorMessage?: string | null;
    createdAt?: string;
    processedAt?: string | null;
  } | null;
  lastPhoneEchoEvent?: {
    eventType?: string | null;
    status?: string;
    errorMessage?: string | null;
    createdAt?: string;
    processedAt?: string | null;
  } | null;
};

type MetaForm = {
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
  accessToken: string;
  webhookVerifyToken: string;
  twoStepPin: string;
  displayPhoneNumber: string;
};

type UazapiStatus = {
  serverConfigured?: boolean;
  configured?: boolean;
  connected?: boolean;
  loggedIn?: boolean;
  status?: string;
  providerStatus?: string;
  instanceId?: string | null;
  instanceName?: string | null;
  webhookUrl?: string | null;
  qrcode?: string | null;
  pairingCode?: string | null;
  profileName?: string | null;
  owner?: string | null;
  message?: string;
};

type GoogleCalendarStatus = {
  connected?: boolean;
  status?: 'connected' | 'disconnected' | 'error' | string;
  googleEmail?: string | null;
  calendarId?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  pendingCount?: number;
};

type IntegrationOption = {
  id: IntegrationKey;
  title: string;
  eyebrow: string;
  description: string;
  status: string;
  available: boolean;
  logo: ReactNode;
};

const logoClass = 'h-7 w-7 object-contain';

const integrationOptions: IntegrationOption[] = [
  {
    id: 'whatsappCoexistence',
    title: 'WhatsApp Oficial',
    eyebrow: 'Coexistencia',
    description: 'Mantenha o WhatsApp Business no celular e conecte o mesmo numero ao SellClin.',
    status: 'Disponivel',
    available: true,
    logo: (
      <span className="relative flex h-8 w-8 items-center justify-center">
        <img src="/integrations/whatsapp.webp" alt="WhatsApp Business" className="h-7 w-7 object-contain" />
        <Smartphone className="absolute -bottom-1 -right-1 h-4 w-4 rounded bg-white p-0.5 text-blue-600 shadow-sm" />
      </span>
    ),
  },
  {
    id: 'whatsappUazapi',
    title: 'WhatsApp Nao Oficial',
    eyebrow: 'QR Code',
    description: 'Conecte por QR Code ou codigo de pareamento quando nao usar Meta.',
    status: 'Disponivel',
    available: true,
    logo: (
      <span className="relative flex h-8 w-8 items-center justify-center">
        <img src="/integrations/whatsapp.webp" alt="WhatsApp" className="h-7 w-7 object-contain" />
        <QrCode className="absolute -bottom-1 -right-1 h-4 w-4 rounded bg-white p-0.5 text-slate-700 shadow-sm" />
      </span>
    ),
  },
  {
    id: 'instagram',
    title: 'Instagram',
    eyebrow: 'Social messaging',
    description: 'Receba DMs e comentarios do Instagram na central de conversas.',
    status: 'Em breve',
    available: false,
    logo: <img src="/integrations/instagram-icon.png" alt="Instagram" className={logoClass} />,
  },
  {
    id: 'messenger',
    title: 'Messenger',
    eyebrow: 'Meta inbox',
    description: 'Atenda conversas vindas do Facebook Messenger no mesmo fluxo.',
    status: 'Em breve',
    available: false,
    logo: <img src="/integrations/facebook-messenger-logo.png" alt="Messenger" className={logoClass} />,
  },
  {
    id: 'googleCalendar',
    title: 'Google Calendar',
    eyebrow: 'Agenda',
    description: 'Sincronize a agenda da clinica com o Google Calendar.',
    status: 'Disponivel',
    available: true,
    logo: <img src="/integrations/google-calendar.webp" alt="Google Calendar" className={logoClass} />,
  },
];

const emptyMetaForm: MetaForm = {
  phoneNumberId: '',
  wabaId: '',
  businessId: '',
  accessToken: '',
  webhookVerifyToken: '',
  twoStepPin: '',
  displayPhoneNumber: '',
};

const Integrations = () => {
  const { professional } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canManageIntegrations = professional?.role === 'admin' || professional?.role === 'profissional';
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationKey | null>(null);
  const [workingKey, setWorkingKey] = useState<IntegrationKey | 'meta-save' | 'meta-disconnect' | 'uazapi-qr' | 'uazapi-pair' | 'uazapi-disconnect' | 'google-resync' | 'google-disconnect' | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [metaForm, setMetaForm] = useState<MetaForm>(emptyMetaForm);
  const [uazapiStatus, setUazapiStatus] = useState<UazapiStatus | null>(null);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [uazapiPhone, setUazapiPhone] = useState('');
  const [uazapiPolling, setUazapiPolling] = useState(false);
  const [uazapiMethod, setUazapiMethod] = useState<'qr' | 'pairing'>('qr');
  const [showToken, setShowToken] = useState(false);
  const selectedOption = integrationOptions.find((option) => option.id === selectedIntegration);

  const loadMetaStatus = async () => {
    const response = await whatsappMetaApi.status();
    if (!response.success) {
      throw new Error(response.error?.message || 'Nao foi possivel consultar WhatsApp Oficial.');
    }

    const data = response.data || {};
    setMetaStatus(data);
    setMetaForm((current) => ({
      ...current,
      phoneNumberId: data.phoneNumberId || '',
      wabaId: data.wabaId || '',
      businessId: data.businessId || '',
      accessToken: '',
      webhookVerifyToken: data.webhookVerifyToken || '',
      twoStepPin: '',
      displayPhoneNumber: data.displayPhoneNumber || '',
    }));
  };

  const loadUazapiStatus = async () => {
    const response = await whatsappUazapiApi.status();
    if (!response.success) {
      throw new Error(response.error?.message || 'Nao foi possivel consultar a conexao do WhatsApp.');
    }
    setUazapiStatus((current) => ({ ...current, ...(response.data || {}) }));
  };

  const loadGoogleCalendarStatus = async () => {
    const response = await googleCalendarApi.status();
    if (!response.success) {
      throw new Error(response.error?.message || 'Nao foi possivel consultar o Google Calendar.');
    }
    setGoogleCalendarStatus(response.data || {});
  };

  useEffect(() => {
    if (!canManageIntegrations) return;

    const params = new URLSearchParams(window.location.search);
    const channel = params.get('channel');
    const channelMap: Record<string, IntegrationKey> = {
      'whatsapp-official': 'whatsappCoexistence',
      'whatsapp-coexistence': 'whatsappCoexistence',
      'whatsapp-uazapi': 'whatsappUazapi',
      instagram: 'instagram',
      messenger: 'messenger',
      'google-calendar': 'googleCalendar',
    };

    if (channel && channelMap[channel]) {
      setSelectedIntegration(channelMap[channel]);
    }

    Promise.allSettled([loadMetaStatus(), loadUazapiStatus(), loadGoogleCalendarStatus()]).then((results) => {
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        toast({ title: 'Erro ao carregar integracoes', description: failed.reason?.message, variant: 'destructive' });
      }

      const googleCalendarResult = params.get('googleCalendar');
      if (googleCalendarResult === 'connected') {
        toast({ title: 'Google Calendar conectado', description: 'O status e os agendamentos foram atualizados.' });
      } else if (googleCalendarResult === 'error' || googleCalendarResult === 'missing') {
        toast({ title: 'Google Calendar nao conectado', description: 'A autorizacao nao foi concluida. Tente novamente.', variant: 'destructive' });
      }
    });
  }, [canManageIntegrations]);

  useEffect(() => {
    if (!uazapiPolling) return;

    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await whatsappUazapiApi.status();
        if (cancelled || !response.success) return;
        const data = response.data || {};
        setUazapiStatus((current) => ({ ...current, ...data }));
        if (data.connected || data.qrcode || data.pairingCode || attempts >= 30) {
          setUazapiPolling(false);
        }
      } catch {
        if (attempts >= 30) setUazapiPolling(false);
      }
    };

    const timer = window.setInterval(poll, 2000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [uazapiPolling]);

  const copyText = async (value?: string | null, label = 'Texto') => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copiado` });
  };

  const connectMeta = async (mode: 'cloud_api' | 'coexistence') => {
    setWorkingKey(mode === 'coexistence' ? 'whatsappCoexistence' : 'whatsappOfficial');
    try {
      const response = await whatsappMetaApi.connect(mode);
      if (!response.success || !response.data?.url) throw new Error(response.error?.message || 'Nao foi possivel iniciar a conexao.');
      window.location.assign(response.data.url);
    } catch (error: any) {
      toast({ title: 'Conexao nao iniciada', description: error.message, variant: 'destructive' });
      setWorkingKey(null);
    }
  };

  const saveMetaConfig = async () => {
    setWorkingKey('meta-save');
    try {
      const response = await whatsappMetaApi.configure({
        phoneNumberId: metaForm.phoneNumberId.trim(),
        wabaId: metaForm.wabaId.trim(),
        businessId: metaForm.businessId.trim(),
        accessToken: metaForm.accessToken.trim(),
        webhookVerifyToken: metaForm.webhookVerifyToken.trim(),
        twoStepPin: metaForm.twoStepPin.trim(),
        displayPhoneNumber: metaForm.displayPhoneNumber.trim(),
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Nao foi possivel salvar a Meta.');
      }

      toast({ title: 'WhatsApp Oficial salvo', description: 'Agora configure a URL e o verify token no app da Meta.' });
      await loadMetaStatus();
    } catch (error: any) {
      toast({ title: 'Erro na Meta', description: error.message, variant: 'destructive' });
    } finally {
      setWorkingKey(null);
    }
  };

  const disconnectMeta = async () => {
    if (!confirm('Desconectar o WhatsApp Oficial desta clinica?')) return;
    setWorkingKey('meta-disconnect');
    try {
      const response = await whatsappMetaApi.disconnect();
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel desconectar.');
      toast({ title: 'WhatsApp Oficial desconectado' });
      await loadMetaStatus();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setWorkingKey(null);
    }
  };

  const repairMetaWebhook = async () => {
    setWorkingKey('meta-webhook-repair');
    try {
      const response = await whatsappMetaApi.repairWebhook('coexistence');
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel reparar o recebimento.');
      const awaitingPhoneEcho = response.data?.awaitingPhoneEcho;
      toast({
        title: awaitingPhoneEcho ? 'Sincronizacao solicitada' : 'Recebimento configurado',
        description: awaitingPhoneEcho
          ? 'Agora envie uma mensagem pelo WhatsApp Business no celular para confirmar que ela chega ao SellClin.'
          : 'O webhook desta clinica foi atualizado na Meta.',
      });
      await loadMetaStatus();
    } catch (error: any) {
      toast({ title: 'Falha ao reparar recebimento', description: error.message, variant: 'destructive' });
    } finally {
      setWorkingKey(null);
    }
  };

  const connectUazapi = async (usePairingCode = false) => {
    if (usePairingCode && uazapiPhone.replace(/\D/g, '').length < 10) {
      toast({ title: 'Informe o telefone', description: 'Use DDI e DDD, por exemplo 5511999999999.', variant: 'destructive' });
      return;
    }

    setWorkingKey(usePairingCode ? 'uazapi-pair' : 'uazapi-qr');
    try {
      const response = await whatsappUazapiApi.connect(usePairingCode ? uazapiPhone : undefined);
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel conectar o WhatsApp.');
      const data = response.data || {};
      setUazapiStatus(data);
      setUazapiPolling(!data.connected && !data.qrcode && !data.pairingCode);
      toast({
        title: usePairingCode ? 'Codigo solicitado' : 'QR Code solicitado',
        description: response.data?.message || 'Conexao iniciada.',
      });
    } catch (error: any) {
      setUazapiPolling(false);
      toast({ title: 'Erro ao conectar WhatsApp', description: String(error.message || '').replace(/UAZAPI/gi, 'servico de conexao'), variant: 'destructive' });
    } finally {
      setWorkingKey(null);
    }
  };

  const disconnectUazapi = async () => {
    if (!confirm('Remover esta conexao do WhatsApp?')) return;
    setWorkingKey('uazapi-disconnect');
    try {
      const response = await whatsappUazapiApi.disconnect();
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel desconectar.');
      setUazapiStatus(null);
      await loadUazapiStatus();
      toast({ title: 'WhatsApp desconectado' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setWorkingKey(null);
    }
  };

  const qrCodeSource = (() => {
    const value = uazapiStatus?.qrcode?.trim();
    if (!value) return null;
    if (value.startsWith('data:image/')) return value;
    return /^[A-Za-z0-9+/=]+$/.test(value) ? `data:image/png;base64,${value}` : null;
  })();

  const connectGoogleCalendar = async () => {
    setWorkingKey('googleCalendar');
    try {
      const response = await googleCalendarApi.connect();
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
        return;
      }
      throw new Error(response.error?.message || 'Nao foi possivel iniciar a conexao com Google Calendar.');
    } catch (error: any) {
      toast({ title: 'Erro no Google Calendar', description: error.message, variant: 'destructive' });
      setWorkingKey(null);
    }
  };

  const resyncGoogleCalendar = async () => {
    setWorkingKey('google-resync');
    try {
      const response = await googleCalendarApi.resync();
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel sincronizar a agenda.');
      const result = response.data || {};
      toast({
        title: 'Agenda sincronizada',
        description: `${result.synced || 0} agendamento(s) sincronizado(s)${result.failed ? `; ${result.failed} falharam.` : '.'}`,
        variant: result.failed ? 'destructive' : 'default',
      });
      await loadGoogleCalendarStatus();
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar agenda', description: error.message, variant: 'destructive' });
      await loadGoogleCalendarStatus().catch(() => undefined);
    } finally {
      setWorkingKey(null);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!confirm('Desconectar o Google Calendar desta clinica?')) return;
    setWorkingKey('google-disconnect');
    try {
      const response = await googleCalendarApi.disconnect();
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel desconectar o Google Calendar.');
      setGoogleCalendarStatus({ connected: false, status: 'disconnected', pendingCount: 0 });
      toast({ title: 'Google Calendar desconectado' });
    } catch (error: any) {
      toast({ title: 'Erro ao desconectar Google Calendar', description: error.message, variant: 'destructive' });
    } finally {
      setWorkingKey(null);
    }
  };

  const showComingSoon = (name: string) => {
    toast({
      title: `${name} em breve`,
      description: 'Este canal ja ficou no desenho da central, mas a conexao sera ativada na proxima etapa.',
    });
  };

  const isIntegrationConnected = (key: IntegrationKey) => {
    if (key === 'whatsappOfficial') {
      return !!metaStatus?.connected && metaStatus.officialMode !== 'coexistence';
    }
    if (key === 'whatsappCoexistence') {
      return !!metaStatus?.connected && metaStatus.officialMode === 'coexistence';
    }
    if (key === 'whatsappUazapi') return !!uazapiStatus?.connected;
    if (key === 'googleCalendar') return googleCalendarStatus?.status === 'connected';
    return false;
  };

  const renderIntegrationCard = (option: IntegrationOption) => {
    const connected = isIntegrationConnected(option.id);
    const isWhatsApp = option.id.startsWith('whatsapp');
    const hasGoogleError = option.id === 'googleCalendar' && googleCalendarStatus?.status === 'error';

    return (
      <button
        key={option.id}
        type="button"
        onClick={() => option.available ? setSelectedIntegration(option.id) : showComingSoon(option.title)}
        className="group flex min-h-40 w-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            {option.logo}
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
            hasGoogleError
              ? 'bg-red-50 text-red-700'
              : connected
              ? 'bg-emerald-50 text-emerald-700'
              : option.available
                ? isWhatsApp ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                : 'bg-slate-100 text-slate-400'
          }`}>
            {connected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            {hasGoogleError ? 'Atenção' : connected ? 'Conectado' : option.status}
          </span>
        </div>
        <div className="mt-5 w-full">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{option.eyebrow}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-slate-950">{option.title}</h3>
            <ArrowRight size={17} className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{option.description}</p>
        </div>
      </button>
    );
  };

  if (!canManageIntegrations) {
    return (
      <div className="w-full p-4 sm:p-6 md:p-8">
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Integracoes restritas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas administradores da clinica podem configurar integracoes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-500">Central de canais</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Integrações</h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
              Conecte os canais usados pela clínica e acompanhe cada configuração separadamente.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/conversas')} className="w-full sm:w-auto">
            <MessagesSquare size={16} className="mr-2" />
            Abrir conversas
          </Button>
        </div>

        <div className="mt-6 min-w-0">
      {!selectedOption && (
        <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle size={18} className="text-emerald-600" />
              <div>
                <h2 className="text-base font-black text-slate-950">WhatsApp</h2>
                <p className="text-xs font-medium text-slate-500">Escolha uma forma de conexão.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {integrationOptions.filter((option) => option.id.startsWith('whatsapp')).map(renderIntegrationCard)}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Link2 size={18} className="text-blue-600" />
              <div>
                <h2 className="text-base font-black text-slate-950">Outros canais</h2>
                <p className="text-xs font-medium text-slate-500">Agenda e redes sociais da clínica.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {integrationOptions.filter((option) => !option.id.startsWith('whatsapp')).map(renderIntegrationCard)}
            </div>
          </section>
        </div>
      )}

      {selectedOption && (
        <Card className="min-w-0 rounded-lg border-slate-200 bg-white shadow-sm">
          <CardHeader className="min-w-0 border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedIntegration(null)}
                  className="shrink-0"
                  aria-label="Voltar para integrações"
                >
                  <ArrowLeft size={17} />
                </Button>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
                  {selectedOption.logo}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{selectedOption.eyebrow}</p>
                  <CardTitle className="mt-0.5 break-words text-xl">{selectedOption.title}</CardTitle>
                  <CardDescription className="break-words">{selectedOption.description}</CardDescription>
                </div>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
                isIntegrationConnected(selectedOption.id) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isIntegrationConnected(selectedOption.id) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {isIntegrationConnected(selectedOption.id) ? 'Conectado' : 'Não conectado'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {selectedIntegration === 'whatsappOfficial' && (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-5">
                  {!metaStatus?.serverSecretConfigured && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                      A integracao oficial ainda nao esta disponivel. Entre em contato com o suporte do SellClin.
                    </div>
                  )}

                  <div className="flex flex-col gap-4 rounded-lg border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                        <Cloud size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-950">Conectar um número exclusivo</p>
                        <p className="mt-1 max-w-xl text-sm font-medium text-slate-600">
                          Use o cadastro da Meta para vincular um número dedicado à API Oficial.
                        </p>
                      </div>
                    </div>
                    {!metaStatus?.connected && (
                      <Button
                        type="button"
                        onClick={() => void connectMeta('cloud_api')}
                        disabled={workingKey === 'whatsappOfficial' || !metaStatus?.serverSecretConfigured}
                        className="shrink-0 bg-slate-950 font-bold hover:bg-slate-800"
                      >
                        {workingKey === 'whatsappOfficial' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowRight size={16} className="mr-2" />}
                        Conectar com a Meta
                      </Button>
                    )}
                  </div>

                  <details className="group rounded-lg border border-slate-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-black text-slate-900">
                      <span className="flex items-center gap-2"><ShieldCheck size={17} className="text-slate-500" /> Configuração manual</span>
                      <ChevronDown size={17} className="text-slate-400 transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-5 border-t border-slate-100 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Phone Number ID</Label>
                      <Input
                        value={metaForm.phoneNumberId}
                        onChange={(event) => setMetaForm({ ...metaForm, phoneNumberId: event.target.value })}
                        placeholder="100234567890123"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>WhatsApp Business Account ID</Label>
                      <Input
                        value={metaForm.wabaId}
                        onChange={(event) => setMetaForm({ ...metaForm, wabaId: event.target.value })}
                        placeholder="100234567890456"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Permanent Access Token</Label>
                      <div className="relative">
                        <Input
                          type={showToken ? 'text' : 'password'}
                          value={metaForm.accessToken}
                          onChange={(event) => setMetaForm({ ...metaForm, accessToken: event.target.value })}
                          placeholder={metaStatus?.hasAccessToken ? 'Token salvo. Preencha apenas se quiser trocar.' : 'EAA...'}
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Webhook Verify Token</Label>
                      <Input
                        value={metaForm.webhookVerifyToken}
                        onChange={(event) => setMetaForm({ ...metaForm, webhookVerifyToken: event.target.value })}
                        placeholder="Crie uma chave sua"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Two-step PIN</Label>
                      <Input
                        value={metaForm.twoStepPin}
                        onChange={(event) => setMetaForm({ ...metaForm, twoStepPin: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="Opcional"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Webhook Callback URL</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input value={metaStatus?.webhookUrl || 'Salve a configuracao para gerar a URL'} readOnly className="bg-white font-mono text-xs" />
                      <Button type="button" variant="outline" onClick={() => copyText(metaStatus?.webhookUrl, 'URL')}>
                        <Copy size={16} className="mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      No painel da Meta, cole essa URL em Webhooks e use exatamente o Verify Token salvo acima.
                    </p>
                  </div>
                    </div>
                  </details>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={saveMetaConfig} disabled={workingKey === 'meta-save'} className="font-bold">
                      {workingKey === 'meta-save' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
                      Salvar WhatsApp Oficial
                    </Button>
                    <Button variant="outline" onClick={() => loadMetaStatus()} disabled={!!workingKey} className="font-bold">
                      Atualizar status
                    </Button>
                    {isIntegrationConnected('whatsappOfficial') && (
                      <Button variant="outline" onClick={disconnectMeta} disabled={workingKey === 'meta-disconnect'} className="font-bold text-red-600 hover:text-red-700">
                        {workingKey === 'meta-disconnect' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Unplug size={16} className="mr-2" />}
                        Desconectar
                      </Button>
                    )}
                  </div>

                  {isIntegrationConnected('whatsappOfficial') && <TemplateCatalog compact />}
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Status</p>
                    <p className={`mt-2 text-sm font-black ${isIntegrationConnected('whatsappOfficial') ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {isIntegrationConnected('whatsappOfficial') ? 'Conectado' : 'Pendente'}
                    </p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.25em] text-slate-400">Phone Number ID</p>
                    <p className="mt-2 break-all font-mono text-sm text-slate-900">{metaStatus?.phoneNumberId || '-'}</p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.25em] text-slate-400">Token</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{metaStatus?.hasAccessToken ? 'Salvo' : 'Nao salvo'}</p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.25em] text-slate-400">Modo oficial</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{metaStatus?.officialMode === 'coexistence' ? 'Coexistencia' : 'Cloud API'}</p>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <MessageCircle className="mb-2 h-5 w-5" />
                    <p className="font-black">Mensagem recebida vira lead</p>
                    <p className="mt-1 leading-relaxed">
                      O webhook identifica a clinica pelo Phone Number ID ou pela URL unica, cria o lead e salva a conversa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedIntegration === 'whatsappCoexistence' && (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="min-w-0 space-y-5">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                            <Smartphone size={20} />
                          </div>
                          <div>
                            <p className="font-black text-slate-950">Conectar o WhatsApp Business atual</p>
                            <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-slate-600">
                              O número continua funcionando no aplicativo e também passa a atender pelo SellClin.
                            </p>
                          </div>
                        </div>
                        {!metaStatus?.connected && (
                          <Button
                            onClick={() => void connectMeta('coexistence')}
                            disabled={workingKey === 'whatsappCoexistence' || !metaStatus?.coexistenceEnabled || !metaStatus?.coexistenceConfigured}
                            className="shrink-0 bg-emerald-600 font-bold hover:bg-emerald-700"
                          >
                            {workingKey === 'whatsappCoexistence' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowRight size={16} className="mr-2" />}
                            Conectar com a Meta
                          </Button>
                        )}
                      </div>
                    </div>

                    {(!metaStatus?.coexistenceEnabled || !metaStatus?.coexistenceConfigured) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                        A coexistencia ainda nao esta habilitada no servidor. Confira WHATSAPP_COEXISTENCE_ENABLED e META_WHATSAPP_COEXISTENCE_CONFIG_ID.
                      </div>
                    )}

                    <div className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
                      {[
                        ['01', 'Entrar com a Meta', 'Use o administrador da empresa.'],
                        ['02', 'Escolher o número', 'Selecione o WhatsApp Business atual.'],
                        ['03', 'Concluir', 'A conexão e o webhook são configurados.'],
                      ].map(([number, title, description]) => (
                        <div key={number} className="bg-white p-4">
                          <span className="text-[10px] font-black tracking-[0.2em] text-emerald-600">{number}</span>
                          <p className="mt-2 text-sm font-black text-slate-950">{title}</p>
                          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
                        </div>
                      ))}
                    </div>

                    {metaStatus?.connected && metaStatus.officialMode === 'coexistence' && <TemplateCatalog compact />}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Conexão</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${metaStatus?.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <p className="text-sm font-black text-slate-900">{metaStatus?.connected ? 'Ativa' : 'Pendente'}</p>
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Número</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{metaStatus?.displayPhoneNumber || 'Não informado'}</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => loadMetaStatus()} disabled={!!workingKey} className="w-full font-bold">
                      <RefreshCcw size={16} className="mr-2" /> Atualizar status
                    </Button>
                    {metaStatus?.connected && (!metaStatus?.webhookConfigured || !metaStatus?.coexistenceWebhookFieldsRequested || !metaStatus?.phoneNumberWebhookOverrideConfigured || !metaStatus?.lastPhoneEchoEvent) && (
                      <Button
                        onClick={() => void repairMetaWebhook()}
                        disabled={workingKey === 'meta-webhook-repair'}
                        className="w-full bg-emerald-600 font-bold hover:bg-emerald-700"
                      >
                        {workingKey === 'meta-webhook-repair' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCcw size={16} className="mr-2" />}
                        Reparar recebimento
                      </Button>
                    )}
                    {metaStatus?.connected && (
                      <div className={`rounded-lg border p-3 text-xs font-semibold ${metaStatus?.webhookConfigured ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {metaStatus?.webhookConfigured
                          ? 'Mensagens recebidas estao vinculadas a esta clinica.'
                          : (metaStatus?.webhookDiagnostic || 'A conexao esta ativa, mas o recebimento precisa ser configurado.')}
                      </div>
                    )}
                    {metaStatus?.connected && metaStatus?.webhookConfigured && (
                      <div className={`rounded-lg border p-3 text-xs font-semibold ${metaStatus?.lastPhoneEchoEvent ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {metaStatus.lastPhoneEchoEvent ? (
                          `Ultimo envio pelo celular recebido em ${new Date(metaStatus.lastPhoneEchoEvent.createdAt || '').toLocaleString('pt-BR')}.`
                        ) : metaStatus.coexistenceWebhookFieldsRequested && metaStatus.phoneNumberWebhookOverrideConfigured ? (
                          <div className="space-y-1">
                            <p className="font-black">Aguardando uma mensagem de teste do celular</p>
                            <p className="leading-relaxed">Envie uma mensagem pelo WhatsApp Business. Quando ela chegar ao SellClin, este aviso confirmara a sincronizacao.</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-black">Sincronizacao do celular pendente</p>
                            <p className="leading-relaxed">Clique em Reparar recebimento para solicitar a sincronizacao das mensagens enviadas pelo WhatsApp Business.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {metaStatus?.connected && (
                      <Button variant="outline" onClick={disconnectMeta} disabled={workingKey === 'meta-disconnect'} className="w-full font-bold text-red-600 hover:text-red-700">
                        {workingKey === 'meta-disconnect' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Unplug size={16} className="mr-2" />}
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedIntegration === 'whatsappUazapi' && (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-5">
                  {uazapiStatus?.serverConfigured === false && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                      A conexao por QR Code esta temporariamente indisponivel. Entre em contato com o suporte do SellClin.
                    </div>
                  )}

                  {uazapiStatus?.connected && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-5">
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-950">WhatsApp conectado</p>
                        <p className="mt-1 text-sm font-medium text-slate-600">{uazapiStatus.profileName || uazapiStatus.owner || 'Conexão ativa para esta clínica'}</p>
                      </div>
                    </div>
                  )}

                  {!uazapiStatus?.connected && (
                    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setUazapiMethod('qr')}
                        className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${uazapiMethod === 'qr' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <QrCode size={16} /> QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setUazapiMethod('pairing')}
                        className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${uazapiMethod === 'pairing' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <Smartphone size={16} /> Código
                      </button>
                    </div>
                  )}

                  {uazapiMethod === 'qr' && !uazapiStatus?.connected && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <QrCode className="mt-0.5 h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-950">Conectar com QR Code</p>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                          Abra WhatsApp no celular, acesse Aparelhos conectados e escaneie o codigo.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white p-5">
                      {qrCodeSource ? (
                        <img src={qrCodeSource} alt="QR Code para conectar WhatsApp" className="h-56 w-56 object-contain" />
                      ) : uazapiStatus?.connected ? (
                        <div className="text-center">
                          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                          <p className="mt-3 font-black text-slate-950">WhatsApp conectado</p>
                          <p className="mt-1 text-sm text-slate-500">{uazapiStatus.profileName || uazapiStatus.owner || 'Instancia ativa'}</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <QrCode className="mx-auto h-12 w-12 text-slate-300" />
                          <p className="mt-3 font-black text-slate-900">Pronto para gerar o QR Code</p>
                          <p className="mt-1 max-w-sm text-sm text-slate-500">Clique no botao abaixo para criar a instancia e iniciar a conexao.</p>
                        </div>
                      )}
                    </div>

                    {!uazapiStatus?.connected && (
                      <Button
                        onClick={() => connectUazapi(false)}
                        disabled={!!workingKey || uazapiPolling || uazapiStatus?.serverConfigured === false}
                        className="mt-4 w-full bg-emerald-600 font-bold hover:bg-emerald-700"
                      >
                        {workingKey === 'uazapi-qr' || uazapiPolling ? <Loader2 size={16} className="mr-2 animate-spin" /> : <QrCode size={16} className="mr-2" />}
                        {uazapiPolling ? 'Aguardando QR Code...' : 'Gerar QR Code'}
                      </Button>
                    )}
                  </div>
                  )}

                  {!uazapiStatus?.connected && uazapiMethod === 'pairing' && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                      <p className="font-black text-slate-950">Conectar sem QR Code</p>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Informe o telefone com DDI e DDD para gerar um codigo de pareamento.
                      </p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={uazapiPhone}
                          onChange={(event) => setUazapiPhone(event.target.value.replace(/\D/g, '').slice(0, 15))}
                          placeholder="5511999999999"
                          inputMode="numeric"
                        />
                        <Button
                          variant="outline"
                          onClick={() => connectUazapi(true)}
                          disabled={!!workingKey || uazapiPolling || uazapiStatus?.serverConfigured === false}
                          className="font-bold"
                        >
                          {workingKey === 'uazapi-pair' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCcw size={16} className="mr-2" />}
                          Gerar codigo
                        </Button>
                      </div>
                      {uazapiStatus?.pairingCode && (
                        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Codigo de pareamento</p>
                          <p className="mt-2 font-mono text-2xl font-black tracking-widest text-slate-950">{uazapiStatus.pairingCode}</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                <div className="min-w-0 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Status</p>
                    <p className={`mt-2 text-sm font-black ${uazapiStatus?.connected ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {uazapiStatus?.connected ? 'Conectado' : uazapiStatus?.configured ? 'Aguardando conexao' : 'Nao configurado'}
                    </p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.25em] text-slate-400">Instancia</p>
                    <p className="mt-2 break-all font-mono text-xs text-slate-900">{uazapiStatus?.instanceName || '-'}</p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.25em] text-slate-400">Webhook</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{uazapiStatus?.configured ? 'Configurado automaticamente' : 'Pendente'}</p>
                  </div>

                  <Button variant="outline" onClick={loadUazapiStatus} disabled={!!workingKey} className="w-full font-bold">
                    <RefreshCcw size={16} className="mr-2" />
                    Atualizar status
                  </Button>

                  {uazapiStatus?.configured && (
                    <Button
                      variant="outline"
                      onClick={disconnectUazapi}
                      disabled={workingKey === 'uazapi-disconnect'}
                      className="w-full font-bold text-red-600 hover:text-red-700"
                    >
                      {workingKey === 'uazapi-disconnect' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Unplug size={16} className="mr-2" />}
                      Remover instancia
                    </Button>
                  )}

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <MessageCircle className="mb-2 h-5 w-5" />
                    <p className="font-black">Mensagem recebida vira lead</p>
                    <p className="mt-1 leading-relaxed">Numeros novos entram no funil e a conversa fica salva sem duplicar mensagens.</p>
                  </div>
                </div>
              </div>
            )}

            {selectedIntegration === 'googleCalendar' && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 text-blue-600" size={22} />
                    <div className="min-w-0">
                      <p className="font-black text-slate-950">Google Calendar</p>
                      {googleCalendarStatus?.status === 'connected' ? (
                        <>
                          <p className="mt-2 text-sm font-medium text-emerald-700">Conta conectada</p>
                          <p className="mt-1 break-all text-sm text-slate-600">{googleCalendarStatus.googleEmail || 'Conta Google autorizada'}</p>
                        </>
                      ) : googleCalendarStatus?.status === 'error' ? (
                        <>
                          <p className="mt-2 text-sm font-medium text-red-700">Conexao precisa de atencao</p>
                          <p className="mt-1 text-sm leading-relaxed text-red-700">{googleCalendarStatus.lastError || 'O Google recusou a ultima sincronizacao.'}</p>
                        </>
                      ) : (
                        <>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">Conecte a conta Google da clinica para sincronizar os agendamentos.</p>
                          <Button onClick={connectGoogleCalendar} disabled={workingKey === 'googleCalendar'} className="mt-4 bg-slate-950 font-bold hover:bg-slate-800">
                            {workingKey === 'googleCalendar' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowRight size={16} className="mr-2" />}
                            Conectar Google Calendar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Ultima sincronizacao</p>
                    <p className="mt-2 text-sm font-black text-slate-950">
                      {googleCalendarStatus?.lastSyncAt ? new Date(googleCalendarStatus.lastSyncAt).toLocaleString('pt-BR') : 'Ainda nao realizada'}
                    </p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pendentes</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{googleCalendarStatus?.pendingCount || 0}</p>
                  </div>

                  <Button variant="outline" onClick={() => void loadGoogleCalendarStatus()} disabled={!!workingKey} className="w-full font-bold">
                    <RefreshCcw size={16} className="mr-2" /> Atualizar status
                  </Button>

                  {googleCalendarStatus?.status === 'connected' && (
                    <Button onClick={resyncGoogleCalendar} disabled={!!workingKey} className="w-full bg-slate-950 font-bold hover:bg-slate-800">
                      {workingKey === 'google-resync' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCcw size={16} className="mr-2" />}
                      Sincronizar agenda
                    </Button>
                  )}

                  {googleCalendarStatus?.connected && (
                    <Button variant="outline" onClick={disconnectGoogleCalendar} disabled={!!workingKey} className="w-full font-bold text-red-600 hover:text-red-700">
                      {workingKey === 'google-disconnect' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Unplug size={16} className="mr-2" />}
                      Desconectar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
