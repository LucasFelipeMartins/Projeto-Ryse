import { NutricaoView } from '@/components/features/nutricao-view';
import { getNutrition } from '@/lib/queries/patient';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Nutrição' };

export default async function NutricaoPage() {
  const user = await requirePatient();
  const data = await getNutrition(user.id);
  return <NutricaoView data={data} />;
}
