import { loadAllPages } from '@/lib/funnel';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  campaignsApi,
  leadsApi,
  clientsApi,
  whatsappMetaApi,
  whatsappTemplatesApi,
  whatsappUazapiApi,
} from '@/lib/api';
import { validateMediaUpload } from '@/lib/media-upload';
import { parseSpreadsheetContacts, renderSpreadsheetMessage, missingSpreadsheetVariables, SPREADSHEET_CONTACT_LIMIT, VARIABLE_FIELDS, type SpreadsheetContact, type SpreadsheetStats, type SpreadsheetImport } from '@/lib/campaign-spreadsheet';
import { SpreadsheetPreview, SpreadsheetContactPicker } from '@/components/campaigns/SpreadsheetPreview';
import type { WhatsAppTemplate } from '@/components/whatsapp/TemplateCatalog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Image as ImageIcon,
  Info,
  MessageSquareText,
  Paperclip,
  Plus,
  RefreshCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';

const safeFormat = (d: any, f: string = "dd/MM/yy 'às' HH:mm") => {
  try { return d ? format(new Date(d), f, { locale: ptBR }) : '—'; } catch { return '—'; }
};

const AUDIENCE_OPTIONS = [
  { value: 'all_leads', label: 'Todos os Leads', icon: 'person_add', desc: 'Enviar para todos os leads cadastrados' },
  { value: 'all_clients', label: 'Todos os Clientes', icon: 'group', desc: 'Enviar para todos os clientes cadastrados' },
  { value: 'both', label: 'Leads + Clientes', icon: 'groups', desc: 'Enviar para leads e clientes simultaneamente' },
  { value: 'leads_by_status', label: 'Leads por Etapa', icon: 'filter_alt', desc: 'Filtrar leads por etapa do funil' },
  { value: 'by_tags', label: 'Por Tags', icon: 'tag', desc: 'Filtrar contatos por tags específicas' },
  { value: 'spreadsheet', label: 'Planilha', icon: 'table_chart', desc: 'Importar contatos por CSV ou TSV' },
];

const CORE_VARIABLES = [
  { key: '{{nome}}', label: 'Nome completo' },
  { key: '{{primeiro_nome}}', label: 'Primeiro nome' },
  { key: '{{telefone}}', label: 'Telefone' },
];

const SPREADSHEET_VARIABLES = [
  { key: '{{data}}', label: 'Data da planilha' },
  { key: '{{hora}}', label: 'Hora da planilha' },
  { key: '{{especialista}}', label: 'Profissional da planilha' },
];

const APPOINTMENT_VARIABLES = [
  { key: '{{proxima_data}}', label: 'Data da próxima consulta' },
  { key: '{{proxima_hora}}', label: 'Hora da próxima consulta' },
  { key: '{{ultima_data}}', label: 'Data da última consulta' },
  { key: '{{ultima_hora}}', label: 'Hora da última consulta' },
  { key: '{{especialista}}', label: 'Profissional do agendamento' },
];

const getAvailableVariables = (audienceType: string) => [
  ...CORE_VARIABLES,
  ...(audienceType === 'spreadsheet' ? SPREADSHEET_VARIABLES : APPOINTMENT_VARIABLES),
];

const getTemplateBodyText = (template?: WhatsAppTemplate) =>
  template?.components?.find(component => String(component.type).toUpperCase() === 'BODY')?.text || '';

const getTemplateVariableTokens = (template?: WhatsAppTemplate) => {
  const uniqueTokens = Array.from(new Set(
    (getTemplateBodyText(template).match(/\{\{[^}]+\}\}/g) || [])
      .map(token => token.slice(2, -2).trim())
      .filter(Boolean),
  ));
  if (String(template?.parameterFormat || '').toUpperCase() === 'NAMED') return uniqueTokens;
  return uniqueTokens.sort((left, right) => Number(left) - Number(right));
};

const getTemplateHeaderMediaType = (template?: WhatsAppTemplate): 'image' | 'video' | null => {
  const header = template?.components?.find(component => String(component.type).toUpperCase() === 'HEADER');
  const format = String((header as any)?.format || '').toUpperCase();
  if (format === 'IMAGE') return 'image';
  if (format === 'VIDEO') return 'video';
  return null;
};

const renderPreviewMessage = (value: string) => value
  .replace(/\{\{nome\}\}/gi, 'Mariana Oliveira')
  .replace(/\{\{primeiro_nome\}\}/gi, 'Mariana')
  .replace(/\{\{telefone\}\}/gi, '(11) 99999-9999')
  .replace(/\{\{data\}\}/gi, '25/07/2026')
  .replace(/\{\{hora\}\}/gi, '14:30')
  .replace(/\{\{especialista\}\}/gi, 'Dra. Ana')
  .replace(/\{\{proxima_data\}\}/gi, '25/07/2026')
  .replace(/\{\{proxima_hora\}\}/gi, '14:30')
  .replace(/\{\{ultima_data\}\}/gi, '10/06/2026')
  .replace(/\{\{ultima_hora\}\}/gi, '09:00');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderTemplatePreview = (template: WhatsAppTemplate | undefined, mappings: string[], render = renderPreviewMessage) => {
  const body = getTemplateBodyText(template) || 'Selecione um template aprovado.';
  return getTemplateVariableTokens(template).reduce((preview, token, index) => {
    const sample = render(mappings[index] || '{{nome}}');
    return preview.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'g'), () => sample);
  }, body);
};

type CampaignProvider = 'meta' | 'uazapi';

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-600', icon: 'edit_note' },
  scheduled: { label: 'Agendada', color: 'bg-blue-100 text-blue-700', icon: 'schedule' },
  sending: { label: 'Enviando...', color: 'bg-amber-100 text-amber-700', icon: 'send' },
  completed: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700', icon: 'error' },
  canceled: { label: 'Cancelada', color: 'bg-slate-100 text-slate-500', icon: 'cancel' },
};

const SPREADSHEET_TEMPLATE_FILE = 'modelo-disparo-sellclin.csv';
const SPREADSHEET_TEMPLATE_ROWS = [
  ['nome', 'telefone', 'data', 'hora', 'especialista'],
  ['Joao Silva', '5511999999999', '15/07/2026', '14:30', 'Dra. Ana'],
  ['Maria Souza', '5511988887777', '16/07/2026', '09:00', 'Dr. Pedro'],
  ['Clinica Exemplo', '11977776666', '17/07/2026', '11:15', 'Equipe SellClin'],
];


function downloadSpreadsheetTemplate() {
  const csv = SPREADSHEET_TEMPLATE_ROWS
    .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = SPREADSHEET_TEMPLATE_FILE;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Campaigns() {
  const { professional, hasPermission } = useAuth();
  const allowAction = useActionPermission();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [viewCampaign, setViewCampaign] = useState<any>(null);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Create form state
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [previewRecipients, setPreviewRecipients] = useState(0);

  // Media attachments
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | ''>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [attachments, setAttachments] = useState<{ url: string; type: 'image' | 'video' | 'audio' }[]>([]);

  // Delay settings
  const [minDelay, setMinDelay] = useState(180);
  const [maxDelay, setMaxDelay] = useState(200);

  // Anti-ban variations
  const [randomize, setRandomize] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [newVariation, setNewVariation] = useState('');
  const [campaignProvider, setCampaignProvider] = useState<CampaignProvider | ''>('');
  const [metaStatus, setMetaStatus] = useState<any>(null);
  const [uazapiStatus, setUazapiStatus] = useState<any>(null);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [metaTemplateId, setMetaTemplateId] = useState('');
  const [metaTemplateMappings, setMetaTemplateMappings] = useState<string[]>([]);
  const [approvedTemplates, setApprovedTemplates] = useState<WhatsAppTemplate[]>([]);

  // Tags filter states
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagTarget, setTagTarget] = useState<'both' | 'leads' | 'clients'>('both');
  const [spreadsheetContacts, setSpreadsheetContacts] = useState<SpreadsheetContact[]>([]);
  const [spreadsheetFileName, setSpreadsheetFileName] = useState('');
  const [spreadsheetStats, setSpreadsheetStats] = useState<SpreadsheetStats | null>(null);
  const [spreadsheetImport, setSpreadsheetImport] = useState<SpreadsheetImport | null>(null);
  const [previewContactIndex, setPreviewContactIndex] = useState(0);

  const listRequest = useRef(0);
  const loadCampaigns = useCallback(async () => {
    const request = ++listRequest.current;
    setIsLoading(true);
    try {
      const data = await loadAllPages(campaignsApi.getAll);
      if (request === listRequest.current) setCampaigns(data);
    } catch (error) {
      if (request !== listRequest.current) return;
      setCampaigns([]);
      {
        toast({ title: "Erro ao carregar campanhas", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
      }
    }
    finally { if (request === listRequest.current) setIsLoading(false); }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    void whatsappTemplatesApi.list('APPROVED').then((response) => {
      if (response.success) setApprovedTemplates(response.data || []);
    });
  }, []);

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true);
    try {
      const [metaResponse, uazapiResponse] = await Promise.allSettled([
        whatsappMetaApi.status(),
        whatsappUazapiApi.status(),
      ]);
      const nextMetaStatus = metaResponse.status === 'fulfilled' && metaResponse.value.success
        ? metaResponse.value.data
        : null;
      const nextUazapiStatus = uazapiResponse.status === 'fulfilled' && uazapiResponse.value.success
        ? uazapiResponse.value.data
        : null;
      setMetaStatus(nextMetaStatus);
      setUazapiStatus(nextUazapiStatus);
      setCampaignProvider(current => {
        if (current === 'meta' && nextMetaStatus?.connected) return current;
        if (current === 'uazapi' && nextUazapiStatus?.connected) return current;
        if (nextMetaStatus?.connected) return 'meta';
        if (nextUazapiStatus?.connected) return 'uazapi';
        return '';
      });
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  useEffect(() => { void loadConnections(); }, [loadConnections]);

  // Load available tags dynamically
  useEffect(() => {
    if (!professional?.id) return;
    (async () => {
      try {
        const tagsSet = new Set<string>();
        const [rLeads, rClients] = await Promise.all([
          leadsApi.getAll({ pageSize: 1000 }),
          clientsApi.getAll({ pageSize: 1000 })
        ]);
        if (rLeads.success && rLeads.data) {
          rLeads.data.forEach((l: any) => {
            if (Array.isArray(l.tags)) l.tags.forEach((t: string) => { if (t) tagsSet.add(t); });
          });
        }
        if (rClients.success && rClients.data) {
          rClients.data.forEach((c: any) => {
            if (Array.isArray(c.tags)) c.tags.forEach((t: string) => { if (t) tagsSet.add(t); });
          });
        }
        setAvailableTags(Array.from(tagsSet).sort());
      } catch (e) {
        console.error('Error fetching tags:', e);
      }
    })();
  }, [professional?.id, campaigns]);

  // Preview count when audience changes
  useEffect(() => {
    if (!audienceType || !professional?.id) { setPreviewRecipients(0); return; }
    if (audienceType === 'spreadsheet') {
      setPreviewRecipients(spreadsheetContacts.length);
      return;
    }
    (async () => {
      try {
        let count = 0;
        if (audienceType === 'by_tags') {
          if (selectedTags.length === 0) { setPreviewRecipients(0); return; }
          if (tagTarget === 'leads' || tagTarget === 'both') {
            const r = await leadsApi.getAll({ professionalId: Number(professional.id), pageSize: 1000 });
            if (r.success) {
              count += (r.data || []).filter((l: any) => 
                l.phone && 
                Array.isArray(l.tags) && 
                l.tags.some((t: string) => selectedTags.includes(t))
              ).length;
            }
          }
          if (tagTarget === 'clients' || tagTarget === 'both') {
            const r = await clientsApi.getAll({ pageSize: 1000 });
            if (r.success) {
              count += (r.data || []).filter((c: any) => 
                c.phone && 
                Array.isArray(c.tags) && 
                c.tags.some((t: string) => selectedTags.includes(t))
              ).length;
            }
          }
        } else {
          if (audienceType === 'all_leads' || audienceType === 'leads_by_status' || audienceType === 'both') {
            const r = await leadsApi.getAll({ professionalId: Number(professional.id), pageSize: 1000 });
            if (r.success) count += (r.data || []).filter((l: any) => l.phone).length;
          }
          if (audienceType === 'all_clients' || audienceType === 'both') {
            const r = await clientsApi.getAll({ pageSize: 1000 });
            if (r.success) count += (r.data || []).filter((c: any) => c.phone).length;
          }
        }
        setPreviewRecipients(count);
      } catch { setPreviewRecipients(0); }
    })();
  }, [audienceType, professional?.id, selectedTags, tagTarget, spreadsheetContacts.length]);

  const resetForm = () => {
    setStep(1); setName(''); setMessage(''); setAudienceType(''); setSelectedTags([]); setTagTarget('both');
    setMediaUrl(''); setMediaType(''); setMinDelay(180); setMaxDelay(200); setRandomize(false); setVariations([]); setNewVariation('');
    setCampaignProvider(metaStatus?.connected ? 'meta' : uazapiStatus?.connected ? 'uazapi' : '');
    setMetaTemplateId(''); setMetaTemplateMappings([]);
    setAttachments([]); setSpreadsheetContacts([]); setSpreadsheetFileName(''); setSpreadsheetStats(null);
    setSpreadsheetImport(null); setPreviewContactIndex(0);
    setIsCreating(false);
  };

  const handleSpreadsheetFile = async (file?: File | null) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.tsv') && !lowerName.endsWith('.txt')) {
      toast({ title: 'Use CSV ou TSV', description: 'Exporte a planilha com colunas nome, telefone, data, hora e especialista.', variant: 'destructive' });
      return;
    }

    setSpreadsheetImport(null); setSpreadsheetContacts([]); setSpreadsheetStats(null); setSpreadsheetFileName(''); setPreviewContactIndex(0);
    let imported: SpreadsheetImport;
    try {
      imported = parseSpreadsheetContacts(await file.text());
    } catch (error) {
      toast({ title: 'Não foi possível importar', description: error instanceof Error ? error.message : 'Confira o arquivo e tente novamente.', variant: 'destructive' });
      return;
    }
    const { contacts, stats } = imported;
    if (stats.missingPhoneColumn) {
      toast({ title: 'Coluna de telefone ausente', description: 'Use uma coluna chamada telefone, whatsapp, celular, phone ou numero.', variant: 'destructive' });
      return;
    }
    if (contacts.length === 0) {
      toast({ title: 'Nenhum contato encontrado', description: 'A planilha precisa ter uma coluna telefone, whatsapp ou celular.', variant: 'destructive' });
      return;
    }

    setSpreadsheetContacts(contacts);
    setSpreadsheetImport(imported);
    setSpreadsheetFileName(file.name);
    setSpreadsheetStats(stats);
    setPreviewRecipients(contacts.length);
    toast({ title: 'Planilha importada', description: `${contacts.length} contatos validos. ${stats.duplicateRows} duplicados e ${stats.invalidRows} invalidos ignorados.` });
  };

  const uploadCampaignMedia = async (
    file: File,
    options: { replace?: boolean; expectedType?: 'image' | 'video' } = {},
  ) => {
    const validation = validateMediaUpload(file);
    if (!validation.type) {
      toast({ title: 'Arquivo nao suportado', description: validation.error, variant: 'destructive' });
      return;
    }
    const localType = validation.type;

    if (options.expectedType && localType !== options.expectedType) {
      toast({
        title: options.expectedType === 'image' ? 'Selecione uma imagem' : 'Selecione um video',
        description: 'O arquivo precisa corresponder ao cabecalho aprovado no template da Meta.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingMedia(true);
    try {
      const response = await campaignsApi.uploadMedia(file);
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Falha no upload do arquivo');

      const attachment = { url: response.data.url, type: response.data.mediaType };
      setAttachments(previous => options.replace ? [attachment] : [...previous, attachment]);
      toast({ title: 'Midia pronta para envio' });
    } catch (error: any) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleCreate = async () => {
    if (!allowAction('campanhas', 'criarCampanhas')) return;
    if (!name.trim() || !audienceType || !campaignProvider) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return;
    }
    if (audienceType === 'by_tags' && selectedTags.length === 0) {
      toast({ title: 'Selecione pelo menos uma tag', variant: 'destructive' }); return;
    }
    if (audienceType === 'spreadsheet' && spreadsheetContacts.length === 0) {
      toast({ title: 'Importe uma planilha', description: 'Use CSV ou TSV com colunas nome, telefone, data, hora e especialista.', variant: 'destructive' }); return;
    }
    if (campaignProvider === 'meta' && !metaTemplateId) {
      toast({ title: 'Selecione um template aprovado', description: 'O canal oficial envia campanhas somente com templates sincronizados da Meta.', variant: 'destructive' }); return;
    }
    if (campaignProvider === 'meta' && metaTemplateMappings.some(mapping => !mapping)) {
      toast({ title: 'Vincule todas as variaveis', description: 'Escolha o dado usado em cada variavel do template.', variant: 'destructive' }); return;
    }
    const requiredHeaderMediaType = getTemplateHeaderMediaType(selectedMetaTemplate);
    if (campaignProvider === 'meta' && requiredHeaderMediaType && attachments[0]?.type !== requiredHeaderMediaType) {
      toast({
        title: requiredHeaderMediaType === 'image' ? 'Adicione a imagem do template' : 'Adicione o video do template',
        description: 'O cabecalho aprovado pela Meta exige esta midia antes de criar a campanha.',
        variant: 'destructive',
      });
      return;
    }
    if (campaignProvider === 'uazapi' && !message.trim()) {
      toast({ title: 'Escreva a mensagem', variant: 'destructive' }); return;
    }
    setIsSending(true);
    try {
      const baseAudienceFilter = audienceType === 'by_tags'
        ? { tags: selectedTags, target: tagTarget }
        : audienceType === 'spreadsheet'
          ? { source: spreadsheetFileName, contacts: spreadsheetContacts, stats: spreadsheetStats }
          : undefined;
      const audienceFilter = baseAudienceFilter;
      
      let finalMediaUrl = null;
      let finalMediaType = null;

      if (campaignProvider === 'meta' && requiredHeaderMediaType && attachments[0]) {
        finalMediaUrl = attachments[0].url;
        finalMediaType = attachments[0].type;
      } else if (campaignProvider === 'uazapi' && attachments.length > 0) {
        if (attachments.length === 1) {
          finalMediaUrl = attachments[0].url;
          finalMediaType = attachments[0].type;
        } else {
          finalMediaUrl = JSON.stringify(attachments);
          finalMediaType = attachments[0].type;
        }
      } else if (campaignProvider === 'uazapi' && mediaUrl.trim()) {
        finalMediaUrl = mediaUrl.trim();
        finalMediaType = mediaType || 'image';
      }

      const res = await campaignsApi.create({ 
        name, 
        message: campaignProvider === 'meta' ? getTemplateBodyText(selectedMetaTemplate) : message,
        audienceType, 
        audienceFilter,
        provider: campaignProvider,
        connectionMode: campaignProvider === 'meta'
          ? (metaStatus?.officialMode === 'coexistence' ? 'coexistence' : 'cloud_api')
          : 'unofficial',
        templateParameterMappings: campaignProvider === 'meta' ? metaTemplateMappings : undefined,
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        minDelay: campaignProvider === 'uazapi' ? Number(minDelay) : 0,
        maxDelay: campaignProvider === 'uazapi' ? Number(maxDelay) : 0,
        randomize: campaignProvider === 'uazapi' && randomize,
        variations: campaignProvider === 'uazapi' && randomize && variations.length > 0 ? variations : null,
        templateId: campaignProvider === 'meta' ? Number(metaTemplateId) : null,
      });
      if (res.success) {
        toast({ title: 'Campanha criada!' });
        resetForm(); loadCampaigns();
      } else {
        toast({ title: res.error?.message || 'Erro ao criar', variant: 'destructive' });
      }
    } catch { toast({ title: 'Erro ao criar campanha', variant: 'destructive' }); }
    finally { setIsSending(false); }
  };

  const handleSend = async (id: number) => {
    if (!allowAction('campanhas', 'criarCampanhas')) return;
    try {
      const res = await campaignsApi.send(id);
      if (res.success) {
        toast({
          title: 'Campanha iniciada!',
        });
        loadCampaigns();
        // Poll progress
        const interval = setInterval(async () => {
          const p = await campaignsApi.getProgress(id);
          if (p.success && (p.data.status === 'completed' || p.data.status === 'failed')) {
            clearInterval(interval);
            loadCampaigns();
            toast({ title: p.data.status === 'completed' ? 'Campanha concluída!' : 'Campanha falhou' });
          } else { loadCampaigns(); }
        }, 3000);
      } else {
        toast({
          title: res.error?.message || 'Erro ao enviar',
          variant: 'destructive',
        });
      }
    } catch { toast({ title: 'Erro ao enviar', variant: 'destructive' }); }
  };

  const handleDelete = async (id: number) => {
    if (!allowAction('campanhas', 'excluirCampanhas')) return;
    try {
      const res = await campaignsApi.delete(id);
      if (res.success) { toast({ title: 'Campanha excluída' }); loadCampaigns(); }
    } catch { toast({ title: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const viewDetails = async (id: number) => {
    setIsViewLoading(true);
    try {
      const res = await campaignsApi.getById(id);
      if (res.success) setViewCampaign(res.data);
    } catch { toast({ title: 'Erro ao carregar detalhes', variant: 'destructive' }); }
    finally { setIsViewLoading(false); }
  };

  const insertVariable = (v: string) => setMessage(prev => prev + v);

  const availableMessageVariables = getAvailableVariables(audienceType);
  const selectedMetaTemplate = approvedTemplates.find(template => String(template.id) === metaTemplateId);
  const selectedTemplateTokens = getTemplateVariableTokens(selectedMetaTemplate);
  const selectedTemplateHeaderMediaType = getTemplateHeaderMediaType(selectedMetaTemplate);
  const metaParameterValues = metaTemplateMappings;
  const previewContact = audienceType === 'spreadsheet' ? spreadsheetContacts[previewContactIndex] : undefined;
  const renderCurrentPreview = audienceType === 'spreadsheet'
    ? (value: string) => previewContact ? renderSpreadsheetMessage(value, previewContact) : ''
    : renderPreviewMessage;
  const previewVariableText = campaignProvider === 'meta'
    ? selectedTemplateTokens.map((_, index) => metaTemplateMappings[index] || '{{nome}}').join(' ')
    : message;
  const missingPreviewValues = previewContact ? missingSpreadsheetVariables(previewVariableText, previewContact) : [];
  const contactsWithMissingValues = audienceType === 'spreadsheet'
    ? spreadsheetContacts.filter(contact => missingSpreadsheetVariables(previewVariableText, contact).length > 0).length
    : 0;
  const messagePreview = campaignProvider === 'meta'
    ? renderTemplatePreview(selectedMetaTemplate, metaTemplateMappings, renderCurrentPreview)
    : renderCurrentPreview(message || 'Sua mensagem aparecerá aqui.');
  const updateMetaParameter = (index: number, value: string) => {
    const next = Array.from({ length: Math.max(selectedTemplateTokens.length, index + 1) }, (_, parameterIndex) =>
      metaParameterValues[parameterIndex] || availableMessageVariables[parameterIndex]?.key || '{{nome}}'
    );
    next[index] = value;
    setMetaTemplateMappings(next);
  };

  const selectApprovedTemplate = (value: string) => {
    setMetaTemplateId(value);
    setAttachments([]);
    const selected = approvedTemplates.find(template => String(template.id) === value);
    if (!selected) return;

    const bodyText = getTemplateBodyText(selected);
    const templateTokens = getTemplateVariableTokens(selected);
    const defaultParameters = templateTokens.map((token, index) => {
      const normalizedToken = `{{${token}}}`.toLowerCase();
      const matchingVariable = availableMessageVariables.find(variable => variable.key.toLowerCase() === normalizedToken);
      return matchingVariable?.key || availableMessageVariables[index]?.key || '{{nome}}';
    });
    setMetaTemplateMappings(defaultParameters);
    if (bodyText) setMessage(bodyText);
  };

  const syncApprovedTemplates = async () => {
    setIsSyncingTemplates(true);
    try {
      const response = await whatsappTemplatesApi.sync();
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel sincronizar os templates.');
      const approved = (response.data || []).filter(template => String(template.status).toUpperCase() === 'APPROVED');
      setApprovedTemplates(approved);
      toast({ title: 'Templates sincronizados', description: `${approved.length} template(s) aprovado(s) disponivel(is).` });
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  const validateMessageStep = () => {
    if (!campaignProvider) {
      toast({ title: 'Escolha o canal de envio', variant: 'destructive' });
      return;
    }
    if (campaignProvider === 'meta') {
      if (!metaTemplateId) {
        toast({ title: 'Selecione um template aprovado', variant: 'destructive' });
        return;
      }
      if (metaTemplateMappings.length !== selectedTemplateTokens.length || metaTemplateMappings.some(mapping => !mapping)) {
        toast({ title: 'Vincule todas as variaveis do template', variant: 'destructive' });
        return;
      }
      if (selectedTemplateHeaderMediaType && attachments[0]?.type !== selectedTemplateHeaderMediaType) {
        toast({
          title: selectedTemplateHeaderMediaType === 'image' ? 'Adicione a imagem do template' : 'Adicione o video do template',
          description: 'O cabecalho aprovado pela Meta exige esta midia.',
          variant: 'destructive',
        });
        return;
      }
    } else if (!message.trim()) {
      toast({ title: 'Escreva a mensagem', variant: 'destructive' });
      return;
    }
    setStep(3);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">Dispare mensagens automáticas para leads e clientes via WhatsApp.</p>
        </div>
        <Button disabled={!hasPermission('campanhas', 'criarCampanhas')} onClick={() => setIsCreating(true)} className="bg-secondary hover:bg-secondary/90 text-white rounded-xl px-6 h-11 font-bold shadow-lg shadow-secondary/20">
          <span className="material-symbols-outlined mr-2 text-lg">campaign</span>
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: campaigns.length, icon: 'mail', color: 'text-blue-600 bg-blue-50' },
          { label: 'Enviadas', value: campaigns.filter(c => c.status === 'completed').length, icon: 'check_circle', color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Rascunhos', value: campaigns.filter(c => c.status === 'draft').length, icon: 'edit_note', color: 'text-slate-600 bg-slate-50' },
          { label: 'Em envio', value: campaigns.filter(c => c.status === 'sending').length, icon: 'send', color: 'text-amber-600 bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
              <span className="material-symbols-outlined text-xl">{s.icon}</span>
            </div>
            <div><p className="text-2xl font-bold text-primary">{s.value}</p><p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="font-bold text-primary text-sm uppercase tracking-wider">Histórico de Campanhas</h2>
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <Input 
              placeholder="Buscar campanha..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-9 h-9 rounded-xl text-xs bg-slate-50/50 focus:bg-white transition-colors"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span><p className="mt-2 text-sm">Carregando...</p></div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200">campaign</span>
            <p className="mt-3 text-muted-foreground font-medium">Nenhuma campanha criada ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Crie sua primeira campanha de mensagens em massa!</p>
          </div>
        ) : campaigns.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200">search_off</span>
            <p className="mt-3 text-muted-foreground font-medium">Nenhuma campanha encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">Tente buscar por outro termo ou nome.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {campaigns
              .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((c) => {
                const st = STATUS_MAP[c.status] || STATUS_MAP.draft;
                return (
                  <div key={c.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${st.color}`}>
                      <span className="material-symbols-outlined text-xl">{st.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-primary text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.totalRecipients} destinatários • {safeFormat(c.createdAt)}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      {c.status === 'sending' && (
                        <div className="flex items-center gap-2 mr-2">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${c.totalRecipients ? (c.sentCount / c.totalRecipients) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{c.sentCount}/{c.totalRecipients}</span>
                        </div>
                      )}
                      {c.status === 'completed' && (
                        <span className="text-xs text-muted-foreground font-mono mr-2">
                          ✅ {c.sentCount} • ❌ {c.failedCount}
                        </span>
                      )}
                      <Badge className={`${st.color} border-0 text-[10px] font-bold`}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => viewDetails(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors" title="Detalhes">
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>
                      {c.status === 'draft' && (
                        <button onClick={() => handleSend(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Enviar">
                          <span className="material-symbols-outlined text-lg">send</span>
                        </button>
                      )}
                      {c.status !== 'sending' && (
                        <button 
                          onClick={() => {
                            if (window.confirm(`Deseja realmente excluir a campanha "${c.name}"? Esta ação é irreversível.`)) {
                              handleDelete(c.id);
                            }
                          }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" 
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ═══ CREATE CAMPAIGN DIALOG ═══ */}
      <Dialog open={isCreating} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent role="dialog" aria-modal="true" aria-label="Nova campanha" className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden bg-[#f7f9fc] p-0 sm:h-[min(900px,94dvh)] sm:max-h-[94dvh] sm:w-[calc(100vw-2rem)] sm:max-w-[1180px] sm:rounded-2xl sm:p-0">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
            <DialogHeader className="pr-10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Nova campanha</p>
                  <DialogTitle className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                    {step === 1 ? 'Escolha quem vai receber' : step === 2 ? 'Prepare a mensagem' : 'Revise antes de criar'}
                  </DialogTitle>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                  {[
                    { value: 1, label: 'Público', icon: Users },
                    { value: 2, label: 'Mensagem', icon: MessageSquareText },
                    { value: 3, label: 'Revisão', icon: CheckCircle2 },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => item.value < step && setStep(item.value)}
                        disabled={item.value > step}
                        className={`flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                          item.value === step
                            ? 'bg-white text-slate-950 shadow-sm'
                            : item.value < step
                              ? 'text-slate-600 hover:bg-white/70'
                              : 'cursor-default text-slate-400'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${item.value <= step ? 'text-orange-600' : ''}`} />
                        <span className="hidden sm:inline">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </DialogHeader>
          </div>
          <div key={step} data-campaign-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-7">

            {step === 1 && (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <label className="mb-2 block text-xs font-bold text-slate-700">Nome da campanha</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Confirmação de consultas de julho" className="h-11 rounded-lg border-slate-200" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <div className="mb-4">
                    <p className="text-sm font-black text-slate-950">Selecione o público</p>
                    <p className="mt-1 text-xs text-slate-500">O sistema valida os telefones e remove duplicados antes de criar a campanha.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {AUDIENCE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setAudienceType(opt.value)}
                        className={`min-h-28 rounded-lg border p-3 text-left transition-all ${audienceType === opt.value ? 'border-orange-300 bg-orange-50 ring-1 ring-orange-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-lg ${audienceType === opt.value ? 'text-orange-600' : 'text-slate-400'}`}>{opt.icon}</span>
                          <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                          {audienceType === opt.value && <Check className="ml-auto h-4 w-4 text-orange-600" />}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  {audienceType === 'by_tags' && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/60 space-y-4">
                      {/* Target Select */}
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Quem deve receber?</label>
                        <div className="flex gap-2">
                          {[
                            { value: 'both', label: 'Todos' },
                            { value: 'leads', label: 'Apenas Leads' },
                            { value: 'clients', label: 'Apenas Clientes' },
                          ].map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setTagTarget(t.value as any)}
                              className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                tagTarget === t.value
                                  ? 'bg-secondary text-white border-secondary shadow-md shadow-secondary/15'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tag list */}
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Selecione as Tags</label>
                        {availableTags.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma tag cadastrada no sistema.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white rounded-xl border border-slate-100">
                            {availableTags.map((tag) => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() =>
                                    setSelectedTags((prev) =>
                                      isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                                    )
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20'
                                      : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {isSelected ? 'check_box' : 'add'}
                                  </span>
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {audienceType === 'spreadsheet' && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/60 space-y-4">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Arquivo da planilha</label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={downloadSpreadsheetTemplate}
                            className="h-8 rounded-lg text-[11px] font-bold"
                          >
                            <span className="material-symbols-outlined mr-1 text-sm">download</span>
                            Baixar modelo
                          </Button>
                        </div>
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4">
                          <input
                            type="file"
                            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                            onChange={e => handleSpreadsheetFile(e.target.files?.[0])}
                            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-primary/90"
                          />
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Baixe o modelo, preencha os contatos e salve como CSV. Use <strong>nome</strong>, <strong>telefone</strong>, <strong>data</strong>, <strong>hora</strong> e <strong>especialista</strong>.
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                            Exemplo: nome;telefone;data;hora;especialista
                          </p>
                        </div>
                      </div>

                      {spreadsheetContacts.length > 0 && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            {spreadsheetContacts.length} contatos importados de {spreadsheetFileName}
                          </div>
                          {spreadsheetStats && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                              <span className="rounded-lg bg-white/70 px-2 py-1 text-slate-700">
                                {spreadsheetStats.totalImported} linhas
                              </span>
                              <span className="rounded-lg bg-white/70 px-2 py-1 text-emerald-700">
                                {spreadsheetStats.validRows} validos
                              </span>
                              <span className="rounded-lg bg-white/70 px-2 py-1 text-amber-700">
                                {spreadsheetStats.duplicateRows} duplicados
                              </span>
                              <span className="rounded-lg bg-white/70 px-2 py-1 text-red-700">
                                {spreadsheetStats.invalidRows} invalidos
                              </span>
                            </div>
                          )}
                          {spreadsheetStats?.truncated && (
                            <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                              A planilha passou de {SPREADSHEET_CONTACT_LIMIT} contatos. Apenas os primeiros {SPREADSHEET_CONTACT_LIMIT} foram considerados.
                            </p>
                          )}
                          {spreadsheetImport && <SpreadsheetPreview data={spreadsheetImport} index={previewContactIndex} onSelect={setPreviewContactIndex} fileName={spreadsheetFileName} />}
                        </div>
                      )}
                    </div>
                  )}
                  {audienceType && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-secondary">group</span>
                      <strong>{previewRecipients}</strong> destinatários com telefone válido
                    </p>
                  )}
                </div>
                </div>
                <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    {audienceType === 'spreadsheet' ? <FileSpreadsheet className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-950">Resumo do público</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {audienceType ? AUDIENCE_OPTIONS.find(option => option.value === audienceType)?.desc : 'Escolha uma fonte para calcular os destinatários.'}
                  </p>
                  <div className="mt-5 rounded-lg bg-slate-950 px-4 py-4 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Contatos válidos</p>
                    <p className="mt-1 text-3xl font-black">{previewRecipients}</p>
                  </div>
                  {audienceType === 'spreadsheet' && spreadsheetFileName && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="truncate">{spreadsheetFileName}</span>
                    </div>
                  )}
                </aside>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Canal de envio</p>
                      <p className="mt-1 text-xs text-slate-500">A campanha usa somente o canal escolhido abaixo.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadConnections()} disabled={connectionsLoading}>
                      <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${connectionsLoading ? 'animate-spin' : ''}`} />
                      Atualizar conexões
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                    <button type="button" disabled={!metaStatus?.connected} onClick={() => setCampaignProvider('meta')}
                      className={`flex min-h-28 min-w-0 items-start gap-3 rounded-lg border p-4 text-left transition ${campaignProvider === 'meta' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'} disabled:cursor-not-allowed disabled:opacity-50`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><ShieldCheck className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm text-slate-950">WhatsApp Oficial</strong>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${metaStatus?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{metaStatus?.connected ? 'Conectado' : 'Não conectado'}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{metaStatus?.officialMode === 'coexistence' ? 'Coexistência Meta' : 'Cloud API'} · exige template aprovado.</span>
                      </span>
                    </button>

                    <button type="button" disabled={!uazapiStatus?.connected} onClick={() => setCampaignProvider('uazapi')}
                      className={`flex min-h-28 min-w-0 items-start gap-3 rounded-lg border p-4 text-left transition ${campaignProvider === 'uazapi' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'} disabled:cursor-not-allowed disabled:opacity-50`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><MessageSquareText className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm text-slate-950">WhatsApp Não Oficial</strong>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${uazapiStatus?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{uazapiStatus?.connected ? 'Conectado' : 'Não conectado'}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">Mensagem livre, mídia e intervalo entre envios.</span>
                      </span>
                    </button>
                  </div>

                  {!connectionsLoading && !metaStatus?.connected && !uazapiStatus?.connected && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-800">Conecte pelo menos um WhatsApp antes de criar a campanha.</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => navigate('/integrations')}>Abrir integrações</Button>
                    </div>
                  )}
                </section>

                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-5">
                {audienceType === 'spreadsheet' && spreadsheetImport && (
                  <SpreadsheetPreview data={spreadsheetImport} index={previewContactIndex} onSelect={setPreviewContactIndex} fileName={spreadsheetFileName} />
                )}
                {campaignProvider === 'uazapi' && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Personalização</p>
                      <p className="mt-1 text-xs text-slate-500">Variáveis disponíveis para {AUDIENCE_OPTIONS.find(option => option.value === audienceType)?.label.toLowerCase()}.</p>
                    </div>
                    <Sparkles className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableMessageVariables.map(v => (
                      <button key={v.key} onClick={() => insertVariable(v.key)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-orange-300 hover:bg-orange-50">
                        <span className="block font-mono text-[11px] font-bold text-orange-700">{v.key}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-slate-500">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {campaignProvider === 'meta' && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/70 p-5 lg:col-start-1">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Template aprovado da Meta</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">O texto, idioma e variáveis vêm do template sincronizado.</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void syncApprovedTemplates()} disabled={isSyncingTemplates}>
                      <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${isSyncingTemplates ? 'animate-spin' : ''}`} /> Sincronizar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 border-t border-blue-200 pt-4">
                      {approvedTemplates.length > 0 ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Template aprovado</label>
                          <Select value={metaTemplateId} onValueChange={selectApprovedTemplate}>
                            <SelectTrigger className="h-11 min-w-0 rounded-lg bg-white"><SelectValue placeholder="Selecione um template aprovado">{selectedMetaTemplate ? `${selectedMetaTemplate.name} · ${selectedMetaTemplate.language}` : undefined}</SelectValue></SelectTrigger>
                            <SelectContent>{approvedTemplates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name} · {template.language} · {template.category}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-blue-300 bg-white p-4 text-center">
                          <p className="text-sm font-bold text-slate-800">Nenhum template aprovado sincronizado</p>
                          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => navigate('/templates')}>Gerenciar templates</Button>
                        </div>
                      )}
                      {selectedMetaTemplate && (
                      <div className="rounded-lg border border-blue-100 bg-white p-4">
                        <div className="mb-4 grid gap-2 sm:grid-cols-3">
                          <div><p className="text-[9px] font-black uppercase text-blue-500">Template</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{selectedMetaTemplate.name}</p></div>
                          <div><p className="text-[9px] font-black uppercase text-blue-500">Idioma</p><p className="mt-1 text-xs font-bold text-slate-800">{selectedMetaTemplate.language}</p></div>
                          <div><p className="text-[9px] font-black uppercase text-blue-500">Categoria</p><p className="mt-1 text-xs font-bold text-slate-800">{selectedMetaTemplate.category}</p></div>
                        </div>
                        <label className="mb-2 block text-xs font-bold text-slate-700">Vincule as variáveis do template</label>
                        {selectedTemplateTokens.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {selectedTemplateTokens.map((token, index) => (
                              <div key={`${token}-${index}`} className="rounded-lg border border-blue-100 bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2"><span className="font-mono text-xs font-black text-blue-700">{`{{${token}}}`}</span><span className="text-[10px] text-slate-400">Variável {index + 1}</span></div>
                                <Select value={metaParameterValues[index] || ''} onValueChange={value => updateMetaParameter(index, value)}>
                                  <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Escolha o dado" /></SelectTrigger>
                                  <SelectContent>{availableMessageVariables.map(variable => <SelectItem key={variable.key} value={variable.key}>{variable.label}</SelectItem>)}</SelectContent>
                                </Select>
                                {previewContact && (
                                  <div className="mt-2 break-words text-xs text-slate-600">
                                    <p>Coluna: {spreadsheetImport?.columns.find(column => column.field === VARIABLE_FIELDS[(metaParameterValues[index] || '').slice(2, -2)])?.header || 'Não encontrada'}</p>
                                    <p className="mt-1 font-medium">Valor: {renderCurrentPreview(metaParameterValues[index] || '') || <span className="text-amber-800">Vazio</span>}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Este template não possui variáveis.</p>
                        )}
                        <p className="mt-2 text-[11px] leading-5 text-blue-700">Cada posição do template recebe o campo escolhido do contato ou da planilha.</p>

                        {selectedTemplateHeaderMediaType && (
                          <div className="mt-4 border-t border-blue-100 pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {selectedTemplateHeaderMediaType === 'image' ? 'Imagem do cabeçalho' : 'Vídeo do cabeçalho'}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">Obrigatório para este template aprovado.</p>
                              </div>
                              <input
                                id="meta-template-header-media"
                                type="file"
                                className="hidden"
                                accept={selectedTemplateHeaderMediaType === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/3gpp'}
                                disabled={isUploadingMedia}
                                onChange={event => {
                                  const file = event.target.files?.[0];
                                  event.currentTarget.value = '';
                                  if (file) void uploadCampaignMedia(file, { replace: true, expectedType: selectedTemplateHeaderMediaType });
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isUploadingMedia}
                                onClick={() => document.getElementById('meta-template-header-media')?.click()}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                {isUploadingMedia ? 'Enviando...' : attachments[0] ? 'Trocar arquivo' : 'Selecionar arquivo'}
                              </Button>
                            </div>
                            {attachments[0] && (
                              <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                                  {attachments[0].type === 'image' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                                  Arquivo pronto para o cabeçalho
                                </div>
                                <button type="button" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => setAttachments([])} aria-label="Remover arquivo">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      )}
                  </div>
                </div>
                )}

                {campaignProvider === 'uazapi' && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-black text-slate-950">Mensagem livre</p><p className="mt-1 text-xs text-slate-500">Escreva o conteúdo enviado pelo canal não oficial.</p></div>
                    <span className="text-xs font-semibold text-slate-400">{message.length} caracteres</span>
                  </div>
                  <textarea value={message} onChange={event => setMessage(event.target.value)} rows={7} placeholder="Olá {{primeiro_nome}}, temos uma novidade para você."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100" />
                </div>
                )}

                {/* Media Attachment section */}
                {campaignProvider === 'uazapi' && (
                <details className="group rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><Paperclip className="h-5 w-5" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Mídias</p>
                        <p className="mt-0.5 text-xs text-slate-500">{attachments.length ? `${attachments.length} arquivo(s) anexado(s)` : 'Imagens, vídeos ou áudios opcionais'}</p>
                      </div>
                    </div>
                    <Settings2 className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-end">
                    {attachments.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setAttachments([])}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Limpar todos
                      </button>
                    )}
                  </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Upload de Arquivo</label>
                      <div className="relative">
                        <input 
                          type="file" 
                          id="campaign-file-input"
                          accept="image/*,audio/*,video/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.currentTarget.value = '';
                            if (!file) return;
                            await uploadCampaignMedia(file);
                          }}
                          className="hidden"
                          disabled={isUploadingMedia}
                        />
                        <Button
                          type="button"
                          onClick={() => document.getElementById('campaign-file-input')?.click()}
                          disabled={isUploadingMedia}
                          className="w-full h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-center gap-2"
                        >
                          {isUploadingMedia ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 text-orange-600" />
                              Selecionar Arquivo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ou cole uma URL pública</label>
                      <div className="flex gap-1.5">
                        <Input 
                          value={mediaUrl} 
                          onChange={e => {
                            const val = e.target.value;
                            setMediaUrl(val);
                            if (val && !mediaType) setMediaType('image');
                          }} 
                          placeholder="Ex: https://site.com/foto.jpg" 
                          className="rounded-xl h-10 bg-white" 
                          disabled={isUploadingMedia}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            if (mediaUrl.trim()) {
                              setAttachments(prev => [...prev, { url: mediaUrl.trim(), type: mediaType || 'image' }]);
                              setMediaUrl('');
                              setMediaType('');
                            }
                          }}
                          disabled={!mediaUrl.trim()}
                          className="bg-primary hover:bg-primary/95 text-white h-10 rounded-xl px-3 font-bold"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {mediaUrl.trim() !== '' && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase">Formato do Arquivo a adicionar</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'image', label: 'Imagem', icon: ImageIcon },
                          { value: 'video', label: 'Vídeo', icon: Video },
                          { value: 'audio', label: 'Áudio', icon: Volume2 },
                        ].map((opt) => {
                          const Icon = opt.icon;
                          return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setMediaType(opt.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                              mediaType === opt.value
                                ? 'bg-secondary text-white border-secondary shadow-md shadow-secondary/15'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="mr-1.5 inline h-3.5 w-3.5" />{opt.label}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* List of currently attached media files */}
                  {attachments.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase">Arquivos Anexados ({attachments.length})</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachments.map((att, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-slate-100 p-2.5 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              {att.type === 'image' && (
                                <img src={att.url.startsWith('/') ? (import.meta.env.VITE_API_URL || 'http://localhost:4000') + att.url : att.url} className="w-8 h-8 rounded object-cover border border-slate-100 flex-shrink-0" />
                              )}
                              {att.type === 'video' && (
                                <span className="material-symbols-outlined text-amber-500 bg-amber-50 p-1.5 rounded text-sm">video_file</span>
                              )}
                              {att.type === 'audio' && (
                                <span className="material-symbols-outlined text-blue-500 bg-blue-50 p-1.5 rounded text-sm">volume_up</span>
                              )}
                              <div className="truncate flex flex-col">
                                <span className="text-[11px] text-slate-700 font-bold leading-none truncate max-w-[130px] sm:max-w-[160px]">
                                  Anexo {index + 1}
                                </span>
                                <span className="text-[9px] text-muted-foreground uppercase font-bold mt-0.5">
                                  {att.type === 'image' ? 'Imagem' : att.type === 'video' ? 'Vídeo' : 'Áudio'}
                                </span>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== index))}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </details>
                )}

                {/* Anti-ban & Delay settings */}
                {campaignProvider === 'uazapi' && (
                <details className="group rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Clock3 className="h-5 w-5" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Ritmo de envio</p>
                        <p className="mt-0.5 text-xs text-slate-500">Intervalo de {minDelay}s a {maxDelay}s {randomize ? 'com variações' : ''}</p>
                      </div>
                    </div>
                    <Settings2 className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">

                  {/* Delay range inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Atraso Mínimo (segundos)</label>
                      <Input 
                        type="number" 
                        value={minDelay === 0 ? '' : minDelay} 
                        onChange={e => setMinDelay(e.target.value === '' ? 0 : Number(e.target.value))} 
                        placeholder="Ex: 180" 
                        className="rounded-xl h-10 bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Atraso Máximo (segundos)</label>
                      <Input 
                        type="number" 
                        value={maxDelay === 0 ? '' : maxDelay} 
                        onChange={e => setMaxDelay(e.target.value === '' ? 0 : Number(e.target.value))} 
                        placeholder="Ex: 200" 
                        className="rounded-xl h-10 bg-white" 
                      />
                    </div>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500">
                    O intervalo reduz picos de envio. Ajuste conforme o volume e as políticas do seu canal.
                  </p>

                  <div className="border-t border-slate-200/60 pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="chk-randomize" 
                        checked={randomize} 
                        onChange={e => setRandomize(e.target.checked)} 
                        className="w-4 h-4 rounded border-slate-300 text-secondary focus:ring-secondary accent-[#F97316]" 
                      />
                      <label htmlFor="chk-randomize" className="text-xs font-bold text-slate-700 cursor-pointer">
                        Alternar variações da mensagem
                      </label>
                    </div>

                    {randomize && (
                      <div className="space-y-2 mt-2 bg-white p-3 rounded-xl border border-slate-100">
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase">Adicionar variações da mensagem</label>
                        <div className="flex gap-2">
                          <Input 
                            value={newVariation} 
                            onChange={e => setNewVariation(e.target.value)} 
                            placeholder="Adicione outra variação do texto..." 
                            className="rounded-lg h-9 bg-slate-50 border-slate-200 text-xs" 
                          />
                          <Button 
                            type="button"
                            onClick={() => {
                              if (newVariation.trim()) {
                                setVariations([...variations, newVariation.trim()]);
                                setNewVariation('');
                              }
                            }}
                            className="bg-[#F97316] text-white hover:bg-orange-600 rounded-lg px-3 h-9 text-xs font-bold"
                          >
                            Add
                          </Button>
                        </div>

                        {variations.length > 0 && (
                          <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                            {variations.map((v, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-xs">
                                <span className="truncate flex-1 pr-2 text-slate-600 font-medium">{v}</span>
                                <button 
                                  type="button" 
                                  onClick={() => setVariations(variations.filter((_, i) => i !== idx))} 
                                  className="text-red-500 hover:text-red-700 font-bold"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 font-semibold italic mt-1">
                          Uma variação será escolhida para cada destinatário.
                        </p>
                      </div>
                    )}
                  </div>
                  </div>
                </details>
                )}

                </div>
                <aside className="min-w-0 self-start rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-0">
                  <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Prévia no WhatsApp</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{previewContact ? 'Dados reais da planilha' : 'Exemplo com dados fictícios'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${campaignProvider === 'meta' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {campaignProvider === 'meta' ? 'Template oficial' : 'Mensagem livre'}
                    </span>
                  </div>
                  {audienceType === 'spreadsheet' && spreadsheetImport && (
                    <div className="mb-3"><SpreadsheetContactPicker data={spreadsheetImport} index={previewContactIndex} onSelect={setPreviewContactIndex} /></div>
                  )}
                  <div className="min-h-60 rounded-xl bg-[#efeae2] p-4 shadow-inner">
                    <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[#d9fdd3] p-3 shadow-sm">
                      {attachments.length > 0 && (
                        <div className="mb-3 flex h-28 items-center justify-center rounded-md bg-white/70 text-emerald-700">
                          {attachments[0].type === 'image' ? <ImageIcon className="h-7 w-7" /> : attachments[0].type === 'video' ? <Video className="h-7 w-7" /> : <Volume2 className="h-7 w-7" />}
                        </div>
                      )}
                      <p data-message-preview className="break-words whitespace-pre-wrap text-[13px] leading-5 text-slate-900">{messagePreview}</p>
                      <p className="mt-1 text-right text-[9px] font-medium text-slate-500">agora <span className="text-blue-500">✓✓</span></p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 break-words">{previewContact ? `Origem: ${spreadsheetFileName} · registro ${spreadsheetImport?.rows[previewContactIndex]?.record}.` : 'A prévia usa dados fictícios. Cada destinatário receberá seus próprios dados.'}</span>
                  </div>
                  {missingPreviewValues.length > 0 && <p role="status" className="mt-3 break-words text-xs text-amber-800">Dados ausentes neste contato: {missingPreviewValues.join(', ')}.</p>}
                  {contactsWithMissingValues > 0 && <p className="mt-2 text-xs text-amber-800">{contactsWithMissingValues} de {spreadsheetContacts.length} contatos com campos da mensagem ausentes.</p>}
                </aside>

                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-5">
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-start-1">
                  <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><CheckCircle2 className="h-5 w-5" /></div>
                    <div><p className="text-sm font-black text-slate-950">Configuração da campanha</p><p className="mt-0.5 text-xs text-slate-500">Confira público, conteúdo e ritmo de envio.</p></div>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Campanha</span><span className="font-bold text-primary">{name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Audiência</span><span className="font-bold text-primary">{AUDIENCE_OPTIONS.find(a => a.value === audienceType)?.label}</span></div>
                  {audienceType === 'by_tags' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tags selecionadas</span>
                      <span className="font-bold text-primary">{selectedTags.join(', ')} ({tagTarget === 'both' ? 'Todos' : tagTarget === 'leads' ? 'Apenas Leads' : 'Apenas Clientes'})</span>
                    </div>
                  )}
                  {audienceType === 'spreadsheet' && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Planilha</span>
                      <span className="font-bold text-primary text-right">{spreadsheetFileName}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Destinatários</span><span className="font-bold text-primary">{previewRecipients} contatos</span></div>
                  
                  {/* Media confirmation */}
                  {attachments.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">Mídias Anexadas ({attachments.length}):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-2.5 rounded-xl border border-slate-100">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 min-w-0">
                            <span className="material-symbols-outlined text-sm text-secondary">
                              {att.type === 'image' ? 'image' : att.type === 'video' ? 'video_file' : 'volume_up'}
                            </span>
                            <span className="truncate max-w-[150px] font-medium">Anexo {idx + 1} ({att.type === 'image' ? 'Imagem' : att.type === 'video' ? 'Vídeo' : 'Áudio'})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : campaignProvider === 'uazapi' && mediaUrl.trim() ? (
                    <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-muted-foreground">Anexo de Mídia ({mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Áudio'})</span>
                      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-secondary underline truncate max-w-xs">{mediaUrl}</a>
                    </div>
                  ) : null}

                  {/* Delivery confirmation */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Canal de envio</span>
                    <span className="font-bold text-primary">
                      {campaignProvider === 'meta'
                        ? `WhatsApp Oficial · ${metaStatus?.officialMode === 'coexistence' ? 'Coexistência' : 'Cloud API'}`
                        : 'WhatsApp Não Oficial'}
                    </span>
                  </div>
                  {campaignProvider === 'uazapi' && (
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Intervalo de envio</span><span className="font-bold text-primary">{minDelay}s a {maxDelay}s</span></div>
                  )}
                  {campaignProvider === 'meta' && selectedMetaTemplate && (
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Template</span><span className="font-bold text-primary">{selectedMetaTemplate.name} · {selectedMetaTemplate.language}</span></div>
                  )}

                  {/* Variations confirmation */}
                  {campaignProvider === 'uazapi' && randomize && variations.length > 0 && (
                    <div className="text-sm space-y-1">
                      <span className="text-muted-foreground">Variações da mensagem</span>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-xs text-slate-500 max-h-24 overflow-y-auto space-y-1">
                        <p className="font-bold text-slate-700">Mensagem 1 (Principal):</p>
                        <p className="italic truncate mb-2">{message}</p>
                        {variations.map((v, i) => (
                          <div key={i}>
                            <p className="font-bold text-slate-700">Mensagem {i + 2}:</p>
                            <p className="italic truncate">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 lg:col-start-1">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div><p className="text-xs font-bold text-amber-900">A campanha será criada como rascunho</p><p className="mt-1 text-xs leading-5 text-amber-700">O envio só começa quando você clicar em enviar na lista de campanhas.</p></div>
                </div>
                </div>
                <aside className="min-w-0 self-start rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">Resumo do disparo</p>
                  <p className="mt-3 text-2xl font-black">{previewRecipients} contatos</p>
                  <p className="mt-1 text-xs text-slate-400">{AUDIENCE_OPTIONS.find(option => option.value === audienceType)?.label}</p>
                  <div className="mt-5 rounded-lg bg-white/10 p-4">
                    {previewContact && <p className="mb-2 break-words text-xs text-slate-300">Prévia: {previewContact.name} · {previewContact.phone}</p>}
                    <p className="break-words whitespace-pre-wrap text-sm leading-6 text-slate-100">{messagePreview}</p>
                    {contactsWithMissingValues > 0 && <p className="mt-2 text-xs text-amber-200">{contactsWithMissingValues} contatos com campos da mensagem ausentes.</p>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-500">Canal</p><p className="mt-1 font-bold">{campaignProvider === 'meta' ? 'WhatsApp Oficial' : 'WhatsApp Não Oficial'}</p></div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-500">{campaignProvider === 'meta' ? 'Modo' : 'Intervalo'}</p>
                      <p className="mt-1 font-bold">{campaignProvider === 'meta' ? (metaStatus?.officialMode === 'coexistence' ? 'Coexistência' : 'Cloud API') : `${minDelay}-${maxDelay}s`}</p>
                    </div>
                  </div>
                  {campaignProvider === 'meta' && (
                    <div className="mt-3 rounded-lg border border-blue-400/20 bg-blue-400/10 p-4 text-xs text-slate-300">
                      A cobrança do disparo é feita diretamente pela Meta na conta do WhatsApp vinculada.
                    </div>
                  )}
                </aside>
              </div>
            )}
          </div>
          <footer className="z-10 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-7">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isSending} className="h-11 rounded-lg">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            ) : <span className="hidden text-xs text-slate-500 sm:block">Você poderá revisar tudo antes de criar.</span>}
            {step === 1 && <Button onClick={() => {
              if (!name || !audienceType) {
                toast({ title: 'Preencha todos os campos', variant: 'destructive' });
                return;
              }
              if (audienceType === 'spreadsheet' && spreadsheetContacts.length === 0) {
                toast({ title: 'Importe uma planilha', variant: 'destructive' });
                return;
              }
              setStep(2);
            }} className="ml-auto h-11 rounded-lg bg-slate-950 px-5 font-bold text-white hover:bg-slate-800">
              Preparar mensagem <ArrowRight className="ml-2 h-4 w-4" />
            </Button>}
            {step === 2 && <Button onClick={validateMessageStep} className="h-11 rounded-lg bg-slate-950 px-4 font-bold text-white hover:bg-slate-800">
              Revisar campanha <ArrowRight className="ml-2 h-4 w-4" />
            </Button>}
            {step === 3 && <Button onClick={handleCreate} disabled={isSending} className="h-11 rounded-lg bg-orange-600 px-4 font-bold text-white hover:bg-orange-700">
              {isSending ? <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span> : <Send className="mr-2 h-4 w-4" />}
              Criar Campanha
            </Button>}
          </footer>
        </DialogContent>
      </Dialog>

      {/* ═══ VIEW CAMPAIGN DIALOG ═══ */}
      <Dialog open={!!viewCampaign} onOpenChange={(o) => !o && setViewCampaign(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 bg-white rounded-3xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-secondary to-orange-400" />
          {viewCampaign && (
            <div className="p-6 sm:p-8 overflow-y-auto max-h-[80vh]">
              <DialogHeader className="mb-5">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-xl font-extrabold text-primary">{viewCampaign.name}</DialogTitle>
                  <Badge className={`${(STATUS_MAP[viewCampaign.status] || STATUS_MAP.draft).color} border-0 text-[10px] font-bold`}>
                    {(STATUS_MAP[viewCampaign.status] || STATUS_MAP.draft).label}
                  </Badge>
                </div>
                {viewCampaign.audienceType === 'by_tags' && viewCampaign.audienceFilter?.tags && (
                  <div className="mt-2 flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-muted-foreground font-semibold mr-1">Tags filtradas:</span>
                    {viewCampaign.audienceFilter.tags.map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-[10px] bg-orange-50 text-secondary border border-orange-100/50 hover:bg-orange-50">{t}</Badge>
                    ))}
                    <span className="text-[10px] text-muted-foreground font-bold uppercase ml-2 bg-slate-100 px-2 py-0.5 rounded">
                      {viewCampaign.audienceFilter.target === 'both' ? 'Todos' : viewCampaign.audienceFilter.target === 'leads' ? 'Apenas Leads' : 'Apenas Clientes'}
                    </span>
                  </div>
                )}
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Total', value: viewCampaign.totalRecipients, icon: 'group', color: 'bg-blue-50 text-blue-600' },
                  { label: 'Enviados', value: viewCampaign.sentCount, icon: 'check_circle', color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Falhas', value: viewCampaign.failedCount, icon: 'error', color: 'bg-red-50 text-red-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                    <span className={`material-symbols-outlined text-xl ${s.color.split(' ')[1]}`}>{s.icon}</span>
                    <p className="text-lg font-bold text-primary">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Mensagem Principal</p>
                  <p className="text-sm whitespace-pre-wrap">{viewCampaign.message}</p>
                </div>

                {/* Render media attachments if any */}
                {viewCampaign.mediaUrl && (() => {
                  let parsedAttachments: { url: string; type: string }[] = [];
                  try {
                    const parsed = JSON.parse(viewCampaign.mediaUrl);
                    if (Array.isArray(parsed)) {
                      parsedAttachments = parsed;
                    }
                  } catch {
                    // URLs antigas foram salvas como texto simples, não como uma lista JSON.
                  }

                  if (parsedAttachments.length > 0) {
                    return (
                      <div className="border-t border-slate-200/60 pt-3 space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Mídias Anexadas ({parsedAttachments.length})</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {parsedAttachments.map((att, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100/80">
                              <span className="material-symbols-outlined text-secondary text-lg">
                                {att.type === 'image' ? 'image' : att.type === 'video' ? 'video_file' : 'volume_up'}
                              </span>
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-secondary hover:underline truncate max-w-[150px] sm:max-w-[200px]">
                                Anexo {idx + 1} ({att.type === 'image' ? 'Imagem' : att.type === 'video' ? 'Vídeo' : 'Áudio'})
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="border-t border-slate-200/60 pt-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Mídia Anexada ({viewCampaign.mediaType === 'image' ? 'Imagem' : viewCampaign.mediaType === 'video' ? 'Vídeo' : 'Áudio'})</p>
                      <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-100/80">
                        <span className="material-symbols-outlined text-secondary text-lg">
                          {viewCampaign.mediaType === 'image' ? 'image' : viewCampaign.mediaType === 'video' ? 'video_file' : 'volume_up'}
                        </span>
                        <a href={viewCampaign.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-secondary hover:underline truncate max-w-xs sm:max-w-md">
                          {viewCampaign.mediaUrl}
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {/* Render sending interval settings */}
                <div className="border-t border-slate-200/60 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Configurações de Atraso</span>
                    <span className="font-semibold text-slate-700">{viewCampaign.minDelay || 180} a {viewCampaign.maxDelay || 200} segundos por contato</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Randomização de Textos</span>
                    <span className="font-semibold text-slate-700">
                      {viewCampaign.randomize ? '✅ Ativado' : '❌ Desativado'}
                    </span>
                  </div>
                </div>

                {viewCampaign.randomize && viewCampaign.variations && Array.isArray(viewCampaign.variations) && viewCampaign.variations.length > 0 && (
                  <div className="border-t border-slate-200/60 pt-3 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Variações Alternadas</span>
                    <div className="bg-white p-2 rounded-lg border border-slate-100 space-y-1">
                      {viewCampaign.variations.map((v: string, idx: number) => (
                        <p key={idx} className="text-slate-600 truncate italic">Variação {idx + 1}: "{v}"</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {viewCampaign.recipients?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Destinatários ({viewCampaign.recipients.length})</p>
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0"><tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">Nome</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">Telefone</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">Tipo</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {viewCampaign.recipients.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{r.phone}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[10px]">
                                {r.sourceType === 'lead' ? 'Lead' : r.sourceType === 'spreadsheet' ? 'Planilha' : 'Cliente'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                r.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                                r.status === 'failed' ? 'bg-red-100 text-red-700' :
                                r.status === 'skipped' ? 'bg-slate-100 text-slate-500' :
                                'bg-amber-100 text-amber-700'
                              }`}>{r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Falhou' : r.status === 'skipped' ? 'Ignorado' : 'Pendente'}</span>
                              {r.status === 'failed' && r.errorMessage && (
                                <p className="text-[10px] text-red-500 font-semibold mt-1 break-words max-w-[180px]" title={r.errorMessage}>
                                  Erro: {r.errorMessage}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useActionPermission } from '@/hooks/use-action-permission';
