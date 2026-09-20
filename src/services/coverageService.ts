import { supabase } from '../lib/supabase';
import { CoverageArea } from '../types';

export const coverageService = {
  async getCoverageAreas(): Promise<CoverageArea[]> {
    const { data, error } = await supabase
      .from('coverage_areas')
      .select('*')
      .order('neighborhood', { ascending: true });

    if (error) {
      // Table might not exist yet — return empty array, we'll seed from defaults
      console.warn('coverage_areas table not found or error:', error.message);
      return [];
    }
    return (data || []).map(this.mapArea);
  },

  async saveCoverageAreas(areas: CoverageArea[]): Promise<void> {
    if (areas.length === 0) {
      // If empty list, delete everything
      const { error } = await supabase.from('coverage_areas').delete().neq('id', '');
      if (error) throw error;
      return;
    }

    const rows = areas.map(area => ({
      id: area.id,
      neighborhood: area.neighborhood,
      city: area.city,
      allowed_ceps: area.allowedCeps || [],
      center_lat: area.center?.lat || null,
      center_lng: area.center?.lng || null,
      boundary: area.boundary || null,
    }));

    // 1. Get current IDs to find what to delete
    const { data: existing } = await supabase.from('coverage_areas').select('id');
    const existingIds = (existing || []).map(row => row.id);
    const incomingIds = areas.map(a => a.id);
    const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

    // 2. Perform operations
    const promises: PromiseLike<any>[] = [
      supabase.from('coverage_areas').upsert(rows)
    ];

    if (idsToDelete.length > 0) {
      promises.push(supabase.from('coverage_areas').delete().in('id', idsToDelete));
    }

    const results = await Promise.all(promises);
    const error = results.find(r => r.error)?.error;

    if (error) {
      console.error('Error syncing coverage_areas:', error.message);
      throw error;
    }
  },

  mapArea(dbRow: any): CoverageArea {
    return {
      id: dbRow.id,
      neighborhood: dbRow.neighborhood,
      city: dbRow.city,
      allowedCeps: dbRow.allowed_ceps || [],
      center: dbRow.center_lat && dbRow.center_lng
        ? { lat: dbRow.center_lat, lng: dbRow.center_lng }
        : undefined,
      boundary: dbRow.boundary || undefined,
    };
  }
};
