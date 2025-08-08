import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/adminClient';

// simples "autorização" por e-mail do admin (MVP). Ajuste seu e-mail aqui:
const ADMIN_EMAILS = ['rafael.rr.amaral@gmail.com'];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id, new_status, admin_email } = body as {
      order_id: string;
      new_status: 'confirmed'|'out_for_delivery'|'delivered'|'canceled';
      admin_email: string;
    };

    if (!ADMIN_EMAILS.includes(admin_email)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { error } = await adminClient
      .from('orders')
      .update({ status: new_status })
      .eq('id', order_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
