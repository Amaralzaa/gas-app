import { supabase } from '../lib/supabase';
import { BusinessInfo, DayHours, DeliveryPeriod } from '../types';

export const DEFAULT_DELIVERY_PERIODS: DeliveryPeriod[] = [
  {
    id: 'manha',
    name: 'Manhã',
    startTime: '08:00',
    endTime: '13:00',
    active: true,
    icon: 'sun'
  },
  {
    id: 'tarde',
    name: 'Tarde',
    startTime: '13:00',
    endTime: '19:00',
    active: true,
    icon: 'sunset'
  },
  {
    id: 'noite',
    name: 'Noite',
    startTime: '19:00',
    endTime: '22:00',
    active: false,
    icon: 'moon'
  }
];

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  id: 'default',
  name: 'Porto Gás Distribuidora',
  tradeName: 'Porto Gás & Água Express',
  cnpj: '',
  phone: '(21) 99999-9999',
  whatsapp: '(21) 99999-9999',
  email: 'contato@portogas.com.br',
  logoUrl: '',
  address: {
    street: 'Rua Principal',
    number: '100',
    neighborhood: 'Centro',
    city: 'Niterói',
    state: 'RJ',
    cep: '24020-000',
    complement: ''
  },
  openingHours: {
    monday:    { isOpen: true, open: '08:00', close: '19:00' },
    tuesday:   { isOpen: true, open: '08:00', close: '19:00' },
    wednesday: { isOpen: true, open: '08:00', close: '19:00' },
    thursday:  { isOpen: true, open: '08:00', close: '19:00' },
    friday:    { isOpen: true, open: '08:00', close: '19:00' },
    saturday:  { isOpen: true, open: '08:00', close: '18:00' },
    sunday:    { isOpen: true, open: '08:00', close: '14:00' }
  },
  isOpenOverride: null, // null = horário automático, true = forçar aberto, false = forçar fechado
  minOrderValue: 0,
  deliveryFee: 0,
  deliveryPeriods: DEFAULT_DELIVERY_PERIODS
};

export const businessService = {
  async getBusinessInfo(): Promise<BusinessInfo> {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!error && data) {
        // Se Supabase tiver delivery_periods, usa. Se não tiver, checa localStorage antes de voltar aos defaults
        let deliveryPeriods = (data.delivery_periods && Array.isArray(data.delivery_periods) && data.delivery_periods.length > 0)
          ? data.delivery_periods
          : null;

        if (!deliveryPeriods) {
          try {
            const saved = localStorage.getItem('gas_app_business_settings');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.deliveryPeriods && Array.isArray(parsed.deliveryPeriods) && parsed.deliveryPeriods.length > 0) {
                deliveryPeriods = parsed.deliveryPeriods;
              }
            }
          } catch {}
        }

        const info: BusinessInfo = {
          id: data.id || 'default',
          name: data.name || DEFAULT_BUSINESS_INFO.name,
          tradeName: data.trade_name || DEFAULT_BUSINESS_INFO.tradeName,
          cnpj: data.cnpj || '',
          phone: data.phone || DEFAULT_BUSINESS_INFO.phone,
          whatsapp: data.whatsapp || DEFAULT_BUSINESS_INFO.whatsapp,
          email: data.email || DEFAULT_BUSINESS_INFO.email,
          logoUrl: data.logo_url || '',
          address: data.address || DEFAULT_BUSINESS_INFO.address,
          openingHours: data.opening_hours || DEFAULT_BUSINESS_INFO.openingHours,
          isOpenOverride: data.is_open_override,
          minOrderValue: Number(data.min_order_value || 0),
          deliveryFee: Number(data.delivery_fee || 0),
          deliveryPeriods: deliveryPeriods || DEFAULT_DELIVERY_PERIODS,
          updatedAt: data.updated_at
        };
        try {
          localStorage.setItem('gas_app_business_settings', JSON.stringify(info));
        } catch {}
        return info;
      }
    } catch (e) {
      console.warn('Supabase business_settings indisponível, usando cache local:', e);
    }

    try {
      const saved = localStorage.getItem('gas_app_business_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.deliveryPeriods || !Array.isArray(parsed.deliveryPeriods) || parsed.deliveryPeriods.length === 0) {
          parsed.deliveryPeriods = DEFAULT_DELIVERY_PERIODS;
        }
        return parsed;
      }
    } catch {}

    return DEFAULT_BUSINESS_INFO;
  },

  async saveBusinessInfo(info: BusinessInfo): Promise<void> {
    // 1. Salva no localStorage imediatamente
    try {
      localStorage.setItem('gas_app_business_settings', JSON.stringify(info));
      const ch = new BroadcastChannel('gas_app_sync_channel');
      ch.postMessage({ type: 'SYNC_BUSINESS_INFO', businessInfo: info });
      ch.close();
      window.dispatchEvent(new CustomEvent('gas_app_business_info_updated', { detail: info }));
    } catch {}

    // 2. Persiste no Supabase
    try {
      const payload: any = {
        id: 'default',
        name: info.name,
        trade_name: info.tradeName || '',
        cnpj: info.cnpj || '',
        phone: info.phone,
        whatsapp: info.whatsapp || '',
        email: info.email || '',
        logo_url: info.logoUrl || null,
        address: info.address,
        opening_hours: info.openingHours,
        is_open_override: info.isOpenOverride,
        min_order_value: info.minOrderValue || 0,
        delivery_fee: info.deliveryFee || 0,
        delivery_periods: info.deliveryPeriods || DEFAULT_DELIVERY_PERIODS,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('business_settings')
        .upsert(payload);

      if (error) {
        console.warn('Aviso: Tabela business_settings ainda não possui a coluna ou não existe no Supabase. Salvo no cache local compartilhado.', error.message);
        if (error.message?.includes('delivery_periods') || error.code === '42703') {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.delivery_periods;
          try {
            await supabase.from('business_settings').upsert(fallbackPayload);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Erro ao salvar business_settings no Supabase:', err);
    }
  },

  getValidPeriodsForDay(dayHours: DayHours | undefined, allPeriods?: DeliveryPeriod[]): DeliveryPeriod[] {
    const list = (allPeriods && allPeriods.length > 0) ? allPeriods : DEFAULT_DELIVERY_PERIODS;
    const activeList = list.filter(p => p.active !== false);

    if (!dayHours || dayHours.isOpen === false) {
      return [];
    }

    const [openH, openM] = (dayHours.open || '08:00').split(':').map(Number);
    const [closeH, closeM] = (dayHours.close || '19:00').split(':').map(Number);
    const openMin = (openH || 8) * 60 + (openM || 0);
    const closeMin = (closeH || 19) * 60 + (closeM || 0);

    return activeList.filter(period => {
      const [startH, startM] = (period.startTime || '08:00').split(':').map(Number);
      const [endH, endM] = (period.endTime || '18:00').split(':').map(Number);
      const periodStart = (startH || 0) * 60 + (startM || 0);
      const periodEnd = (endH || 0) * 60 + (endM || 0);

      // O período deve se iniciar antes do fechamento da loja
      // e terminar após a abertura da loja
      return periodStart < closeMin && periodEnd > openMin;
    });
  },

  isStoreCurrentlyOpen(info?: BusinessInfo): { isOpen: boolean; reason: string; todayHours?: DayHours } {
    const current = info || DEFAULT_BUSINESS_INFO;

    // Se houver override manual definido pelo gestor
    if (current.isOpenOverride === true) {
      return { isOpen: true, reason: 'Estabelecimento aberto manualmente pelo gestor.' };
    }
    if (current.isOpenOverride === false) {
      return { isOpen: false, reason: 'Estabelecimento pausado temporariamente pelo gestor.' };
    }

    const now = new Date();
    const dayMap: { [k: number]: keyof typeof current.openingHours } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };

    const dayKey = dayMap[now.getDay()];
    const todayHours = current.openingHours?.[dayKey] || DEFAULT_BUSINESS_INFO.openingHours[dayKey];

    if (!todayHours.isOpen) {
      return { isOpen: false, reason: 'Fechado hoje.', todayHours };
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = todayHours.open.split(':').map(Number);
    const [closeH, closeM] = todayHours.close.split(':').map(Number);

    const openMinutes = (openH || 8) * 60 + (openM || 0);
    const closeMinutes = (closeH || 19) * 60 + (closeM || 0);

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return { isOpen: true, reason: `Aberto até as ${todayHours.close}`, todayHours };
    }

    if (currentMinutes < openMinutes) {
      return { isOpen: false, reason: `Abre hoje às ${todayHours.open}`, todayHours };
    }

    return { isOpen: false, reason: `Fechou às ${todayHours.close}. Pedidos agora apenas para agendamento.`, todayHours };
  },

  getNextDayFormatted(): { display: string; isoDate: string; weekName: string; formattedDate: string } {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    const dayOfWeekNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const weekName = dayOfWeekNames[d.getDay()];

    return {
      display: `Amanhã (${weekName}, ${day}/${month})`,
      isoDate: `${year}-${month}-${day}`,
      weekName,
      formattedDate: `${day}/${month}`
    };
  },

  formatScheduledDeliveryMessage(period: { name?: string; startTime: string; endTime: string }, dateInfo?: { display: string }): string {
    const d = dateInfo || businessService.getNextDayFormatted();
    return `Seu gás será entregue no período de ${period.startTime} às ${period.endTime} de ${d.display}`;
  }
};
