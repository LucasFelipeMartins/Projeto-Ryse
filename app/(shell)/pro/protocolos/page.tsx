import { ProtocolosView } from '@/components/features/protocolos-view';
import { getProtocols } from '@/lib/queries/pro';
import { requireProfessional } from '@/lib/supabase/server';

export const metadata = { title: 'Protocolos base' };

export default async function ProtocolosPage() {
  const pro = await requireProfessional();
  const protocols = await getProtocols(pro.id);
  return <ProtocolosView protocols={protocols} />;
}
