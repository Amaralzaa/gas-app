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
    const { data, error } = await supabase
      .from('orders')
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }
    return this.mapOrder(data);
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
    };
  }
};
