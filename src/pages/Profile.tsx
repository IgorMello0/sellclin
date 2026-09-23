import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Save,
  Edit2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { professionalsApi, uploadApi, getImageUrl } from '@/lib/api';

const Profile = ({ embedded = false }: { embedded?: boolean }) => {
  const { professional, updateProfileData } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Estados para recorte / ajuste de foto
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [origDimensions, setOrigDimensions] = useState({ width: 0, height: 0 });
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    crm: '',
    bio: '',
    photoUrl: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await professionalsApi.getMe();
      if (res.success && res.data) {
        const d = res.data;
        setFormData({
          name: d.name || '',
          email: d.email || '',
          phone: d.phone || '',
          specialization: d.specialization || '',
          crm: d.crm || '',
          bio: d.bio || '',
          photoUrl: d.photoUrl || '',
        });
        if (d.photoUrl) setProfileImage(d.photoUrl);
        updateProfileData({
          name: d.name || '',
          specialization: d.specialization || '',
          photoUrl: d.photoUrl || undefined
        });
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível carregar o perfil', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Efeito global de drag & drop da imagem
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };
    
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, dragStart, scale, minScale, origDimensions]);

  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;
    
    const renderedWidth = origDimensions.width * minScale * scale;
    const renderedHeight = origDimensions.height * minScale * scale;
    const maxDragX = Math.max(0, (renderedWidth - 256) / 2);
    const maxDragY = Math.max(0, (renderedHeight - 256) / 2);
    
    setPosition({
      x: Math.max(-maxDragX, Math.min(maxDragX, newX)),
      y: Math.max(-maxDragY, Math.min(maxDragY, newY))
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextScale = parseFloat(e.target.value);
    setScale(nextScale);
    
    const renderedWidth = origDimensions.width * minScale * nextScale;
    const renderedHeight = origDimensions.height * minScale * nextScale;
    const maxDragX = Math.max(0, (renderedWidth - 256) / 2);
    const maxDragY = Math.max(0, (renderedHeight - 256) / 2);
    
    setPosition(prev => ({
      x: Math.max(-maxDragX, Math.min(maxDragX, prev.x)),
      y: Math.max(-maxDragY, Math.min(maxDragY, prev.y))
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast({ title: 'Erro', description: 'Imagem deve ter no máximo 15MB.', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setImageToCrop(url);
        
        const img = new Image();
        img.onload = () => {
          const w = img.width;
          const h = img.height;
          setOrigDimensions({ width: w, height: h });
          
          const calculatedMinScale = Math.max(256 / w, 256 / h);
          setMinScale(calculatedMinScale);
          setScale(1);
          setPosition({ x: 0, y: 0 });
          setCropModalOpen(true);
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !selectedFile) return;
    
    setCropModalOpen(false);
    setUploadingImage(true);
    
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 400);
        
        const canvasScale = 400 / 256;
        const renderedWidth = origDimensions.width * minScale * scale;
        const renderedHeight = origDimensions.height * minScale * scale;
        const left = 128 + position.x - renderedWidth / 2;
        const top = 128 + position.y - renderedHeight / 2;
        
        ctx.drawImage(
          img,
          left * canvasScale,
          top * canvasScale,
          renderedWidth * canvasScale,
          renderedHeight * canvasScale
        );
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            const croppedFile = new File([blob], selectedFile.name, { type: 'image/jpeg' });
            
            try {
              const res = await uploadApi.uploadImage(croppedFile);
              if (res.success && res.data?.url) {
                setProfileImage(res.data.url);
                setFormData(prev => ({ ...prev, photoUrl: res.data.url }));
                toast({ title: 'Sucesso', description: 'Imagem ajustada com sucesso!' });
              } else {
                throw new Error(res.error?.message || 'Erro no envio');
              }
            } catch (error) {
              console.error(error);
              toast({ title: 'Erro ao carregar', description: 'Não foi possível enviar a imagem ao servidor.', variant: 'destructive' });
              setProfileImage(formData.photoUrl || null);
            } finally {
              setUploadingImage(false);
            }
          }
        }, 'image/jpeg', 0.95);
      }
    };
    img.src = imageToCrop;
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: 'Atenção', description: 'O nome é obrigatório.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await professionalsApi.updateMe({
        name: formData.name,
        phone: formData.phone || null,
        specialization: formData.specialization || null,
        crm: formData.crm || null,
        bio: formData.bio || null,
        photoUrl: formData.photoUrl || null,
      });
      if (res.success) {
        toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.' });
        updateProfileData({
          name: formData.name,
          specialization: formData.specialization,
          photoUrl: formData.photoUrl || undefined
        });
        setIsEditing(false);
      } else {
        throw new Error(res.error?.message || 'Erro ao salvar');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${embedded ? '' : 'p-4 sm:p-6 md:p-8'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Meu Perfil</h1>
          <p className="text-slate-500 mt-1">
            Gerencie suas informações pessoais e profissionais
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); loadProfile(); }} className="rounded-xl font-headline border-slate-200">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-secondary hover:bg-secondary/90 text-primary font-bold rounded-xl font-headline shadow-lg shadow-secondary/20">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl font-headline shadow-lg shadow-primary/20">
              <Edit2 className="h-4 w-4 mr-2" />
              Editar Perfil
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Picture & Basic Info */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100/50 shadow-sm rounded-3xl overflow-hidden hover-card">
            <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/40">
              <CardTitle className="flex items-center gap-2 text-primary font-headline text-lg">
                <span className="material-symbols-outlined text-secondary text-[22px]">account_circle</span>
                Foto do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="relative inline-block">
                <Avatar className="h-32 w-32 border-4 border-white shadow-xl relative overflow-hidden">
                  <AvatarImage src={profileImage ? getImageUrl(profileImage) : undefined} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-headline">
                    {getInitials(formData.name || 'U')}
                  </AvatarFallback>
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider">
                      Enviando...
                    </div>
                  )}
                </Avatar>
                {isEditing && (
                  <Label
                    htmlFor="profile-image"
                    className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-secondary text-primary flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-lg border-2 border-white"
                  >
                    <Camera className="h-4 w-4" />
                  </Label>
                )}
                <Input
                  id="profile-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              
              <div className="space-y-2 pb-2">
                <h3 className="text-xl font-bold text-primary font-headline">{formData.name}</h3>
                {formData.specialization && (
                  <Badge className="bg-secondary/10 text-secondary border-secondary/20 font-bold px-3 py-1 rounded-full mb-2">
                    {formData.specialization}
                  </Badge>
                )}
                {formData.crm && (
                  <p className="text-sm font-medium text-slate-500 bg-slate-50 py-1 rounded-lg">
                    {formData.crm}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100/50 shadow-sm rounded-3xl overflow-hidden hover-card">
            <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/40">
              <CardTitle className="flex items-center gap-2 text-primary font-headline text-lg">
                <span className="material-symbols-outlined text-secondary text-[22px]">info</span>
                Resumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                <span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5 shrink-0">mail</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail</p>
                  <p className="text-sm font-semibold text-primary truncate mt-0.5" title={formData.email}>
                    {formData.email}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                <span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5 shrink-0">phone</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telefone</p>
                  <p className="text-sm font-semibold text-primary truncate mt-0.5">
                    {formData.phone || 'Não informado'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                <span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5 shrink-0">badge</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CRM</p>
                  <p className="text-sm font-semibold text-primary truncate mt-0.5">
                    {formData.crm || 'Não informado'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5 shrink-0">workspace_premium</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plano Contratado</p>
                  <p className="text-sm font-semibold text-primary mt-0.5">
                    {professional?.role === 'admin' ? 'Plano Developer' : 'SellClin Pro'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Profile Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100/50 shadow-sm rounded-3xl overflow-hidden hover-card">
            <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/40">
              <CardTitle className="flex items-center gap-2 text-primary font-headline text-lg">
                <span className="material-symbols-outlined text-secondary text-[22px]">person</span>
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-secondary/20 focus-visible:border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Especialização</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-secondary/20 focus-visible:border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-slate-100 border-slate-200 rounded-xl cursor-not-allowed opacity-60"
                  />
                  <p className="text-[10px] text-muted-foreground">O e-mail não pode ser alterado por aqui.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!isEditing}
                    placeholder="(11) 99999-9999"
                    className="bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-secondary/20 focus-visible:border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crm">CRM / Registro Profissional</Label>
                  <Input
                    id="crm"
                    value={formData.crm}
                    onChange={(e) => setFormData({ ...formData, crm: e.target.value })}
                    disabled={!isEditing}
                    placeholder="CRM-SP 123456"
                    className="bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-secondary/20 focus-visible:border-secondary"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Biografia Profissional</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                  placeholder="Descreva sua experiência e especialidades..."
                  className="bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-secondary/20 focus-visible:border-secondary resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security & Privacy */}
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100/50 shadow-sm rounded-3xl overflow-hidden hover-card">
            <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/40">
              <CardTitle className="flex items-center gap-2 text-primary font-headline text-lg">
                <span className="material-symbols-outlined text-secondary text-[22px]">shield</span>
                Segurança e Privacidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white/50 hover:bg-white transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">lock</span>
                  </div>
                  <div>
                    <p className="font-semibold text-primary font-headline">Alterar Senha</p>
                    <p className="text-sm text-slate-500">
                      Redefina sua senha de acesso
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/configuracoes?tab=seguranca')}>
                  Alterar
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white/50 hover:bg-white transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">notifications</span>
                  </div>
                  <div>
                    <p className="font-semibold text-primary font-headline">Notificações</p>
                    <p className="text-sm text-slate-500">
                      Gerenciar preferências de notificação
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/configuracoes?tab=notificacoes')}>
                  Configurar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    {/* Modal de Recorte / Ajuste de Imagem */}
      {cropModalOpen && imageToCrop && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/50 shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-primary font-headline">Ajustar Foto do Perfil</h3>
              <p className="text-xs text-slate-500">Arraste e ajuste o zoom da imagem</p>
            </div>
            
            <div 
              className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 cursor-move select-none"
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
            >
              <img
                src={imageToCrop}
                alt="Ajuste"
                className="absolute pointer-events-none select-none max-w-none origin-center"
                style={{
                  width: `${origDimensions.width * minScale * scale}px`,
                  height: `${origDimensions.height * minScale * scale}px`,
                  left: `${128 + position.x - (origDimensions.width * minScale * scale) / 2}px`,
                  top: `${128 + position.y - (origDimensions.height * minScale * scale) / 2}px`,
                }}
              />
            </div>
            
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Zoom</span>
                <span>{Math.round(scale * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400 text-[18px]">zoom_out</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={scale}
                  onChange={handleZoomChange}
                  className="flex-1 custom-slider"
                />
                <span className="material-symbols-outlined text-slate-400 text-[18px]">zoom_in</span>
              </div>
            </div>
            
            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                onClick={() => { setCropModalOpen(false); setSelectedFile(null); }} 
                className="flex-1 rounded-xl font-headline border-slate-200"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCropConfirm} 
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-bold rounded-xl font-headline shadow-lg shadow-secondary/20"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
