import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { permissionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import * as LucideIcons from 'lucide-react';

interface Module {
  moduleId: number;
  moduleCode: string;
  moduleName: string;
  moduleIcon?: string;
  hasAccess: boolean;
  canEdit?: boolean;
}

interface ModulesAccessTabProps {
  targetId: number;
  targetType: 'professional' | 'user';
}

const INTERNAL_ONLY_MODULES = new Set(['pagamentos', 'catalogos', 'contratos', 'relatorios']);

export const ModulesAccessTab = ({ targetId, targetType }: ModulesAccessTabProps) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadModules();
  }, [targetId, targetType]);

  const loadModules = async () => {
    setIsLoading(true);
    try {
      const response = targetType === 'professional'
        ? await permissionsApi.getProfessionalPermissions(targetId)
        : await permissionsApi.getUserPermissions(targetId);

      if (response.success && response.data) {
        setModules(response.data.filter((module: Module) => !INTERNAL_ONLY_MODULES.has(module.moduleCode)));
      } else {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar permissões',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('[ModulesAccessTab] Error loading modules:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar permissões',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleModule = async (moduleId: number, currentAccess: boolean) => {
    // Se for usuário e o profissional não tem acesso (canEdit = false), não permitir edição
    const module = modules.find((m) => m.moduleId === moduleId);
    if (targetType === 'user' && module?.canEdit === false) {
      toast({
        title: 'Acesso negado',
        description: 'Você não pode liberar este módulo pois você não tem acesso a ele',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newAccess = !currentAccess;
      
      // Atualizar permissão no backend
      const updateFunc = targetType === 'professional'
        ? permissionsApi.updateProfessionalPermissions
        : permissionsApi.updateUserPermissions;

      const response = await updateFunc(targetId, [
        { moduleId, hasAccess: newAccess },
      ]);

      if (response.success) {
        // Atualizar estado local
        setModules(modules.map((m) =>
          m.moduleId === moduleId ? { ...m, hasAccess: newAccess } : m
        ));

        toast({
          title: 'Sucesso',
          description: `Permissão ${newAccess ? 'concedida' : 'removida'} com sucesso`,
        });
      } else {
        toast({
          title: 'Erro',
          description: response.error?.message || 'Erro ao atualizar permissão',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('[ModulesAccessTab] Error updating permission:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar permissão',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getIcon = (iconName?: string) => {
    if (!iconName) return LucideIcons.Box;
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.Box;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Módulos do Sistema</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {targetType === 'professional'
            ? 'Controle quais módulos este profissional pode acessar'
            : 'Controle quais módulos este usuário pode acessar'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((module) => {
          const Icon = getIcon(module.moduleIcon);
          const isDisabled = targetType === 'user' && module.canEdit === false;
          
          return (
            <Card 
              key={module.moduleId} 
              className={`${module.hasAccess ? 'border-primary/50' : ''} ${isDisabled ? 'opacity-50' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      module.hasAccess ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-5 w-5 ${module.hasAccess ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{module.moduleName}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {module.moduleCode}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    id={`module-${module.moduleId}`}
                    checked={module.hasAccess}
                    disabled={isSaving || isDisabled}
                    onCheckedChange={() => handleToggleModule(module.moduleId, module.hasAccess)}
                  />
                </div>
              </CardHeader>
              {isDisabled && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground italic">
                    Você não tem acesso a este módulo
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {modules.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nenhum módulo encontrado
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-semibold text-sm">i</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Informação sobre Módulos</p>
              <p className="text-xs text-muted-foreground">
                {targetType === 'professional'
                  ? 'As alterações são salvas automaticamente. O profissional verá apenas os módulos habilitados.'
                  : 'Usuários só podem ter acesso aos módulos que você (profissional) também possui. As alterações são salvas automaticamente.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
