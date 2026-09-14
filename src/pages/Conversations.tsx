import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bot, Check, ChevronDown, Clock3, Download, Image as ImageIcon, Inbox, Loader2, MessageCircle, Mic, Pause,
  Maximize2, Paperclip, Phone, Plus, RefreshCcw, Search, Send, Smile, Square,
  StickyNote, Tag, User, X, Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { aiAgentsApi, campaignsApi, conversationsApi, whatsappTemplatesApi } from '@/lib/api';
import { validateMediaUpload } from '@/lib/media-upload';
import type { WhatsAppTemplate } from '@/components/whatsapp/TemplateCatalog';

type Message = {
  id: number;
  sender: 'bot' | 'cliente' | 'profissional';
  content: string;
  origin?: string | null;
  rawJson?: {
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio';
    providerMediaType?: string;
    isSticker?: boolean;
  } | null;
  createdAt: string;
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  errorMessage?: string | null;
};

type Conversation = {
  id: number;
  phone?: string | null;
  agentId?: number | null;
  channel?: string | null;
  startedAt: string;
  updatedAt: string;
  lead?: { id: number; name: string; phone?: string | null; avatar?: string | null; convertedAt?: string | null; convertedToClientId?: number | null } | null;
  client?: { id: number; name: string; phone?: string | null; avatar?: string | null } | null;
  agent?: { id: number; name: string } | null;
  whatsappProvider?: string | null;
  status?: ConversationStatus;
  unreadCount?: number;
  lastMessageAt?: string | null;
  lastInboundAt?: string | null;
  assignedProfessional?: TeamMember | null;
  assignedUser?: TeamMember | null;
  labels?: ConversationLabel[];
  serviceWindow?: { isOfficial: boolean; isOpen: boolean; expiresAt?: string | null; remainingSeconds?: number | null };
  mensagens: Message[];
};

type AiAgent = { id: number; name: string; isActive: boolean };
type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED';
type ConversationLabel = { id: number; name: string; color: string };
type TeamMember = { id: number; name: string; email?: string | null };
type ConversationNote = {
  id: number;
  content: string;
  createdAt: string;
  authorProfessional?: TeamMember | null;
  authorUser?: TeamMember | null;
};
type ConversationWorkspace = {
  labels: ConversationLabel[];
  professionals: TeamMember[];
  users: TeamMember[];
};
type PendingMedia = { file: File; previewUrl: string; type: 'image' | 'video' | 'audio' };
type PreviewMedia = { url: string; alt: string; type: 'image' | 'video' };

const EMOJIS = ['😀', '😊', '😂', '😍', '🙏', '👍', '👏', '🎉', '❤️', '✅', '📅', '🦷', '💬', '✨', '🚀', '😉'];
const VOICE_WAVEFORM = [10, 16, 25, 37, 22, 48, 34, 57, 42, 29, 51, 64, 38, 24, 46, 33, 55, 68, 42, 30, 49, 37, 61, 45, 27, 40, 58, 35, 23, 47, 31, 52, 39, 21, 34, 18];

const CONVERSATION_FILTER_LABELS: Record<string, string> = {
  all: 'Todas as conversas',
  in_progress: 'Em andamento',
  converted: 'Convertidas',
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: 'Todos os status',
  OPEN: 'Abertas',
  PENDING: 'Pendentes',
  RESOLVED: 'Resolvidas',
};

function contactName(conversation: Conversation) {
  return conversation.client?.name || conversation.lead?.name || conversation.phone || 'Contato WhatsApp';
}

function contactPhone(conversation: Conversation) {
  return conversation.phone || conversation.client?.phone || conversation.lead?.phone || '';
}

function contactAvatar(conversation: Conversation) {
  return conversation.client?.avatar || conversation.lead?.avatar || null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'WA';
}

function isConverted(conversation: Conversation) {
  return Boolean(conversation.lead?.convertedAt || conversation.lead?.convertedToClientId || conversation.client);
}

function messageDate(message: Message) {
  return new Date(message.createdAt);
}

function mediaFileName(url: string) {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'midia-whatsapp');
  } catch {
    return 'midia-whatsapp';
  }
}

function downloadMedia(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = mediaFileName(url);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatVoiceTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function VoiceMessagePlayer({
  url,
  incoming,
  avatarUrl,
  avatarName,
}: {
  url: string;
  incoming: boolean;
  avatarUrl?: string | null;
  avatarName: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const completedBars = Math.round(progress * VOICE_WAVEFORM.length);
  const lightText = incoming ? 'text-slate-500' : 'text-slate-300';

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    audio.pause();
  };

  const seek = (value: string) => {
    const audio = audioRef.current;
    const nextTime = Number(value);
    if (!audio || !Number.isFinite(nextTime)) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="flex w-[min(340px,calc(100vw-9rem))] items-center gap-2 p-2 sm:w-[340px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-9 w-9 flex-shrink-0 rounded-full ${incoming ? 'text-slate-800 hover:bg-slate-100 hover:text-slate-950' : 'text-white hover:bg-white/10 hover:text-white'}`}
        onClick={() => void togglePlayback()}
        aria-label={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
        title={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </Button>
      <div className="min-w-0 flex-1">
        <div className="relative flex h-8 items-center gap-px">
          {VOICE_WAVEFORM.map((height, index) => (
            <span
              key={`${height}-${index}`}
              className={`flex-1 rounded-full transition-colors ${index < completedBars ? (incoming ? 'bg-orange-500' : 'bg-sky-400') : (incoming ? 'bg-slate-300' : 'bg-white/30')}`}
              style={{ height: `${height}%` }}
            />
          ))}
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seek(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Avancar audio"
          />
        </div>
        <div className={`mt-1 flex items-center justify-between text-[10px] font-semibold ${lightText}`}>
          <span>{formatVoiceTime(currentTime || duration)}</span>
          <span>{isPlaying ? 'Reproduzindo' : 'Audio'}</span>
        </div>
      </div>
      <div className="relative h-10 w-10 flex-shrink-0 overflow-visible rounded-full">
        <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border ${incoming ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-white/20 bg-slate-700 text-white'}`}>
          {avatarUrl ? <img src={avatarUrl} alt={avatarName} className="h-full w-full object-cover" /> : <span className="text-xs font-black">{initials(avatarName).slice(0, 1)}</span>}
        </div>
        <span className="absolute -bottom-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white"><Mic className="h-2.5 w-2.5" /></span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 flex-shrink-0 ${incoming ? 'text-slate-400 hover:text-slate-700' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}
        onClick={() => downloadMedia(url)}
        aria-label="Baixar audio"
        title="Baixar audio"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const Conversations = () => {
  const { toast } = useToast();
  const { professional } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateParameters, setTemplateParameters] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [, setClock] = useState(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ConversationWorkspace>({ labels: [], professionals: [], users: [] });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#f97316');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationsRequestVersion = useRef(0);
  const hasLoadedConversations = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const cancelRecordingRef = useRef(false);

  const loadConversations = useCallback(async (silent = false) => {
    const requestVersion = ++conversationsRequestVersion.current;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const response = await conversationsApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        labelId: labelFilter === 'all' ? undefined : Number(labelFilter),
        conversion: filter === 'all' ? undefined : filter as 'in_progress' | 'converted',
        search: debouncedSearchTerm,
      });
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel carregar as conversas.');
      if (requestVersion !== conversationsRequestVersion.current) return;
      const items = (response.data || []).map((conversation: Conversation) => ({
        ...conversation,
        mensagens: [...(conversation.mensagens || [])].sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime()),
      }));
      items.sort((a, b) => {
        const aLast = a.mensagens.at(-1)?.createdAt || a.updatedAt || a.startedAt;
        const bLast = b.mensagens.at(-1)?.createdAt || b.updatedAt || b.startedAt;
        return new Date(bLast).getTime() - new Date(aLast).getTime();
      });
      setConversations(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
      setLoadError(null);
    } catch (error: any) {
      if (requestVersion !== conversationsRequestVersion.current) return;
      setLoadError(error.message || 'Erro ao carregar conversas.');
      if (!silent) toast({ title: 'Erro nas conversas', description: error.message, variant: 'destructive' });
    } finally {
      if (requestVersion === conversationsRequestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [debouncedSearchTerm, filter, labelFilter, statusFilter, toast]);

  const loadWorkspace = async () => {
    const response = await conversationsApi.workspace();
    if (response.success && response.data) setWorkspace(response.data);
  };

  useEffect(() => {
    void aiAgentsApi.list().then((response) => {
      if (response.success) setAgents((response.data || []).filter((agent: AiAgent) => agent.isActive));
    });
    void whatsappTemplatesApi.list('APPROVED').then((response) => {
      if (response.success) setTemplates(response.data || []);
    });
    void loadWorkspace();
    const clockTimer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(clockTimer);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    void loadConversations(hasLoadedConversations.current);
    hasLoadedConversations.current = true;
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void loadConversations(true);
    }, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [loadConversations]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedId, selected?.mensagens.length]);

  useEffect(() => {
    if (!selectedId || !selected?.unreadCount) return;
    void conversationsApi.markRead(selectedId).then((response) => {
      if (response.success) setConversations((current) => current.map((item) => item.id === selectedId ? { ...item, unreadCount: 0 } : item));
    });
  }, [selectedId, selected?.unreadCount]);

  useEffect(() => {
    if (!notesOpen || !selectedId) return;
    let cancelled = false;
    setNotesLoading(true);
    void conversationsApi.listNotes(selectedId).then((response) => {
      if (!cancelled && response.success) setNotes(response.data || []);
    }).finally(() => {
      if (!cancelled) setNotesLoading(false);
    });
    return () => { cancelled = true; };
  }, [notesOpen, selectedId]);

  useEffect(() => {
    setNotes([]);
    setNewNote('');
  }, [selectedId]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const phoneQuery = query.replace(/\D/g, '');
    return conversations.filter((conversation) => {
      const converted = isConverted(conversation);
      const matchesFilter = filter === 'all' || (filter === 'converted' ? converted : !converted);
      const matchesSearch = !query
        || contactName(conversation).toLowerCase().includes(query)
        || contactPhone(conversation).includes(query)
        || (phoneQuery.length >= 3 && contactPhone(conversation).replace(/\D/g, '').includes(phoneQuery));
      return matchesFilter && matchesSearch;
    });
  }, [conversations, filter, searchTerm]);

  const convertedCount = conversations.filter(isConverted).length;
  const activeCount = conversations.length - convertedCount;
  const conversionRate = conversations.length ? Math.round((convertedCount / conversations.length) * 100) : 0;

  const formatRelativeTime = (value: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return format(new Date(value), 'dd/MM', { locale: ptBR });
  };

  const getWindowRemaining = (conversation: Conversation | null) => {
    if (!conversation?.serviceWindow?.isOfficial) return null;
    if (!conversation.serviceWindow.expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(conversation.serviceWindow.expiresAt).getTime() - Date.now()) / 1000));
  };

  const formatWindowRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Janela encerrada';
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min restantes`;
  };

  const clearPendingMedia = () => {
    if (pendingMedia) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
  };

  const selectMedia = (file?: File) => {
    if (!file) return;
    const validation = validateMediaUpload(file);
    if (!validation.type) {
      toast({ title: 'Arquivo nao suportado', description: validation.error, variant: 'destructive' });
      return;
    }
    clearPendingMedia();
    setPendingMedia({ file, type: validation.type, previewUrl: URL.createObjectURL(file) });
  };

  const finishRecording = (cancel = false) => {
    cancelRecordingRef.current = cancel;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const startRecording = async () => {
    if (isRecording || sending) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({ title: 'Gravacao indisponivel', description: 'Este navegador nao permite gravar audio.', variant: 'destructive' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: preferredType, audioBitsPerSecond: 32000 });
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (!cancelRecordingRef.current && audioChunksRef.current.length) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          selectMedia(new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }));
        }
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingSeconds(0);
      };
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch (error) {
      toast({ title: 'Microfone nao liberado', description: 'Autorize o uso do microfone para gravar uma mensagem.', variant: 'destructive' });
    }
  };

  const formatRecordingTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const updateConversationStatus = async (status: ConversationStatus) => {
    if (!selected || savingDetails) return;
    setSavingDetails(true);
    try {
      const response = await conversationsApi.setStatus(selected.id, status);
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel alterar o status.');
      setConversations((current) => current.map((conversation) => (
        conversation.id === selected.id
          ? { ...conversation, ...(response.data || {}), status }
          : conversation
      )));
    } catch (error: any) {
      toast({ title: 'Status nao alterado', description: error.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const assignConversation = async (value: string) => {
    if (!selected || savingDetails) return;
    const [type, rawId] = value.split(':');
    setSavingDetails(true);
    try {
      const response = await conversationsApi.assign(selected.id, type === 'none' ? { assigneeType: null } : {
        assigneeType: type as 'professional' | 'user',
        assigneeId: Number(rawId),
      });
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel atribuir a conversa.');
      await loadConversations(true);
    } catch (error: any) {
      toast({ title: 'Responsavel nao alterado', description: error.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const toggleConversationLabel = async (label: ConversationLabel) => {
    if (!selected || savingDetails) return;
    const attached = Boolean(selected.labels?.some((item) => item.id === label.id));
    setSavingDetails(true);
    try {
      const response = attached
        ? await conversationsApi.removeLabel(selected.id, label.id)
        : await conversationsApi.addLabel(selected.id, label.id);
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel alterar a etiqueta.');
      await loadConversations(true);
    } catch (error: any) {
      toast({ title: 'Etiqueta nao alterada', description: error.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const createConversationLabel = async () => {
    if (!newLabelName.trim() || savingDetails) return;
    setSavingDetails(true);
    try {
      const response = await conversationsApi.createLabel({ name: newLabelName.trim(), color: newLabelColor });
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Nao foi possivel criar a etiqueta.');
      setWorkspace((current) => ({ ...current, labels: [...current.labels, response.data] }));
      setNewLabelName('');
      if (selected) await conversationsApi.addLabel(selected.id, response.data.id);
      await loadConversations(true);
    } catch (error: any) {
      toast({ title: 'Etiqueta nao criada', description: error.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const addConversationNote = async () => {
    if (!selected || !newNote.trim() || savingDetails) return;
    setSavingDetails(true);
    try {
      const response = await conversationsApi.addNote(selected.id, newNote.trim());
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Nao foi possivel salvar a nota.');
      setNotes((current) => [response.data, ...current]);
      setNewNote('');
    } catch (error: any) {
      toast({ title: 'Nota nao salva', description: error.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!selected || (!content && !pendingMedia) || sending) return;
    const remaining = getWindowRemaining(selected);
    if (remaining !== null && remaining <= 0) {
      toast({ title: 'Janela de 24 horas encerrada', description: 'Na API oficial, use um template aprovado para retomar esta conversa.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      let media: { url: string; type: 'image' | 'video' | 'audio' } | undefined;
      if (pendingMedia) {
        setUploading(true);
        const upload = await campaignsApi.uploadMedia(pendingMedia.file);
        if (!upload.success || !upload.data?.url) throw new Error(upload.error?.message || 'Nao foi possivel enviar o arquivo.');
        media = { url: upload.data.url, type: pendingMedia.type };
      }
      const response = await conversationsApi.sendMessage(selected.id, content, media);
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel enviar a mensagem.');
      setNewMessage('');
      clearPendingMedia();
      await loadConversations(true);
    } catch (error: any) {
      toast({ title: 'Mensagem nao enviada', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const assignAgent = async (value: string) => {
    if (!selected || assigningAgent) return;
    if (value === 'new') {
      setShowAgentDialog(true);
      return;
    }
    setAssigningAgent(true);
    try {
      const response = await conversationsApi.update(selected.id, { agentId: value === 'manual' ? null : Number(value) });
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel alterar o atendimento.');
      await loadConversations(true);
      toast({ title: value === 'manual' ? 'Atendimento manual ativado' : 'Agente vinculado a conversa' });
    } catch (error: any) {
      toast({ title: 'Erro ao atribuir agente', description: error.message, variant: 'destructive' });
    } finally {
      setAssigningAgent(false);
    }
  };

  const createAgent = async () => {
    if (!agentName.trim() || !agentPrompt.trim() || creatingAgent) return;
    setCreatingAgent(true);
    try {
      const response = await aiAgentsApi.create({
        name: agentName.trim(),
        basePrompt: agentPrompt.trim(),
        temperature: 0.7,
        mode: 'assisted',
      });
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Nao foi possivel criar o agente.');
      const created = response.data as AiAgent;
      setAgents((current) => [created, ...current]);
      setShowAgentDialog(false);
      setAgentName('');
      setAgentPrompt('');
      if (selected) await assignAgent(String(created.id));
    } catch (error: any) {
      toast({ title: 'Erro ao criar agente', description: error.message, variant: 'destructive' });
    } finally {
      setCreatingAgent(false);
    }
  };

  const windowRemaining = getWindowRemaining(selected);
  const officialWindowClosed = windowRemaining !== null && windowRemaining <= 0;

  const selectedTemplate = templates.find((template) => String(template.id) === selectedTemplateId);
  const templateParameterCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    return (selectedTemplate.components || []).reduce((total, component) => {
      if (String(component.type || '').toUpperCase() !== 'BODY') return total;
      return total + (String(component.text || '').match(/\{\{[^}]+\}\}/g) || []).length;
    }, 0);
  }, [selectedTemplate]);

  useEffect(() => {
    setTemplateParameters((current) => Array.from({ length: templateParameterCount }, (_, index) => current[index] || ''));
  }, [templateParameterCount]);

  const sendTemplate = async () => {
    if (!selected || !selectedTemplate || sendingTemplate) return;
    if (templateParameters.some((value) => !value.trim())) {
      toast({ title: 'Preencha as variaveis', description: 'Todas as variaveis do template precisam de um valor.', variant: 'destructive' });
      return;
    }
    setSendingTemplate(true);
    try {
      const response = await conversationsApi.sendTemplate(selected.id, {
        templateId: selectedTemplate.id,
        parameterValues: templateParameters,
      });
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel enviar o template.');
      setShowTemplateDialog(false);
      await loadConversations(true);
      toast({ title: 'Template enviado', description: 'A conversa foi reaberta pela API Oficial.' });
    } catch (error: any) {
      toast({ title: 'Template nao enviado', description: error.message, variant: 'destructive' });
    } finally {
      setSendingTemplate(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-lg font-extrabold text-slate-950">Conversas</h1><span className="hidden text-xs font-medium text-slate-500 sm:block">WhatsApp da clinica</span></div>
          {loadError && <p className="mt-1 text-xs font-semibold text-red-600">{loadError}</p>}
        </div>
        <div className="hidden items-center gap-8 md:flex">
          {[{ label: 'Ativas', value: activeCount }, { label: 'Convertidas', value: convertedCount }, { label: 'Conversao', value: `${conversionRate}%` }].map((stat) => (
            <div key={stat.label} className="text-center"><p className="text-xl font-extrabold leading-none text-slate-950">{stat.value}</p><p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{stat.label}</p></div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => loadConversations(true)} disabled={refreshing}><RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Atualizar</Button>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-200 bg-slate-50 p-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Buscar por nome ou telefone" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-9 bg-white pl-9" /></div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 bg-white text-xs font-semibold">
                <span className="truncate">{CONVERSATION_FILTER_LABELS[filter] || 'Todas as conversas'}</span>
              </SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as conversas</SelectItem><SelectItem value="in_progress">Em andamento</SelectItem><SelectItem value="converted">Convertidas</SelectItem></SelectContent></Select>
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 bg-white text-xs">
                  <span className="truncate">{STATUS_FILTER_LABELS[statusFilter] || 'Status'}</span>
                </SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="OPEN">Abertas</SelectItem><SelectItem value="PENDING">Pendentes</SelectItem><SelectItem value="RESOLVED">Resolvidas</SelectItem></SelectContent>
              </Select>
              <Select value={labelFilter} onValueChange={setLabelFilter}>
                <SelectTrigger className="h-9 bg-white text-xs">
                  <span className="truncate">{labelFilter === 'all' ? 'Todas etiquetas' : workspace.labels.find(label => String(label.id) === labelFilter)?.name || 'Etiqueta'}</span>
                </SelectTrigger>
                <SelectContent><SelectItem value="all">Todas etiquetas</SelectItem>{workspace.labels.map((label) => <SelectItem key={label.id} value={String(label.id)}>{label.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase text-slate-400">{filtered.length} conversa{filtered.length === 1 ? '' : 's'}</div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : filtered.length === 0 ? (
              <div className="px-6 py-16 text-center"><Inbox className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">Nenhuma conversa real ainda</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Quando uma mensagem chegar pelo webhook, ela aparecera aqui.</p></div>
            ) : filtered.map((conversation) => {
              const name = contactName(conversation);
              const lastMessage = conversation.mensagens.at(-1);
              const active = selectedId === conversation.id;
              const converted = isConverted(conversation);
              return (
                <button type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <div className="flex gap-3">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-black ${active ? 'bg-slate-950 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {contactAvatar(conversation) ? <img src={contactAvatar(conversation)!} alt="" className="h-full w-full object-cover" /> : initials(name)}
                    </div>
                    <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-slate-900">{name}</p><div className="flex items-center gap-1.5"><span className="flex-shrink-0 text-[10px] text-slate-400">{formatRelativeTime(lastMessage?.createdAt || conversation.updatedAt || conversation.startedAt)}</span>{Boolean(conversation.unreadCount) && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-black text-white">{conversation.unreadCount}</span>}</div></div><p className="mt-0.5 truncate text-xs text-slate-500">{lastMessage?.content || 'Conversa iniciada'}</p><div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold"><span className={`h-1.5 w-1.5 rounded-full ${conversation.status === 'RESOLVED' ? 'bg-slate-400' : conversation.status === 'PENDING' ? 'bg-amber-500' : converted ? 'bg-emerald-500' : 'bg-sky-500'}`} /><span className={conversation.status === 'RESOLVED' ? 'text-slate-500' : conversation.status === 'PENDING' ? 'text-amber-600' : converted ? 'text-emerald-600' : 'text-sky-600'}>{conversation.status === 'RESOLVED' ? 'Resolvida' : conversation.status === 'PENDING' ? 'Pendente' : converted ? 'Convertida' : 'Em andamento'}</span>{conversation.labels?.slice(0, 2).map((label) => <span key={label.id} className="rounded-full border px-1.5 py-0.5 font-semibold text-slate-600" style={{ borderColor: label.color, backgroundColor: `${label.color}18` }}>{label.name}</span>)}</div></div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {selected ? (
          <section className="flex min-w-0 flex-1 flex-col bg-slate-50">
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950 text-xs font-black text-white">
                  {contactAvatar(selected) ? <img src={contactAvatar(selected)!} alt="" className="h-full w-full object-cover" /> : initials(contactName(selected))}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{contactName(selected)}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" />{contactPhone(selected)}</p>
                    {selected.labels?.map((label) => (
                      <button key={label.id} type="button" onClick={() => setDetailsOpen(true)} className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-slate-700" style={{ borderColor: label.color, backgroundColor: `${label.color}18` }} title="Gerenciar etiquetas">{label.name}</button>
                    ))}
                    <button type="button" onClick={() => setDetailsOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-orange-600"><Plus className="h-3 w-3" />Etiqueta</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.serviceWindow?.isOfficial && <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${!officialWindowClosed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><Clock3 className="h-3.5 w-3.5" />{formatWindowRemaining(windowRemaining || 0)}</span>}
                <Select value={selected.status || 'OPEN'} onValueChange={(value) => void updateConversationStatus(value as ConversationStatus)}>
                  <SelectTrigger disabled={savingDetails} className="h-9 w-[125px] bg-white text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="OPEN">Aberta</SelectItem><SelectItem value="PENDING">Pendente</SelectItem><SelectItem value="RESOLVED">Resolvida</SelectItem></SelectContent>
                </Select>
                <Select value={selected.agentId ? String(selected.agentId) : 'manual'} onValueChange={assignAgent}>
                  <SelectTrigger disabled={assigningAgent} className="h-9 w-[190px] bg-white text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      {selected.agentId ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      <SelectValue>
                        {selected.agentId ? agents.find(a => String(a.id) === String(selected.agentId))?.name : 'Atendimento manual'}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent><SelectItem value="manual">Atendimento manual</SelectItem>{agents.map((agent) => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}<SelectItem value="new"><span className="flex items-center gap-2"><Plus className="h-3.5 w-3.5" />Novo agente</span></SelectItem></SelectContent></Select>
                <Button variant="outline" size="icon" onClick={() => setDetailsOpen(true)} aria-label="Abrir organizacao da conversa" title="Responsavel e etiquetas"><Tag className="h-4 w-4" /></Button>
                <Button variant={notesOpen ? 'secondary' : 'outline'} size="icon" onClick={() => setNotesOpen((open) => !open)} aria-label={notesOpen ? 'Fechar notas internas' : 'Abrir notas internas'} title={notesOpen ? 'Fechar notas' : 'Notas internas'}><StickyNote className="h-4 w-4" /></Button>
              </div>
            </div>

            {notesOpen && (
              <section className="flex-shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3" aria-labelledby="conversation-notes-title">
                <div className="mx-auto max-w-5xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <StickyNote className="h-4 w-4 flex-shrink-0 text-orange-500" />
                      <div className="min-w-0">
                        <h2 id="conversation-notes-title" className="text-sm font-bold text-slate-900">Notas internas</h2>
                        <p className="text-xs text-slate-500">Visiveis apenas para a equipe.</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNotesOpen(false)} aria-label="Fechar notas internas" title="Fechar notas"><ChevronDown className="h-4 w-4 rotate-180" /></Button>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <Textarea value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Adicionar uma nota para a equipe..." rows={2} maxLength={2000} className="min-h-0 resize-none bg-white text-sm" />
                    <Button size="sm" onClick={() => void addConversationNote()} disabled={!newNote.trim() || savingDetails}>
                      {savingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                  <div className="mt-3 max-h-40 space-y-3 overflow-y-auto border-t border-slate-200 pt-3 pr-1">
                    {notesLoading ? <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div> : notes.length === 0 ? <p className="py-1 text-xs text-slate-500">Nenhuma nota nesta conversa.</p> : notes.map((note) => (
                      <article key={note.id} className="border-l-2 border-orange-300 pl-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.content}</p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                          {note.authorProfessional?.name || note.authorUser?.name || 'Equipe'} · {format(new Date(note.createdAt), "dd/MM 'as' HH:mm", { locale: ptBR })}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
              {selected.mensagens.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><MessageCircle className="h-12 w-12 text-slate-300" /><p className="mt-3 font-bold text-slate-600">Conversa sem mensagens</p></div> : selected.mensagens.map((message, index) => {
                const incoming = message.sender === 'cliente';
                const previous = selected.mensagens[index - 1];
                const showDate = !previous || !isSameDay(messageDate(previous), messageDate(message));
                return (
                  <div key={message.id}>
                    {showDate && <div className="my-4 flex justify-center"><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-500">{format(messageDate(message), "dd 'de' MMMM", { locale: ptBR })}</span></div>}
                    <div className={`mb-3 flex ${incoming ? 'justify-start' : 'justify-end'}`}><div className="max-w-[88%] sm:max-w-[72%]"><div className={`overflow-hidden rounded-2xl text-sm leading-relaxed shadow-sm ${message.rawJson?.isSticker ? 'bg-transparent shadow-none' : incoming ? 'rounded-bl-sm border border-slate-200 bg-white text-slate-800' : 'rounded-br-sm bg-slate-950 text-white'}`}>
                      {message.rawJson?.mediaUrl && message.rawJson.mediaType === 'image' && (
                        <button
                          type="button"
                          className={`group relative block cursor-zoom-in overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${message.rawJson.isSticker ? 'w-auto' : 'w-full'}`}
                          onClick={() => setPreviewMedia({
                            url: message.rawJson!.mediaUrl!,
                            alt: message.content && !/^\[image\]$/.test(message.content) ? message.content : 'Imagem da conversa',
                            type: 'image',
                          })}
                          aria-label="Ampliar imagem"
                        >
                          <img
                            src={message.rawJson.mediaUrl}
                            alt={message.content && !/^\[image\]$/.test(message.content) ? message.content : 'Imagem da conversa'}
                            className={message.rawJson.isSticker ? 'h-44 w-44 object-contain transition-transform duration-200 group-hover:scale-[1.03]' : 'max-h-[28rem] w-full max-w-[36rem] object-contain transition-transform duration-200 group-hover:scale-[1.01]'}
                          />
                          <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 transition-opacity group-hover:opacity-100"><Maximize2 className="h-4 w-4" /></span>
                        </button>
                      )}
                      {message.rawJson?.mediaUrl && message.rawJson.mediaType === 'video' && (
                        <div className="relative max-w-[38rem]">
                          <video src={message.rawJson.mediaUrl} controls className="max-h-[32rem] w-full bg-black" />
                          <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 h-8 w-8 bg-white/90" onClick={() => setPreviewMedia({ url: message.rawJson!.mediaUrl!, alt: message.content || 'Video da conversa', type: 'video' })} title="Ampliar video"><Maximize2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                      {message.rawJson?.mediaUrl && message.rawJson.mediaType === 'audio' && (
                        <VoiceMessagePlayer
                          url={message.rawJson.mediaUrl}
                          incoming={incoming}
                          avatarUrl={incoming ? contactAvatar(selected) : professional?.photoUrl}
                          avatarName={incoming ? contactName(selected) : professional?.name || 'Equipe'}
                        />
                      )}
                      {message.content && !/^\[(image|video|audio|sticker)\]$/.test(message.content) && <p className={`px-4 py-2.5 ${message.rawJson?.isSticker ? (incoming ? 'rounded-2xl bg-white text-slate-800' : 'rounded-2xl bg-slate-950 text-white') : ''}`}>{message.content}</p>}
                    </div>
                      <p className={`mt-1 text-[10px] text-slate-400 ${incoming ? 'text-left' : 'text-right'}`}>
                        {!incoming && (
                          <span
                            title={message.deliveryStatus === 'failed' ? message.errorMessage || undefined : undefined}
                            className={`mr-1 font-bold ${message.deliveryStatus === 'failed' ? 'text-red-600' : 'text-sky-600'}`}
                          >
                            {message.sender === 'bot' ? 'IA' : 'Voce'}
                            {message.deliveryStatus ? ` · ${message.deliveryStatus === 'read' ? 'lida' : message.deliveryStatus === 'delivered' ? 'entregue' : message.deliveryStatus === 'failed' ? 'falhou' : 'enviada'}` : ''}
                          </span>
                        )}
                        {format(messageDate(message), 'HH:mm')}
                      </p>
                      {!incoming && message.deliveryStatus === 'failed' && message.errorMessage && (
                        <p className="mt-1 max-w-[260px] truncate text-right text-[10px] font-semibold text-red-600" title={message.errorMessage}>
                          {message.errorMessage}
                        </p>
                      )}
                    </div></div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
              {pendingMedia && <div className="mx-auto mb-2 flex max-w-5xl items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2">{pendingMedia.type === 'image' ? <img src={pendingMedia.previewUrl} alt="Previa" className="h-14 w-14 rounded object-cover" /> : pendingMedia.type === 'audio' ? <audio src={pendingMedia.previewUrl} controls className="h-10 max-w-[260px]" /> : <ImageIcon className="h-8 w-8 text-slate-500" />}<div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{pendingMedia.file.name}</p><p className="text-[10px] text-slate-500">{pendingMedia.type === 'audio' ? 'Mensagem de voz pronta' : pendingMedia.type}</p></div><Button variant="ghost" size="icon" onClick={clearPendingMedia} aria-label="Remover anexo"><X className="h-4 w-4" /></Button></div>}
              {officialWindowClosed && <div className="mx-auto mb-2 flex max-w-5xl items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><span>A janela de atendimento da Meta terminou. Para retomar, envie um template aprovado.</span><Button size="sm" onClick={() => setShowTemplateDialog(true)} disabled={templates.length === 0}>Usar template</Button></div>}
              <div className="relative mx-auto flex max-w-5xl items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(event) => { selectMedia(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={sending || officialWindowClosed} aria-label="Anexar midia"><Paperclip className="h-4 w-4" /></Button>
                {isRecording ? (
                  <div className="flex h-11 flex-1 items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                    <span className="font-mono text-sm font-bold text-red-700">{formatRecordingTime(recordingSeconds)}</span>
                    <span className="flex-1 text-xs font-medium text-red-700">Gravando mensagem de voz</span>
                    <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-100" onClick={() => finishRecording(true)}>Cancelar</Button>
                    <Button size="icon" className="bg-red-600 hover:bg-red-700" onClick={() => finishRecording(false)} aria-label="Parar gravacao"><Square className="h-4 w-4 fill-current" /></Button>
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => setShowEmojis((open) => !open)} disabled={sending || officialWindowClosed} aria-label="Adicionar emoji"><Smile className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => void startRecording()} disabled={sending || officialWindowClosed || Boolean(pendingMedia)} aria-label="Gravar mensagem de voz" title="Gravar mensagem de voz"><Mic className="h-4 w-4" /></Button>
                    {showEmojis && <div className="absolute bottom-14 left-10 z-20 grid w-56 grid-cols-8 gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-xl">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => { setNewMessage((value) => value + emoji); setShowEmojis(false); }} className="h-7 rounded text-lg hover:bg-slate-100">{emoji}</button>)}</div>}
                    <Input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Digite uma mensagem" disabled={sending || officialWindowClosed} className="h-11" />
                    <Button size="icon" onClick={() => void sendMessage()} disabled={sending || (!newMessage.trim() && !pendingMedia) || officialWindowClosed} aria-label="Enviar mensagem">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                  </>
                )}
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-400">{uploading ? 'Enviando midia...' : 'A mensagem sera enviada pelo WhatsApp conectado a clinica.'}</p>
            </div>
          </section>
        ) : <section className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center"><MessageCircle className="h-14 w-14 text-slate-300" /><p className="mt-4 font-bold text-slate-600">Selecione uma conversa</p><p className="mt-1 max-w-sm text-sm text-slate-400">As mensagens recebidas pelo WhatsApp conectado aparecerao nesta central.</p></section>}
      </main>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <SheetTitle>Organizacao da conversa</SheetTitle>
            <SheetDescription>
              {selected ? `${contactName(selected)} · ${contactPhone(selected)}` : 'Organize etiquetas e responsavel da conversa.'}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="space-y-7 px-6 py-6">
              <section aria-labelledby="conversation-owner-title">
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-orange-500" />
                  <h3 id="conversation-owner-title" className="text-sm font-bold text-slate-900">Responsavel</h3>
                </div>
                <Select
                  value={selected.assignedProfessional ? `professional:${selected.assignedProfessional.id}` : selected.assignedUser ? `user:${selected.assignedUser.id}` : 'none:'}
                  onValueChange={(value) => void assignConversation(value)}
                  disabled={savingDetails}
                >
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sem responsavel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none:">Sem responsavel</SelectItem>
                    {workspace.professionals.map((member) => <SelectItem key={`professional-${member.id}`} value={`professional:${member.id}`}>{member.name} · Profissional</SelectItem>)}
                    {workspace.users.map((member) => <SelectItem key={`user-${member.id}`} value={`user:${member.id}`}>{member.name} · Equipe</SelectItem>)}
                  </SelectContent>
                </Select>
              </section>

              <section aria-labelledby="conversation-labels-title">
                <div className="mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-orange-500" />
                  <h3 id="conversation-labels-title" className="text-sm font-bold text-slate-900">Etiquetas</h3>
                </div>
                {workspace.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {workspace.labels.map((label) => {
                      const attached = Boolean(selected.labels?.some((item) => item.id === label.id));
                      return (
                        <button
                          key={label.id}
                          type="button"
                          disabled={savingDetails}
                          onClick={() => void toggleConversationLabel(label)}
                          className={`flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-opacity ${attached ? 'text-slate-900' : 'bg-white text-slate-500 opacity-65 hover:opacity-100'}`}
                          style={{ borderColor: label.color, backgroundColor: attached ? `${label.color}20` : undefined }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                          {label.name}
                          {attached && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-slate-500">Nenhuma etiqueta criada nesta clinica.</p>}
                <div className="mt-3 flex gap-2">
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(event) => setNewLabelColor(event.target.value)}
                    className="h-10 w-11 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                    aria-label="Cor da nova etiqueta"
                  />
                  <Input value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} placeholder="Nova etiqueta" maxLength={40} />
                  <Button size="icon" variant="outline" onClick={() => void createConversationLabel()} disabled={!newLabelName.trim() || savingDetails} aria-label="Criar etiqueta"><Plus className="h-4 w-4" /></Button>
                </div>
              </section>

            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(previewMedia)} onOpenChange={(open) => { if (!open) setPreviewMedia(null); }}>
        <DialogContent className="h-full w-full max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden bg-slate-950 p-0 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)] sm:max-w-[1500px] [&>button]:border-white/15 [&>button]:bg-slate-900 [&>button]:text-white [&>button]:hover:bg-slate-800">
          <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/10 px-5 pr-20">
            <DialogTitle className="truncate text-sm font-semibold text-white">
              {previewMedia ? mediaFileName(previewMedia.url) : 'Midia da conversa'}
            </DialogTitle>
            {previewMedia && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => downloadMedia(previewMedia.url)}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
            {previewMedia?.type === 'image' && (
              <img
                src={previewMedia.url}
                alt={previewMedia.alt}
                className="max-h-full max-w-full object-contain shadow-2xl"
              />
            )}
            {previewMedia?.type === 'video' && (
              <video
                src={previewMedia.url}
                aria-label={previewMedia.alt}
                controls
                autoPlay
                className="max-h-full max-w-full bg-black shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo agente de IA</DialogTitle>
            <DialogDescription>Defina a identidade e as orientacoes que serao usadas neste atendimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="agent-name">Nome do agente</Label><Input id="agent-name" value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Ex.: Assistente de agendamentos" /></div>
            <div className="space-y-2"><Label htmlFor="agent-prompt">Orientacoes do agente</Label><Textarea id="agent-prompt" value={agentPrompt} onChange={(event) => setAgentPrompt(event.target.value)} placeholder="Descreva o tom, objetivo e regras do atendimento." rows={7} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAgentDialog(false)}>Cancelar</Button><Button onClick={() => void createAgent()} disabled={creatingAgent || !agentName.trim() || !agentPrompt.trim()}>{creatingAgent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar e atribuir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar template aprovado</DialogTitle>
            <DialogDescription>Use um template da Meta para iniciar ou retomar a conversa fora da janela de 24 horas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>{templates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name} · {template.language}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {templateParameters.map((value, index) => (
              <div key={index} className="space-y-2">
                <Label>Variavel {index + 1}</Label>
                <Input value={value} onChange={(event) => setTemplateParameters((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Valor de {{${index + 1}}}`} />
              </div>
            ))}
            {selectedTemplate && templateParameterCount === 0 && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Este template nao exige variaveis.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={() => void sendTemplate()} disabled={!selectedTemplate || sendingTemplate || templateParameters.some((value) => !value.trim())}>{sendingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Conversations;
