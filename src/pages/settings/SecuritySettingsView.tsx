import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from 'lucide-react';

export const SecuritySettingsView = () => {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.currentPassword || !formData.newPassword) {
      toast({ title: 'Aviso', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    if (formData.newPassword.length < 6) {
      toast({ title: 'Aviso', description: 'A nova senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast({ title: 'Aviso', description: 'As novas senhas não coincidem.', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.changePassword(formData.currentPassword, formData.newPassword);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Senha alterada. Entre novamente com a nova senha.' });
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        logout();
      } else {
        toast({ title: 'Erro', description: res.error?.message || 'Falha ao alterar senha.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Ocorreu um erro ao alterar a senha.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.currentPassword && formData.newPassword.length >= 6 && formData.newPassword === formData.confirmPassword;

  return (
    <div className="w-full max-w-5xl animate-in fade-in duration-500 pb-12 space-y-10">
      
      {/* Seção: Alterar Senha - Layout Dividido Moderno */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        
        {/* Lado Esquerdo: Textos e Explicações */}
        <div className="lg:w-1/3 shrink-0 pt-1">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Alterar Senha</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Atualize sua senha de acesso periodicamente para manter sua conta segura. Recomendamos o uso de senhas fortes com no mínimo 6 caracteres, combinando números e letras.
          </p>
        </div>

        {/* Lado Direito: Formulário */}
        <div className="lg:w-2/3 w-full">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <form onSubmit={handleSubmit}>
              
              <div className="p-6 md:p-8 space-y-6">
                
                {/* Senha Atual */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-sm font-semibold text-slate-700">Senha Atual</Label>
                  <Input 
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    placeholder="Digite sua senha atual"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-lg w-full max-w-md"
                  />
                </div>

                <div className="h-px bg-slate-100 w-full my-4"></div>

                {/* Nova Senha */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end max-w-md">
                     <Label htmlFor="newPassword" className="text-sm font-semibold text-slate-700">Nova Senha</Label>
                     <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Mín. 6 caracteres</span>
                  </div>
                  <Input 
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    placeholder="Sua nova senha"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-lg w-full max-w-md"
                  />
                </div>

                {/* Confirmar Nova Senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">Confirme a Nova Senha</Label>
                  <Input 
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-lg w-full max-w-md"
                  />
                </div>

              </div>

              {/* Footer do formulário com botão */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end">
                <Button 
                  type="submit" 
                  disabled={loading || !isFormValid}
                  className={`h-10 px-6 rounded-lg font-bold transition-all shadow-sm
                    ${!isFormValid 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200' 
                      : 'bg-primary hover:bg-orange-600 text-white'}`}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                </Button>
              </div>

            </form>
          </div>
        </div>

      </div>

    </div>
  );
};
