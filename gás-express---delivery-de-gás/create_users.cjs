const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createInitialUsers() {
  const users = [
    { email: 'rafael.rr.amaral@gmail.com', password: '123456', name: 'Rafael Amaral', role: 'gestor' },
    { email: 'entregador@portogas.com', password: '123456', name: 'Entregador Teste', role: 'entregador' }
  ];

  for (const user of users) {
    console.log(`Criando usuário: ${user.email}...`);
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        data: {
          name: user.name,
          role: user.role
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        console.log(`Usuário ${user.email} já existe.`);
      } else {
        console.error(`Erro ao criar ${user.email}:`, error.message);
        console.log('---');
        continue;
      }
    } else {
      console.log(`Usuário ${user.email} criado com sucesso!`);
    }

    // Login to get session for RLS
    console.log(`Fazendo login como ${user.email} para criar perfil...`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (signInError) {
      console.error(`Erro ao fazer login como ${user.email}:`, signInError.message);
    } else if (signInData.user) {
      console.log(`Login realizado! Inserindo perfil...`);
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: signInData.user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          points: 0,
          addresses: []
        });
      
      if (profileError) {
        console.error(`Erro ao criar/atualizar perfil para ${user.email}:`, profileError.message);
      } else {
        console.log(`Perfil para ${user.email} criado/atualizado com sucesso!`);
      }
    }
    console.log('---');
  }
}

createInitialUsers();
