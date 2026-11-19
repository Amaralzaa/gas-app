import { RedeemedReward } from '../types';

const STORAGE_KEY = 'gas_app_redeemed_rewards';

export const rewardService = {
  /**
   * Obtém todos os resgates salvos no dispositivo, opcionalmente filtrados por usuário.
   */
  getRedeemedRewards(userId?: string): RedeemedReward[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const list: RedeemedReward[] = JSON.parse(data);
      if (!Array.isArray(list)) return [];
      if (userId) {
        return list.filter(r => r.userId === userId);
      }
      return list;
    } catch {
      return [];
    }
  },

  /**
   * Salva ou atualiza um resgate de recompensa com código único.
   */
  saveRedeemedReward(redemption: RedeemedReward): void {
    try {
      const all = this.getRedeemedRewards();
      const index = all.findIndex(r => r.id === redemption.id || r.code === redemption.code);
      let updated: RedeemedReward[];
      if (index >= 0) {
        updated = [...all];
        updated[index] = redemption;
      } else {
        updated = [redemption, ...all];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Sincroniza via BroadcastChannel
      try {
        const channel = new BroadcastChannel('gas_app_sync_channel');
        channel.postMessage({ type: 'SYNC_REDEEMED_REWARDS', redeemedRewards: updated });
        channel.close();
      } catch {}
    } catch (e) {
      console.warn('Erro ao salvar resgate no storage local:', e);
    }
  },

  /**
   * Marca um resgate como utilizado em um pedido específico.
   */
  markRedeemedRewardAsUsed(codeOrId: string, orderId: string): void {
    try {
      const cleanTarget = codeOrId.trim().toUpperCase();
      const all = this.getRedeemedRewards();
      let changed = false;

      const updated = all.map(r => {
        if ((r.id === codeOrId || r.code.toUpperCase() === cleanTarget) && r.status === 'active') {
          changed = true;
          return {
            ...r,
            status: 'used' as const,
            usedAt: new Date().toISOString(),
            orderId: orderId
          };
        }
        return r;
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        try {
          const channel = new BroadcastChannel('gas_app_sync_channel');
          channel.postMessage({ type: 'SYNC_REDEEMED_REWARDS', redeemedRewards: updated });
          channel.close();
        } catch {}
      }
    } catch (e) {
      console.warn('Erro ao marcar resgate como usado:', e);
    }
  },

  /**
   * Encontra um resgate ativo (não utilizado) para um card de recompensa específico e usuário
   */
  getActiveRedemptionForReward(rewardId: string, userId: string): RedeemedReward | undefined {
    const list = this.getRedeemedRewards(userId);
    return list.find(r => r.rewardId === rewardId && r.status === 'active');
  },

  /**
   * Encontra um resgate pelo código único (case-insensitive)
   */
  findByCode(code: string): RedeemedReward | undefined {
    const clean = code.trim().toUpperCase();
    const all = this.getRedeemedRewards();
    return all.find(r => r.code.toUpperCase() === clean);
  }
};
