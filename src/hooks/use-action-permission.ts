import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useActionPermission() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  return (module: string, key: string) => {
    if (hasPermission(module, key)) return true;
    toast({ title: 'Acesso restrito', description: 'Seu cargo não permite realizar esta ação.', variant: 'destructive' });
    return false;
  };
}
