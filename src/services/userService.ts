import { supabase } from '../lib/supabase';
import { Address, AppUser, PointHistoryItem } from '../types';
import { codeService } from './codeService';

export const userService = {
  getAddressCache(userId: string): Address[] {
    try {
      const saved = localStorage.getItem(`gas_app_addresses_${userId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  },

  saveAddressCache(userId: string, addresses: Address[]): void {
    try {
      localStorage.setItem(`gas_app_addresses_${userId}`, JSON.stringify(addresses || []));
    } catch {}
  },

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
    return (data || []).map(p => {
      const cachedAddrs = this.getAddressCache(p.id);
      const addresses = (p.addresses && p.addresses.length > 0) ? p.addresses : cachedAddrs;
      if (p.addresses && p.addresses.length > 0) {
        this.saveAddressCache(p.id, p.addresses);
      }

      const userObj = {
        id: p.id,
        email: p.email,
        role: p.role,
        name: p.name,
        phone: p.phone,
        points: p.points,
        addresses,
        location: p.location,
        pointHistory: this.getPointHistory(p.id)
      };
      return {
        ...userObj,
        referralCode: p.referral_code || codeService.getUserReferralCode(userObj)
      };
    });
  },

  async updateProfile(userId: string, updates: Partial<AppUser>): Promise<boolean> {
    // 1. Salva imediatamente em cache local para nunca perder o nome mesmo sem rede
    if (updates.name && updates.name.trim() && updates.name !== 'Cliente' && updates.name !== 'Usuário') {
      try {
        localStorage.setItem('gas_app_customer_name', updates.name.trim());
        localStorage.setItem('gas_app_onboarding_completed', 'true');
      } catch {}
    }

    // 2. Salva endereços imediatamente no cache local para resiliência instantânea
    if (updates.addresses !== undefined) {
      this.saveAddressCache(userId, updates.addresses);
    }

    // 3. Salva código de indicação no cache local
    if (updates.referralCode) {
      try {
        localStorage.setItem(`gas_app_referral_code_${userId}`, updates.referralCode);
      } catch {}
    }

    // 4. Salva histórico de pontos no cache local se fornecido
    if (updates.pointHistory) {
      this.savePointHistory(userId, updates.pointHistory);
    }

    // 5. Atualiza metadata do auth se o usuário estiver logado
    if (updates.name) {
      try {
        await supabase.auth.updateUser({
          data: { name: updates.name.trim() }
        }).catch(() => {});
      } catch {}
    }

    // 6. Monta objeto de atualização apenas com as colunas válidas da tabela profiles
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.points !== undefined) dbUpdates.points = updates.points;
    if (updates.addresses !== undefined) dbUpdates.addresses = updates.addresses;
    if (updates.location !== undefined) dbUpdates.location = updates.location;

    if (Object.keys(dbUpdates).length > 0) {
      let attempts = 0;
      const maxAttempts = 3;
      let lastError = null;

      while (attempts < maxAttempts) {
        attempts++;
        const { error } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', userId);

        if (!error) {
          return true;
        }

        lastError = error;
        if (attempts < maxAttempts) {
          // Espera exponencial rápida (600ms, 1200ms) antes de tentar de novo
          await new Promise(r => setTimeout(r, 600 * attempts));
        }
      }

      if (lastError) {
        console.warn('Erro ao atualizar profiles no Supabase (mantido em cache local após retentativas):', lastError);
      }
      return false;
    }
    return true;
  }
};
