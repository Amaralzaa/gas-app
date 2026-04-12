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

async function fetchUsers() {
  console.log('Buscando usuários da tabela "profiles"...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error('Erro ao buscar usuários:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('Nenhum usuário encontrado na tabela "profiles".');
    return;
  }

  console.log('\n--- Lista de Usuários ---');
  data.forEach(user => {
    console.log(`Nome: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Função: ${user.role}`);
    console.log(`Telefone: ${user.phone || 'N/A'}`);
    console.log('------------------------');
  });
}

fetchUsers();
