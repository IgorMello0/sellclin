import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { funnelConfigApi, cadenceApi } from '@/lib/api';
import { Save, Plus, Trash, Clock, Phone, MessageCircle, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const METHOD_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />
};

export default function CadenceSettingsView() {
  const { toast } = useToast();
  const requestVersion = useRef(0);
  const [loadedStage, setLoadedStage] = useState('');
  const [funnels, setFunnels] = useState<any[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [config, setConfig] = useState<{ isActive: boolean; skipWeekends: boolean; steps: any[] }>({ isActive: true, skipWeekends: true, steps: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isBannerOpen, setIsBannerOpen] = useState(false);

  useEffect(() => {
    loadFunnels();
  }, []);

  useEffect(() => {
    if (selectedStage) loadCadenceConfig(selectedStage);
    return () => { requestVersion.current += 1; };
  }, [selectedStage]);

  const loadFunnels = async () => {
    try {
      // Carregar todos os funis dinâmicos
      const res = await funnelConfigApi.getAll();
      if (res.data) setFunnels(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCadenceConfig = async (stageCode: string) => {
    const version = ++requestVersion.current;
    setLoadedStage('');
    setIsLoading(true);
    try {
      const res = await cadenceApi.getByStage(stageCode);
      if (version !== requestVersion.current) return;
      if (!res.success || !res.data) throw new Error(res.error?.message || 'Falha ao carregar cadência');
      if (res.data) {
        setLoadedStage(stageCode);
        const stepsData = res.data.steps;
        let parsedSteps = [];
        let parsedSkipWeekends = true;
        if (Array.isArray(stepsData)) {
          parsedSteps = stepsData;
        } else if (stepsData && typeof stepsData === 'object') {
          parsedSteps = stepsData.items || [];
          parsedSkipWeekends = stepsData.skipWeekends ?? true;
        }

        setConfig({
          isActive: res.data.isActive,
          skipWeekends: parsedSkipWeekends,
          steps: parsedSteps
        });
      }
    } catch (e) {
      if (version === requestVersion.current) toast({ title: 'Erro ao carregar cadência', variant: 'destructive' });
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!selectedStage || loadedStage !== selectedStage || isLoading) return;
    try {
      setIsLoading(true);
      const res = await cadenceApi.update(selectedStage, {
        isActive: config.isActive,
        steps: {
          skipWeekends: config.skipWeekends,
          items: config.steps
        }
      });
      if (!res.success) throw new Error(res.error?.message || 'Falha ao salvar');
      toast({ title: 'Configuração salva com sucesso!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetSelection = () => {
    requestVersion.current += 1;
    setLoadedStage('');
    setIsLoading(false);
    setConfig({ isActive: true, skipWeekends: true, steps: [] });
  };

  const addStep = (day: number = 1) => {
    setConfig(prev => {
      const newSteps = [...prev.steps, { id: Date.now().toString(), method: 'call', day, intervalValue: 0, intervalType: 'minutes', title: 'Nova Ação', template: '' }];
      newSteps.sort((a, b) => (a.day || 1) - (b.day || 1));
      return { ...prev, steps: newSteps };
    });
  };

  const updateStep = (index: number, field: string, value: any) => {
    let newSteps = [...config.steps];
    newSteps[index][field] = value;
    if (field === 'day') {
      newSteps.sort((a, b) => (a.day || 1) - (b.day || 1));
    }
    setConfig({ ...config, steps: newSteps });
  };

  const removeStep = (index: number) => {
    const newSteps = [...config.steps];
    newSteps.splice(index, 1);
    setConfig({ ...config, steps: newSteps });
  };

  const groupedSteps = config.steps.reduce((acc, step, index) => {
    const day = step.day !== undefined ? step.day : 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push({ ...step, originalIndex: index });
    return acc;
  }, {} as Record<number, any[]>);

  const sortedDays = Object.keys(groupedSteps).map(Number).sort((a, b) => a - b);

  const currentFunnelObj = funnels.find(f => f.code === selectedFunnel || String(f.id) === selectedFunnel);
  const stages = currentFunnelObj ? currentFunnelObj.stages || [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cadência de Contatos</h2>
        <p className="text-muted-foreground">Automatize o fluxo de contatos para os leads em cada etapa do funil.</p>
      </div>

      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex gap-4 text-blue-900 transition-all">
        <div className="bg-blue-100 p-3 rounded-full h-fit shrink-0">
          <MessageCircle className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <div 
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsBannerOpen(!isBannerOpen)}
          >
            <h3 className="font-semibold text-lg m-0">Como funciona a Cadência Automática?</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-700 hover:text-blue-800 hover:bg-blue-200/50 rounded-full">
              {isBannerOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
          
          {isBannerOpen && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-sm text-blue-800/80 mb-3">
                A cadência de contatos é uma sequência de ações pré-programadas para garantir que o seu time comercial ou de atendimento 
                siga o roteiro ideal de abordagem. Ao mover um lead para a etapa configurada, o SellClin criará <b>automaticamente</b> as tarefas para os consultores executarem.
              </p>
              <ul className="text-sm text-blue-800/80 space-y-2 list-disc list-inside">
                <li><b>Dia 1:</b> As tarefas do Dia 1 serão criadas imediatamente quando o lead entrar na etapa.</li>
                <li><b>Dias seguintes:</b> Tarefas do Dia 2 serão criadas para vencer amanhã, Dia 3 para depois de amanhã, e assim por diante.</li>
                <li>O vendedor verá sua lista exata de afazeres agrupada por dia. Se ele se atrasar, as tarefas acumulam para não perder tração!</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Funil e Etapa</CardTitle>
          <CardDescription>Escolha em qual etapa do funil a cadência será configurada.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label>Funil de Vendas</Label>
            <Select disabled={isLoading && loadedStage === selectedStage} value={selectedFunnel} onValueChange={value => { resetSelection(); setSelectedStage(''); setSelectedFunnel(value); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funil...">{currentFunnelObj?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {funnels.map(f => (
                  <SelectItem key={f.id} value={f.code || f.id.toString()}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-2">
            <Label>Etapa do Funil</Label>
            <Select value={selectedStage} onValueChange={value => { resetSelection(); setSelectedStage(value); }} disabled={!selectedFunnel || (isLoading && loadedStage === selectedStage)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa...">{stages.find((s: any) => s.code === selectedStage)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stages.map((s: any) => (
                  <SelectItem key={s.id} value={s.code}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>


      {selectedStage && loadedStage !== selectedStage && <p role="status">{isLoading ? 'Carregando cadência...' : 'Não foi possível carregar a cadência. Selecione a etapa novamente.'}</p>}
      {selectedStage && loadedStage === selectedStage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Passos da Cadência</CardTitle>
              <CardDescription>Configure os passos automáticos quando o lead entrar nesta etapa.</CardDescription>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="skip-weekends" 
                  checked={config.skipWeekends} 
                  onCheckedChange={(checked) => setConfig({ ...config, skipWeekends: checked })}
                />
                <Label htmlFor="skip-weekends" className="cursor-pointer">Ignorar Finais de Semana</Label>
              </div>
              <Button onClick={saveConfig} disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.steps.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-md border border-dashed">
                <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Nenhuma ação configurada.</p>
                <Button variant="outline" className="mt-4" onClick={() => addStep(1)}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Ação no Dia 1
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {sortedDays.map((day) => (
                  <div key={day} className="border-l-4 border-blue-500 pl-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-slate-800">Dia {day}</h3>
                      <Button variant="ghost" size="sm" onClick={() => addStep(day)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Ação ao Dia {day}
                      </Button>
                    </div>

                    {groupedSteps[day].map((step, idx) => (
                      <div key={step.id || step.originalIndex} className="border rounded-md p-4 bg-white shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                          <Badge variant="outline" className="bg-slate-100 text-slate-500">Ação {idx + 1}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => removeStep(step.originalIndex)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label>Dia de Execução</Label>
                            <Input 
                              type="number" 
                              min="1"
                              value={step.day !== undefined ? step.day : 1} 
                              onChange={e => updateStep(step.originalIndex, 'day', Number(e.target.value))} 
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Espera (após ação anterior)</Label>
                            <div className="flex gap-2">
                              <Input 
                                type="number" 
                                min="0"
                                className="w-24"
                                value={step.intervalValue ?? (step.intervalMinutes || 0)} 
                                onChange={e => updateStep(step.originalIndex, 'intervalValue', Number(e.target.value))} 
                              />
                              <Select 
                                value={step.intervalType || 'minutes'} 
                                onValueChange={v => updateStep(step.originalIndex, 'intervalType', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Tipo">
                                    {step.intervalType === 'hours' ? 'Horas' : 'Minutos'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minutes">Minutos</SelectItem>
                                  <SelectItem value="hours">Horas</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Título da Tarefa</Label>
                            <Input 
                              value={step.title} 
                              onChange={e => updateStep(step.originalIndex, 'title', e.target.value)} 
                              placeholder="Ex: Primeira Ligação"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Canal de Contato</Label>
                            <Select value={step.method} onValueChange={v => updateStep(step.originalIndex, 'method', v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o canal...">{{ call: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', other: 'Outro' }[step.method as string] || 'Outro'}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call"><div className="flex items-center gap-2"><Phone className="h-4 w-4"/> Ligação</div></SelectItem>
                                <SelectItem value="whatsapp"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4"/> WhatsApp</div></SelectItem>
                                <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="h-4 w-4"/> E-mail</div></SelectItem>
                                <SelectItem value="other"><div className="flex items-center gap-2">Outro</div></SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Template de Mensagem / Roteiro</Label>
                          <Textarea 
                            value={step.template} 
                            onChange={e => updateStep(step.originalIndex, 'template', e.target.value)}
                            placeholder="Escreva o script ou mensagem sugerida para o vendedor..."
                            rows={3}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <Button variant="outline" className="w-full mt-8 border-dashed" onClick={() => addStep((sortedDays[sortedDays.length - 1] || 0) + 1)}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Novo Dia de Cadência
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
