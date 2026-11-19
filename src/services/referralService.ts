import { supabase } from '../lib/supabase';
import { Referral, ReferralStatus } from '../types';

export const referralService = {
  async getReferrals(): Promise<Referral[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('referrals table error:', error.message);
      return [];
    }
    return (data || []).map(this.mapReferral);
  },

  async addReferral(referral: Referral): Promise<Referral> {
    const row = {
      id: referral.id,
      referrer_id: referral.referrerId,
      referrer_name: referral.referrerName,
      referee_id: referral.refereeId || null,
      referee_name: referral.refereeName,
      referee_phone: referral.refereePhone,
      status: referral.status,
      order_id: referral.orderId || null,
      points_awarded: referral.pointsAwarded,
      created_at: referral.createdAt,
      validated_at: referral.validatedAt || null
    };

    const { data, error } = await supabase
      .from('referrals')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Error adding referral:', error.message);
      throw error;
    }
    return this.mapReferral(data);
  },

  async updateReferralStatus(id: string, status: ReferralStatus, validatedAt?: string): Promise<void> {
    const { error } = await supabase
      .from('referrals')
      .update({ 
        status, 
        validated_at: validatedAt || (status === 'Validado' ? new Date().toISOString() : null)
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating referral status:', error.message);
      throw error;
    }
  },

  async deleteReferral(id: string): Promise<void> {
    const { error } = await supabase
      .from('referrals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting referral:', error.message);
      throw error;
    }
  },

  mapReferral(dbRow: any): Referral {
    return {
      id: dbRow.id,
      referrerId: dbRow.referrer_id,
      referrerName: dbRow.referrer_name,
      refereeId: dbRow.referee_id,
      refereeName: dbRow.referee_name,
      refereePhone: dbRow.referee_phone,
      status: dbRow.status as ReferralStatus,
      orderId: dbRow.order_id,
      pointsAwarded: dbRow.points_awarded,
      createdAt: dbRow.created_at,
      validatedAt: dbRow.validated_at
    };
  }
};
