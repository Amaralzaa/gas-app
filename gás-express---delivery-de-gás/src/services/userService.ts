import { supabase } from '../lib/supabase';
import { AppUser } from '../types';

export const userService = {
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
    }));
  },

  async updateProfile(userId: string, updates: Partial<AppUser>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        phone: updates.phone,
        points: updates.points,
        addresses: updates.addresses,
        location: updates.location,
      })
      .eq('id', userId);

    if (error) throw error;
  }
};
