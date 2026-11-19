import { supabase } from '../lib/supabase';
import { AppUser, UserRole } from '../types';
import { userService } from './userService';

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

      const cachedAddresses = userService.getAddressCache(user.id);

      // Sem perfil: o trigger do banco cria a linha. O cliente não escolhe o próprio papel.
      if (!profile || error) {
        const resolvedName = (localName && localName.trim())
          || user.user_metadata?.name
          || 'Cliente';
        return {
          id: user.id,
          email: user.email,
          role: 'cliente',
          name: resolvedName,
          phone: user.user_metadata?.phone,
          points: 0,
          addresses: cachedAddresses,
          allowedTabs: []
        };
      }

      const finalName = (profile.name && profile.name !== 'Usuário' && profile.name !== 'Cliente')
        ? profile.name
        : (localName || profile.name || user.user_metadata?.name || 'Cliente');

      const resolvedAddresses = (profile.addresses && profile.addresses.length > 0)
        ? profile.addresses
        : cachedAddresses;

      if (profile.addresses && profile.addresses.length > 0) {
        userService.saveAddressCache(profile.id, profile.addresses);
      }

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role as UserRole,
        name: finalName,
        phone: profile.phone,
        points: profile.points,
        addresses: resolvedAddresses,
        location: profile.location,
        allowedTabs: (profile as any).allowed_tabs || profile.allowedTabs || [],
        referralCode: (profile as any).referral_code || undefined,
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

      if (signUpData.user && !signUpData.session) {
        throw new Error('Conta criada, mas o Supabase ainda exige confirmação de e-mail. Em Authentication > Providers > Email, desligue "Confirm email" para o cliente entrar só com o WhatsApp.');
      }

      if (signUpData.user) {
        const { error: profileError } = await supabase.from('profiles').update({
          phone: cleanPhone,
        }).eq('id', signUpData.user.id);

        if (profileError) {
          console.error('Não foi possível gravar o telefone no perfil (aplique a migration se o perfil ainda não existir).', profileError);
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

  async signUp(email: string, name: string, role: UserRole, phone?: string, password?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: password && password.length >= 6 ? password : 'TemporaryPassword123!',
      options: {
        data: {
          name,
          phone
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      // O trigger grava role 'cliente'. Só um gestor (ou SQL) promove o papel.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name,
          phone: phone || null,
        })
        .eq('id', data.user.id);

      if (profileError) console.error('Error updating profile:', profileError);

      if (role !== 'cliente') {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', data.user.id);
        if (roleError) {
          console.warn('Papel não promovido (a sessão atual não é gestor, ou a migration ainda não foi aplicada):', roleError.message);
        }
      }
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

    const cachedAddresses = userService.getAddressCache(userId);

    const fallbackUser: AppUser = {
      id: userId,
      email: userEmail || '',
      role: 'cliente',
      name: (localName && localName.trim()) || userMeta?.name || 'Cliente',
      phone: userMeta?.phone || '',
      points: 0,
      addresses: cachedAddresses,
      allowedTabs: [],
      pointHistory: userService.getPointHistory(userId)
    };

    try {
      let profile: any = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (data) {
          profile = data;
          break;
        }
        if (error) console.warn('Profile fetch:', error.message);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }

      if (profile) {
        const finalName = (profile.name && profile.name !== 'Usuário' && profile.name !== 'Cliente')
          ? profile.name
          : (localName || profile.name || userMeta?.name || 'Cliente');

        // Se tínhamos um nome local diferente do genérico do banco, sincroniza em background
        if (localName && localName !== profile.name && (profile.name === 'Usuário' || profile.name === 'Cliente')) {
          Promise.resolve(supabase.from('profiles').update({ name: localName }).eq('id', userId)).catch(() => {});
        }

        const resolvedAddresses = (profile.addresses && profile.addresses.length > 0)
          ? profile.addresses
          : cachedAddresses;

        if (profile.addresses && profile.addresses.length > 0) {
          userService.saveAddressCache(profile.id, profile.addresses);
        } else if (cachedAddresses.length > 0) {
          // Se o perfil remoto está sem endereços mas temos no cache local, sincroniza em background
          Promise.resolve(supabase.from('profiles').update({ addresses: cachedAddresses }).eq('id', userId)).catch(() => {});
        }

        return {
          id: profile.id,
          email: profile.email,
          role: profile.role as UserRole,
          name: finalName,
          phone: profile.phone,
          points: profile.points || 0,
          addresses: resolvedAddresses,
          location: profile.location,
          allowedTabs: (profile as any).allowed_tabs || profile.allowedTabs || [],
          referralCode: (profile as any).referral_code || undefined,
          pointHistory: userService.getPointHistory(profile.id)
        };
      }

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
