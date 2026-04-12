require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function createClientAccount(phone, name) {
  const mail = `phone_${phone}@porto-gas.com`;
  const pwd = `GasPhoneAuth${phone}`;
  console.log(`Criando cliente: ${name} (${phone})`);
  const { data, error } = await supabase.auth.signUp({
    email: mail,
    password: pwd,
    options: { data: { phone, role: 'cliente' } }
  });

  if (error) {
    console.error(`Erro ao criar ${name}:`, error.message);
    return;
  }

  if (data.user) {
    const { error: pError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email: mail,
      name: name,
      role: 'cliente',
      phone: phone,
      points: 0,
    });
    if (pError) console.error(`Erro perfil ${name}:`, pError.message);
    else console.log(`Perfil criado com sucesso!`);
  }
}

async function testLogin(email, password, role) {
  console.log(`Testando login para: ${email} (${role})`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) console.error(`Erro login ${email}:`, error.message);
  else {
    console.log(`Login OK! User ID: ${data.user.id}`);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    console.log(`Role confirmada: ${p?.role}`);
  }
}

async function run() {
  await testLogin('rafael.rr.amaral@gmail.com', '123456', 'gestor');
  await testLogin('entregador@portogas.com', '123456', 'entregador');
  await createClientAccount('21999546006', 'Rafael Amaral - Teste');
}

run();
