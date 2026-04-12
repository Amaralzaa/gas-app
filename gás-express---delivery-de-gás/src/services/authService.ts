import { supabase } from '../lib/supabase';
import { AppUser, UserRole } from '../types';

export const authService = {
  async getCurrentUser(): Promise<AppUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) return null;

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
  },

  async loginWithPhone(phone: string) {
    // Generate an internal email based on phone number for Supabase Auth
    const internalEmail = `phone_${phone.replace(/\D/g, '')}@porto-gas.com`;
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
        // Create profile
        await supabase.from('profiles').insert({
          id: signUpData.user.id,
          email: internalEmail,
          name: 'Cliente',
          role: 'cliente',
          phone,
          points: 0,
          addresses: [],
          allowedTabs: []
        });
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
      // Insert into profiles table (handled by DB trigger usually, but doing it manually for clarity)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          name,
          role,
          phone,
          points: 0,
          addresses: []
        });

      if (profileError) console.error('Error creating profile:', profileError);
    }

    return data.user;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  onAuthStateChange(callback: (user: AppUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  }
};
