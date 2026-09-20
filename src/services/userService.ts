import { supabase } from '../lib/supabase';
import { AppUser, PointHistoryItem } from '../types';

export const userService = {
  getPointHistory(userId: string): PointHistoryItem[] {
    try {
      const saved = localStorage.getItem(`gas_app_point_history_${userId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  },

  savePointHistory(userId: string, history: PointHistoryItem[]): void {
    try {
      localStorage.setItem(`gas_app_point_history_${userId}`, JSON.stringify(history));
    } catch {}
  },

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
      pointHistory: this.getPointHistory(p.id)
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

    // 2. Salva histórico de pontos no cache local se fornecido
    if (updates.pointHistory) {
      this.savePointHistory(userId, updates.pointHistory);
    }

    // 3. Atualiza metadata do auth se o usuário estiver logado
    if (updates.name) {
      try {
        await supabase.auth.updateUser({
          data: { name: updates.name.trim() }
        }).catch(() => {});
      } catch {}
    }

    // 4. Monta objeto de atualização apenas com as colunas válidas da tabela profiles
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.points !== undefined) dbUpdates.points = updates.points;
    if (updates.addresses !== undefined) dbUpdates.addresses = updates.addresses;
    if (updates.location !== undefined) dbUpdates.location = updates.location;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId);

      if (error) {
        console.warn('Erro ao atualizar profiles no Supabase (mantido em cache local):', error);
      }
    }
  }
};
