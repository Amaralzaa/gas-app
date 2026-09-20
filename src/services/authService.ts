import { supabase } from '../lib/supabase';
import { AppUser, UserRole } from '../types';

export const authService = {
  async getCurrentUser(): Promise<AppUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Use maybeSingle to avoid 406 errors on missing rows
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      let localName = '';
      try {
        localName = localStorage.getItem('gas_app_customer_name') || '';
      } catch {}

      // Self-healing: If profile is missing but user is authenticated
      if (!profile || error) {
        console.log('Profile missing or error, attempting self-healing creation...');
        const resolvedName = (localName && localName.trim()) 
          || user.user_metadata?.name 
          || (user.user_metadata?.role === 'cliente' ? 'Cliente' : 'Usuário');

        const newProfile = {
          id: user.id,
          email: user.email,
          name: resolvedName,
          role: (user.user_metadata?.role as UserRole) || 'cliente',
          phone: user.user_metadata?.phone || '',
          points: 0,
          addresses: [],
          allowedTabs: []
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .upsert(newProfile);

        if (insertError) {
          console.error('Self-healing failed (RLS?):', insertError);
          // Return a minimal user object even without a DB profile to allow the app to load
          return {
            id: user.id,
            email: user.email,
            role: (user.user_metadata?.role as UserRole) || 'cliente',
            name: resolvedName,
            phone: user.user_metadata?.phone,
            points: 0,
            addresses: [],
            allowedTabs: []
          };
        }
        return newProfile as AppUser;
      }

      const finalName = (profile.name && profile.name !== 'Usuário' && profile.name !== 'Cliente')
        ? profile.name
        : (localName || profile.name || user.user_metadata?.name || 'Cliente');

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role as UserRole,
        name: finalName,
        phone: profile.phone,
        points: profile.points,
        addresses: profile.addresses || [],
        location: profile.location,
        allowedTabs: profile.allowedTabs || [],
      };
    } catch (e) {
      console.error('Fatal error in getCurrentUser:', e);
      return null;
    }
  },

  async loginWithPhone(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    // Generate an internal email based on phone number for Supabase Auth
    const internalEmail = `guest_${cleanPhone}@gasexpress.app`;
    // For clients, we use a standard internal password for simulation in this phase
    const internalPassword = `GasPhoneAuth${cleanPhone}`;

    try {
      // Try to login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: internalPassword,
      });

      if (!loginError && data.user) return data.user;

      // If login fails (user not found), try to sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: internalEmail,
        password: internalPassword,
        options: {
          data: {
            phone: cleanPhone,
            role: 'cliente' as UserRole
          }
        }
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        // Update profile instead of insert, as the row is usually created by a DB trigger
        // which prevents explicit inserts via RLS policies.
        const { error: profileError } = await supabase.from('profiles').update({
          name: 'Cliente',
          role: 'cliente',
          phone: cleanPhone,
          points: 0,
          addresses: [],
          allowed_tabs: []
        }).eq('id', signUpData.user.id);

        if (profileError) {
          console.error('Info: Could not update profile automatically (RLS/Trigger)', profileError);
        }
      }

      return signUpData.user;
    } catch (error) {
      console.error('Error in loginWithPhone:', error);
      throw error;
    }
  },

  async login(email: string, password?: string) {
    if (password) {
      // Email/Password login (Managers/Delivery)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data.user;
    } else {
      // Phone/OTP login (Customers) - Simplified for now using just email for simulation if OTP is not set up
      // In a real scenario, this would be signInWithOtp({ phone })
      const { data, error } = await supabase.auth.signInWithOtp({
        email, // Using email as fallback for OTP simulation in Supabase
      });
      if (error) throw error;
      return data;
    }
  },

  async signUp(email: string, name: string, role: UserRole, phone?: string) {
    // In a real app, you might want to force a password or use OTP
    const { data, error } = await supabase.auth.signUp({
      email,
      password: 'TemporaryPassword123!', // You should handle this better in production
      options: {
        data: {
          name,
          role,
          phone
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      // Update into profiles table (handled by DB trigger usually)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name,
          role,
          phone,
          points: 0,
          addresses: []
        })
        .eq('id', data.user.id);

      if (profileError) console.error('Error creating profile:', profileError);
    }

    return data.user;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getProfileForUser(userId: string, userEmail?: string, userMeta?: any): Promise<AppUser> {
    let localName = '';
    try {
      localName = localStorage.getItem('gas_app_customer_name') || '';
    } catch {}

    const fallbackUser: AppUser = {
      id: userId,
      email: userEmail || '',
      role: (userMeta?.role as UserRole) || 'cliente',
      name: (localName && localName.trim()) || userMeta?.name || 'Cliente',
      phone: userMeta?.phone || '',
      points: 0,
      addresses: [],
      allowedTabs: []
    };

    try {
      // Usar timeout de no máximo 2500ms para nunca bloquear ou travar a UI em conexões móveis
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 2500)
      );

      const { data: profile } = await Promise.race([fetchPromise, timeoutPromise]);

      if (profile) {
        const finalName = (profile.name && profile.name !== 'Usuário' && profile.name !== 'Cliente')
          ? profile.name
          : (localName || profile.name || userMeta?.name || 'Cliente');

        // Se tínhamos um nome local diferente do genérico do banco, sincroniza em background
        if (localName && localName !== profile.name && (profile.name === 'Usuário' || profile.name === 'Cliente')) {
          Promise.resolve(supabase.from('profiles').update({ name: localName }).eq('id', userId)).catch(() => {});
        }

        return {
          id: profile.id,
          email: profile.email,
          role: profile.role as UserRole,
          name: finalName,
          phone: profile.phone,
          points: profile.points,
          addresses: profile.addresses || [],
          location: profile.location,
          allowedTabs: (profile as any).allowed_tabs || profile.allowedTabs || [],
        };
      }

      // Self-healing: profile missing, create it from metadata
      console.log('Profile missing, self-healing...');
      const resolvedName = (localName && localName.trim()) || userMeta?.name || 'Cliente';
      const newProfile = {
        id: userId,
        email: userEmail,
        name: resolvedName,
        role: (userMeta?.role as UserRole) || 'cliente',
        phone: userMeta?.phone || '',
        points: 0,
        addresses: [],
        allowed_tabs: []
      };
      Promise.resolve(supabase.from('profiles').upsert(newProfile)).catch(() => {});
      return fallbackUser;
    } catch (e) {
      console.warn('Profile fetch (usando fallback seguro):', e);
      return fallbackUser;
    }
  },

  onAuthStateChange(callback: (user: AppUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // IMPORTANT: Do NOT call supabase.auth.getUser() here — it causes a deadlock.
        // Instead, use session.user directly and fetch profile separately.
        const su = session.user;
        const appUser = await this.getProfileForUser(su.id, su.email, su.user_metadata);
        callback(appUser);
      } else {
        callback(null);
      }
    });
  }
};
