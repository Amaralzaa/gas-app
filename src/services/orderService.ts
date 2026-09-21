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

  async createOrder(order: Order): Promise<Order> {
    const payload: any = {
      customer_id: order.customerId,
      customer_name: order.customerName,
      phone: order.phone,
      items: order.items,
      total: order.total,
      discount: order.discount || 0,
      coupon_code: order.couponCode || null,
      status: order.status,
      payment_method: order.paymentMethod,
      address: order.address,
      estimated_arrival: order.estimatedArrival,
      feedback: order.feedback || null,
    };

    if (order.isScheduled) {
      payload.is_scheduled = true;
      payload.scheduled_date = order.scheduledDate || null;
      payload.scheduled_period = order.scheduledPeriod || null;
      payload.scheduled_time_range = order.scheduledTimeRange || null;
    }

    let { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select()
      .single();

    // Fallback se as novas colunas de agendamento ainda não foram aplicadas no Supabase
    if (error && (error.message?.includes('is_scheduled') || error.message?.includes('scheduled_date') || error.code === '42703')) {
      console.warn('Colunas de agendamento não encontradas no Supabase. Salvando com anotação em feedback...');
      const fallbackPayload = { ...payload };
      delete fallbackPayload.is_scheduled;
      delete fallbackPayload.scheduled_date;
      delete fallbackPayload.scheduled_period;
      delete fallbackPayload.scheduled_time_range;

      const periodLabel = order.scheduledPeriodName || (order.scheduledPeriod === 'manha' ? 'Manhã' : order.scheduledPeriod === 'tarde' ? 'Tarde' : order.scheduledPeriod || 'Agendado');
      const rangeLabel = order.scheduledTimeRange ? ` (${order.scheduledTimeRange})` : '';
      const schedNote = `[Agendado para: ${order.scheduledDate || 'Amanhã'} - ${periodLabel}${rangeLabel}]`;
      fallbackPayload.feedback = fallbackPayload.feedback ? `${fallbackPayload.feedback} | ${schedNote}` : schedNote;

      const retryRes = await supabase
        .from('orders')
        .insert(fallbackPayload)
        .select()
        .single();

      data = retryRes.data;
      error = retryRes.error;
    }

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
    if (updates.completedAt !== undefined) {
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

    let { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);

    // Se as colunas cancellation_reason ou cancelled_at ainda não foram criadas no banco Supabase
    if (error && (error.message?.includes('cancellation_reason') || error.message?.includes('cancelled_at') || error.code === 'PGRST204')) {
      console.warn('Colunas de cancelamento ainda não criadas no Supabase. Atualizando status com fallback seguro...');
      const fallbackPayload = { ...payload };
      delete fallbackPayload.cancellation_reason;
      delete fallbackPayload.cancelled_at;

      // Preserva o motivo em feedback caso o campo feedback esteja livre
      if (payload.cancellation_reason && !fallbackPayload.feedback) {
        fallbackPayload.feedback = `[Cancelamento]: ${payload.cancellation_reason}`;
      }

      const retryResult = await supabase
        .from('orders')
        .update(fallbackPayload)
        .eq('id', orderId);

      error = retryResult.error;
    }

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
      scheduledPeriod: schedPeriod,
      scheduledTimeRange: schedRange,
    };
  }
};
