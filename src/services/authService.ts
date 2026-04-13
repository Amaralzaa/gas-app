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

      // Self-healing: If profile is missing but user is authenticated
      if (!profile || error) {
        console.log('Profile missing or error, attempting self-healing creation...');
        const newProfile = {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || 'Usuário',
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
            name: user.user_metadata?.name || 'Usuário',
            phone: user.user_metadata?.phone,
            points: 0,
            addresses: [],
            allowedTabs: []
          };
        }
        return newProfile as AppUser;
      }

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role as UserRole,
        name: profile.name,
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
    // Generate an internal email based on phone number for Supabase Auth
    // Changed domain to bypass previously stuck test accounts safely after config update
    const internalEmail = `guest_${phone.replace(/\D/g, '')}@gasexpress.app`;
    // For clients, we use a standard internal password for simulation in this phase
    const internalPassword = `GasPhoneAuth${phone.replace(/\D/g, '')}`;

    try {
      // Try to login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: internalPassword,
      });

      if (!loginError) return data.user;

      // If login fails (user not found), try to sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: internalEmail,
        password: internalPassword,
        options: {
          data: {
            phone,
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
          phone,
          points: 0,
          addresses: [],
          allowedTabs: []
        }).eq('id', signUpData.user.id);

        if (profileError) {
          console.error('Info: Could not update profile automatically (RLS/Trigger)', profileError);
          // We don't throw here to avoid blocking the login flow just because of profile metadata
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
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          email: profile.email,
          role: profile.role as UserRole,
          name: profile.name,
          phone: profile.phone,
          points: profile.points,
          addresses: profile.addresses || [],
          location: profile.location,
          allowedTabs: profile.allowedTabs || [],
        };
      }

      // Self-healing: profile missing, create it from metadata
      console.log('Profile missing, self-healing...');
      const newProfile = {
        id: userId,
        email: userEmail,
        name: userMeta?.name || 'Usuário',
        role: (userMeta?.role as UserRole) || 'cliente',
        phone: userMeta?.phone || '',
        points: 0,
        addresses: [],
        allowedTabs: []
      };
      await supabase.from('profiles').upsert(newProfile).catch(() => {});
      return newProfile as AppUser;
    } catch {
      // Fallback: return minimal user so the app never hangs
      return {
        id: userId,
        email: userEmail,
        role: (userMeta?.role as UserRole) || 'cliente',
        name: userMeta?.name || 'Usuário',
        phone: userMeta?.phone,
        points: 0,
        addresses: [],
        allowedTabs: []
      };
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
