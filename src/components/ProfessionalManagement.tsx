import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Calendar,
  Mail,
  Phone,
  Search,
  Filter,
  Save,
  CheckCircle,
  Tag,
  Loader2,
} from 'lucide-react';
import { ModulesAccessTab } from './ModulesAccessTab';
import { FormModelsTab } from './FormModelsTab';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { professionalsApi, categoriesApi } from '@/lib/api';

export const ProfessionalManagement = () => {
  const { toast } = useToast();
  const [professionals, setProfessionals] = useState<Array<{
    id: number;
    name: string;
    specialty: string;
    email: string;
    phone: string | null;
    status: string;
    appointments: number;
    assignedCategories?: string[];
  }>>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedCategories, setAssignedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profResponse, catResponse] = await Promise.all([
        professionalsApi.getAll({ page: 1, pageSize: 100 }),
        categoriesApi.getAll({ page: 1, pageSize: 100 }),
      ]);

      if (profResponse.success && profResponse.data) {
        const professionalsData = profResponse.data.map((prof: any) => ({
          id: prof.id,
          name: prof.name,
          specialty: prof.specialization || 'Sem especialização',
          email: prof.email,
          phone: prof.phone,
          status: 'ativo',
          appointments: prof.appointments?.length || 0,
          assignedCategories: prof.categories?.map((c: any) => c.id.toString()) || [],
        }));
        setProfessionals(professionalsData);
        if (professionalsData.length > 0 && !selectedProfessional) {
          setSelectedProfessional(professionalsData[0]);
          setAssignedCategories(professionalsData[0].assignedCategories || []);
        }
      }

      if (catResponse.success && catResponse.data) {
        const categoriesData = catResponse.data.map((cat: any) => ({
          id: cat.id.toString(),
          name: cat.name,
          description: cat.description,
          status: cat.status,
        }));
        setCategories(categoriesData);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProfessionals = professionals.filter((prof) => {
    const matchesSearch = prof.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         prof.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || prof.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Atualiza as categorias atribuídas quando o profissional selecionado muda
  const handleProfessionalSelect = (prof: any) => {
    setSelectedProfessional(prof);
    setAssignedCategories(prof.assignedCategories || []);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newAssignedCategories = assignedCategories.includes(categoryId)
      ? assignedCategories.filter(id => id !== categoryId)
      : [...assignedCategories, categoryId];
    
    setAssignedCategories(newAssignedCategories);
  };

  const handleSaveConfiguration = () => {
    // Atualiza as categorias do profissional selecionado
    setProfessionals(professionals.map(prof => 
      prof.id === selectedProfessional.id 
        ? { ...prof, assignedCategories }
        : prof
    ));

    // Simula salvamento
    toast({
      title: "Configurações salvas com sucesso!",
      description: `As configurações de ${selectedProfessional.name} foram atualizadas.`,
      duration: 3000,
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gerenciamento de Profissionais</h2>
          <p className="text-muted-foreground">
            Configure módulos, permissões e fichas para cada profissional
          </p>
        </div>
        <Button onClick={handleSaveConfiguration} size="lg">
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou especialidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar status">
                  {statusFilter === 'all' ? 'Todos' : statusFilter === 'ativo' ? 'Ativo' : 'Inativo'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Professional Selection */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando profissionais...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {filteredProfessionals.map((prof) => (
          <Card
            key={prof.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedProfessional?.id === prof.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleProfessionalSelect(prof)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <Badge variant={prof.status === 'ativo' ? 'default' : 'secondary'}>
                  {prof.status}
                </Badge>
              </div>
              <h3 className="font-semibold text-lg mb-1">{prof.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{prof.specialty}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{prof.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{prof.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{prof.appointments} agendamentos</span>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}

      {/* Professional Details and Configuration */}
      {selectedProfessional && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{selectedProfessional.name}</CardTitle>
                <CardDescription>{selectedProfessional.specialty}</CardDescription>
              </div>
              {selectedProfessional.status === 'ativo' && (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Ativo
                </Badge>
              )}
            </div>
          </CardHeader>
        <CardContent>
          <Tabs defaultValue="modules" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="modules">Módulos e Acessos</TabsTrigger>
              <TabsTrigger value="forms">Modelos de Fichas</TabsTrigger>
              <TabsTrigger value="categories">Categorias Atribuídas</TabsTrigger>
            </TabsList>

            <TabsContent value="modules" className="mt-6">
              <ModulesAccessTab targetId={selectedProfessional.id} targetType="professional" />
            </TabsContent>

            <TabsContent value="forms" className="mt-6">
              <FormModelsTab professionalId={selectedProfessional.id.toString()} />
            </TabsContent>

            <TabsContent value="categories" className="mt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Categorias Atribuídas</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione quais categorias este profissional pode usar em seus catálogos
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories
                    .filter(category => category.status === 'ativo')
                    .map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={`category-${category.id}`}
                          checked={assignedCategories.includes(category.id)}
                          onCheckedChange={() => handleCategoryToggle(category.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" />
                            <label
                              htmlFor={`category-${category.id}`}
                              className="font-medium cursor-pointer"
                            >
                              {category.name}
                            </label>
                          </div>
                          {category.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {assignedCategories.length > 0 && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Categorias Selecionadas:</h4>
                    <div className="flex flex-wrap gap-2">
                      {assignedCategories.map((categoryId) => {
                        const category = categories.find(cat => cat.id === categoryId);
                        return (
                          <Badge key={categoryId} variant="secondary" className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {category?.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}
    </div>
  );
};
