import { supabase } from '../lib/supabase';
import { Order, OrderStatus } from '../types';

export const orderService = {
  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapOrder);
  },

  isUuid(value?: string | null): boolean {
    return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  },

  async createOrder(order: Order): Promise<Order> {
    const payload: any = {
      customer_name: order.customerName,
      phone: order.phone,
      items: order.items,
      total: order.total,
      discount: order.discount || 0,
      coupon_code: order.couponCode || null,
      status: order.status,
      payment_method: order.paymentMethod,
      address: order.address,
      estimated_arrival: order.estimatedArrival || null,
      delivery_person_id: this.isUuid(order.deliveryPersonId) ? order.deliveryPersonId : null,
    };

    if (this.isUuid(order.customerId)) {
      payload.customer_id = order.customerId;
    } else {
      payload.customer_id = null;
    }

    if (this.isUuid(order.id)) {
      payload.id = order.id;
    }

    let feedback = order.feedback || '';
    if (order.completedAt && !feedback.includes('[Concluído em:')) {
      const completedNote = `[Concluído em: ${order.completedAt}]`;
      feedback = feedback ? `${feedback} | ${completedNote}` : completedNote;
    }

    const optional: Record<string, unknown> = {
      feedback: feedback || null,
      delivery_person_location: order.deliveryPersonLocation || null,
      is_scheduled: !!order.isScheduled,
      scheduled_date: order.scheduledDate || null,
      scheduled_date_iso: order.scheduledDateISO || null,
      scheduled_period: order.scheduledPeriod || null,
      scheduled_period_name: order.scheduledPeriodName || null,
      scheduled_time_range: order.scheduledTimeRange || null,
      selected_freebie: order.selectedFreebie || null,
      referral_id: order.referralId || null,
      is_force_activated: !!order.isForceActivated,
      completed_at: order.completedAt || null,
    };
    Object.assign(payload, optional);

    let { data, error } = await this.insertStrippingUnknown(payload);

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }
    const mapped = this.mapOrder(data);
    // Preserva os dados de agendamento originais caso tenha caído no fallback
    if (order.isScheduled) {
      mapped.isScheduled = true;
      mapped.scheduledDate = order.scheduledDate;
      mapped.scheduledPeriod = order.scheduledPeriod;
      mapped.scheduledTimeRange = order.scheduledTimeRange;
    }
    return mapped;
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const payload: any = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.deliveryPersonId !== undefined) payload.delivery_person_id = updates.deliveryPersonId;
    if (updates.estimatedArrival !== undefined) payload.estimated_arrival = updates.estimatedArrival;
    if (updates.deliveryPersonLocation !== undefined) payload.delivery_person_location = updates.deliveryPersonLocation;
    if (updates.rating !== undefined) payload.rating = updates.rating;
    if (updates.serviceRating !== undefined) payload.service_rating = updates.serviceRating;
    if (updates.deliveryRating !== undefined) payload.delivery_rating = updates.deliveryRating;
    if (updates.feedback !== undefined) payload.feedback = updates.feedback;
    if (updates.cancellationReason !== undefined) payload.cancellation_reason = updates.cancellationReason;
    if (updates.cancelledAt !== undefined) payload.cancelled_at = updates.cancelledAt;
    if (updates.completedAt) {
      payload.estimated_arrival = updates.completedAt;
      const completedNote = `[Concluído em: ${updates.completedAt}]`;
      if (payload.feedback) {
        if (!payload.feedback.includes('[Concluído em:')) {
          payload.feedback = `${payload.feedback} | ${completedNote}`;
        }
      } else {
        payload.feedback = completedNote;
      }
    }

    if (updates.completedAt) {
      payload.completed_at = updates.completedAt;
    }
    if (updates.isForceActivated !== undefined) payload.is_force_activated = updates.isForceActivated;
    if (updates.selectedFreebie !== undefined) payload.selected_freebie = updates.selectedFreebie;

    let { error } = await this.updateStrippingUnknown(orderId, payload);

    if (error) throw error;
  },

  subscribeToOrders(callback: (payload: any) => void) {
    return supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
      .subscribe();
  },

  mapOrder(dbOrder: any): Order {
    const feedbackReason = dbOrder.feedback?.startsWith('[Cancelamento]: ')
      ? dbOrder.feedback.replace('[Cancelamento]: ', '')
      : undefined;

    const isSchedFromNote = dbOrder.feedback?.includes('[Agendado para:');
    let schedDate = dbOrder.scheduled_date;
    let schedPeriod = dbOrder.scheduled_period;
    let schedRange = dbOrder.scheduled_time_range;

    if (!schedDate && isSchedFromNote) {
      if (dbOrder.feedback.includes('Manhã')) {
        schedPeriod = 'manha';
        schedRange = '08:00 às 13:00';
      } else if (dbOrder.feedback.includes('Tarde')) {
        schedPeriod = 'tarde';
        schedRange = '13:00 às 19:00';
      } else if (dbOrder.feedback.includes('Noite')) {
        schedPeriod = 'noite';
        schedRange = '19:00 às 22:00';
      }
    }

    const isCompletedFromNote = dbOrder.feedback?.includes('[Concluído em:');
    let completedAtDate = dbOrder.completed_at;
    if (!completedAtDate && isCompletedFromNote) {
      const match = dbOrder.feedback.match(/\[Concluído em:\s*([^\]]+)\]/);
      if (match) completedAtDate = match[1];
    }
    if (!completedAtDate && dbOrder.status === 'Concluído' && dbOrder.estimated_arrival) {
      completedAtDate = dbOrder.estimated_arrival;
    }

    let schedDateISO = dbOrder.scheduled_date_iso;
    if (!schedDateISO && schedDate) {
      const match = schedDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        schedDateISO = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }

    return {
      id: dbOrder.id,
      customerId: dbOrder.customer_id,
      customerName: dbOrder.customer_name || 'Cliente', // This might need a join or extra fetch
      phone: dbOrder.phone || '',
      address: dbOrder.address,
      items: dbOrder.items,
      total: Number(dbOrder.total),
      discount: Number(dbOrder.discount),
      paymentMethod: dbOrder.payment_method,
      status: dbOrder.status as OrderStatus,
      deliveryPersonId: dbOrder.delivery_person_id,
      createdAt: dbOrder.created_at,
      estimatedArrival: dbOrder.estimated_arrival,
      deliveryPersonLocation: dbOrder.delivery_person_location,
      rating: dbOrder.rating,
      serviceRating: dbOrder.service_rating,
      deliveryRating: dbOrder.delivery_rating,
      feedback: dbOrder.feedback,
      cancellationReason: dbOrder.cancellation_reason || feedbackReason,
      cancelledAt: dbOrder.cancelled_at,
      completedAt: completedAtDate,
      isScheduled: dbOrder.is_scheduled ?? (isSchedFromNote || false),
      scheduledDate: schedDate,
      scheduledDateISO: schedDateISO,
      scheduledPeriod: schedPeriod,
      scheduledPeriodName: dbOrder.scheduled_period_name,
      scheduledTimeRange: schedRange,
      selectedFreebie: dbOrder.selected_freebie || undefined,
      referralId: dbOrder.referral_id || undefined,
      isForceActivated: dbOrder.is_force_activated || false,
      couponCode: dbOrder.coupon_code || undefined,
    };
  },

  async insertStrippingUnknown(payload: Record<string, unknown>) {
    let current = { ...payload };
    for (let attempt = 0; attempt < 16; attempt++) {
      const res = await supabase.from('orders').insert(current).select().single();
      if (!res.error) return res;
      const stripped = this.stripUnknownColumn(current, res.error);
      if (!stripped) return res;
      current = stripped;
    }
    return supabase.from('orders').insert(current).select().single();
  },

  async updateStrippingUnknown(orderId: string, payload: Record<string, unknown>) {
    let current = { ...payload };
    for (let attempt = 0; attempt < 16; attempt++) {
      const res = await supabase.from('orders').update(current).eq('id', orderId);
      if (!res.error) return res;
      const stripped = this.stripUnknownColumn(current, res.error);
      if (!stripped) return res;
      current = stripped;
    }
    return supabase.from('orders').update(current).eq('id', orderId);
  },

  stripUnknownColumn(payload: Record<string, unknown>, error: { message?: string; code?: string }) {
    const msg = error?.message || '';
    const missingColumn = error?.code === 'PGRST204' || error?.code === '42703' || /column/i.test(msg);
    if (!missingColumn) return null;
    const key = Object.keys(payload).find((k) => msg.includes(k));
    if (!key) return null;
    const next = { ...payload };
    delete next[key];
    if (key === 'cancellation_reason' && payload.cancellation_reason && !next.feedback) {
      next.feedback = `[Cancelamento]: ${payload.cancellation_reason}`;
    }
    return next;
  }
};
