import { NextResponse, type NextRequest } from 'next/server';
import { despacharNotificacoes, gerarLembretes } from '@/lib/notifications/dispatch';
import { isPushConfigured } from '@/lib/notifications/push';
import { isAdminConfigured } from '@/lib/supabase/admin';

/**
 * Cron de notificações: gera os lembretes do dia e esvazia a fila.
 *
 * A rota ignora a RLS (é a única que faz isso), então o segredo não é
 * opcional: sem `CRON_SECRET` configurado ela recusa qualquer chamada, em vez
 * de ficar aberta em produção por esquecimento.
 *
 * A Vercel envia o segredo em `Authorization: Bearer …` nas execuções de
 * cron; chamadas manuais podem usar `?chave=`.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;

  return request.nextUrl.searchParams.get('chave') === secret;
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  if (!isAdminConfigured() || !isPushConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        motivo:
          'Configure SUPABASE_SECRET_KEY, VAPID_PRIVATE_KEY e ' +
          'NEXT_PUBLIC_VAPID_PUBLIC_KEY para habilitar o envio.',
      },
      { status: 503 },
    );
  }

  const lembretes = await gerarLembretes();
  const despacho = await despacharNotificacoes();

  return NextResponse.json({ ok: true, lembretes, despacho });
}
