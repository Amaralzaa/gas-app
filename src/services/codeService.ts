// Serviço centralizado para geração, validação e formatação de códigos únicos (Resgates e Indicações)

const CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Caracteres sem ambiguidade visual (sem 0, O, 1, I, L)

/**
 * Gera um hash determinístico a partir de uma string para garantir que
 * o mesmo usuário sempre tenha o mesmo código mesmo sem persistência prévia no banco.
 */
function hashStringToToken(str: string, length = 6): string {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ (char * 33);
  }
  let combined = Math.abs((hash1 * 31 + hash2) >>> 0);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARSET[combined % CODE_CHARSET.length];
    combined = Math.floor(combined / CODE_CHARSET.length) + (str.charCodeAt(i % str.length) || 13) * 17;
  }
  return result;
}

export const codeService = {
  /**
   * Gera um código verdadeiramente único e aleatório com prefixo
   * Ex: generateUniqueCode('RESG') => 'RESG-9K4M8P'
   */
  generateUniqueCode(prefix: string, length = 6): string {
    let token = '';
    const array = new Uint32Array(length);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        token += CODE_CHARSET[array[i] % CODE_CHARSET.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        token += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
      }
    }
    return `${prefix.toUpperCase()}-${token}`;
  },

  /**
   * Gera código único para resgate de recompensas
   * Ex: 'RESG-7K9M2P'
   */
  generateRedemptionCode(): string {
    return this.generateUniqueCode('RESG', 6);
  },

  /**
   * Obtém ou gera o código de indicação único e consistente do usuário.
   * Se o usuário já tiver um código salvo, respeita-o.
   * Se não tiver, gera um código no padrão 'IND-XXXXXX' determinístico com base no ID.
   */
  getUserReferralCode(user: { id?: string; name?: string; referralCode?: string } | null | undefined): string {
    if (!user) return 'IND-GUEST1';

    // 1. Se já tem código persistido e bem formatado
    if (user.referralCode && user.referralCode.trim().length >= 4) {
      const trimmed = user.referralCode.trim().toUpperCase();
      return trimmed.startsWith('IND-') ? trimmed : `IND-${trimmed}`;
    }

    // 2. Se tem no localStorage
    try {
      const saved = localStorage.getItem(`gas_app_referral_code_${user.id}`);
      if (saved && saved.trim()) {
        const trimmed = saved.trim().toUpperCase();
        return trimmed.startsWith('IND-') ? trimmed : `IND-${trimmed}`;
      }
    } catch {}

    // 3. Gera código estável baseado no ID do usuário
    const seed = (user.id || user.name || 'PORTOGAS').trim();
    const token = hashStringToToken(seed, 6);
    const generated = `IND-${token}`;

    try {
      if (user.id) {
        localStorage.setItem(`gas_app_referral_code_${user.id}`, generated);
      }
    } catch {}

    return generated;
  },

  /**
   * Validador resiliente e universal para casar códigos de indicação digitados
   * por novos clientes com qualquer usuário do sistema.
   * Aceita:
   * - 'IND-XXXXXX'
   * - 'XXXXXX' (sem prefixo)
   * - Códigos legados no formato 'NOME1234'
   */
  matchesReferralCode(user: { id: string; name?: string; referralCode?: string }, inputCode: string): boolean {
    if (!inputCode || !user) return false;

    const cleanInput = inputCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanInput) return false;

    // 1. Código oficial configurado
    const currentCode = this.getUserReferralCode(user).replace(/[^A-Z0-9]/g, '');
    if (currentCode && (cleanInput === currentCode || cleanInput === currentCode.replace(/^IND/, ''))) {
      return true;
    }

    // 2. Código explícito do usuário (se houver)
    if (user.referralCode) {
      const cleanUserCode = user.referralCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanInput === cleanUserCode || cleanInput === cleanUserCode.replace(/^IND/, '')) {
        return true;
      }
    }

    // 3. Compatibilidade retroativa com código legado: cleanName + cleanId (ex: RAFAELB45D)
    const cleanName = (user.name || 'CLIENTE').split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    const cleanId = (user.id || '1001').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    const legacyCode = `${cleanName}${cleanId}`.toUpperCase();
    if (cleanInput === legacyCode) {
      return true;
    }

    return false;
  },

  /**
   * Calcula e formata a expiração de um resgate
   * Ex: "Expira em 30 dias", "Expira em 1 dia", "Expira hoje" ou "Expirado"
   */
  formatDaysRemaining(validUntil?: string | null): { text: string; isExpired: boolean; daysRemaining: number } {
    if (!validUntil) {
      return { text: 'Sem prazo limite', isExpired: false, daysRemaining: 999 };
    }

    const now = Date.now();
    const expiry = new Date(validUntil).getTime();
    const diffMs = expiry - now;

    if (diffMs <= 0) {
      return { text: 'Expirado', isExpired: true, daysRemaining: 0 };
    }

    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return { text: 'Expira hoje', isExpired: false, daysRemaining: 0 };
    }
    if (daysRemaining === 1) {
      return { text: 'Expira em 1 dia', isExpired: false, daysRemaining: 1 };
    }
    return { text: `Expira em ${daysRemaining} dias`, isExpired: false, daysRemaining };
  }
};
