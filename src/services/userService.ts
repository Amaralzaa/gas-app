import { supabase } from '../lib/supabase';
import { AppUser } from '../types';

export const userService = {
  async getProfiles(): Promise<AppUser[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      email: p.email,
      role: p.role,
      name: p.name,
      phone: p.phone,
      points: p.points,
      addresses: p.addresses || [],
      location: p.location,
    }));
  },

  async updateProfile(userId: string, updates: Partial<AppUser>): Promise<void> {
    // 1. Salva imediatamente em cache local para nunca perder o nome mesmo sem rede
    if (updates.name && updates.name.trim() && updates.name !== 'Cliente' && updates.name !== 'Usuário') {
      try {
        localStorage.setItem('gas_app_customer_name', updates.name.trim());
        localStorage.setItem('gas_app_onboarding_completed', 'true');
      } catch {}
    }

    // 2. Atualiza metadata do auth se o usuário estiver logado
    if (updates.name) {
      try {
        await supabase.auth.updateUser({
          data: { name: updates.name.trim() }
        }).catch(() => {});
      } catch {}
    }

    // 3. Atualiza tabela profiles
    const { error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        phone: updates.phone,
        points: updates.points,
        addresses: updates.addresses,
        location: updates.location,
      })
      .eq('id', userId);

    if (error) {
      console.warn('Erro ao atualizar profiles no Supabase (mantido em cache local):', error);
    }
  }
};
