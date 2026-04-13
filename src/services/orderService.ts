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

  async createOrder(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: order.customerId,
        items: order.items,
        total: order.total,
        discount: order.discount,
        status: order.status,
        payment_method: order.paymentMethod,
        address: order.address,
        estimated_arrival: order.estimatedArrival,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapOrder(data);
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        status: updates.status,
        delivery_person_id: updates.deliveryPersonId,
        estimated_arrival: updates.estimatedArrival,
        // In a real app, you might update more fields
      })
      .eq('id', orderId);

    if (error) throw error;
  },

  subscribeToOrders(callback: (payload: any) => void) {
    return supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
      .subscribe();
  },

  mapOrder(dbOrder: any): Order {
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
    };
  }
};
