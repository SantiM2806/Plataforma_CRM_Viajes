import { getAppContext } from '@/lib/auth/session';
import { QuoteBuilder } from './builder';

export default async function NewQuotePage() {
  await getAppContext(); // guard de sesión/agencia
  return <QuoteBuilder />;
}
