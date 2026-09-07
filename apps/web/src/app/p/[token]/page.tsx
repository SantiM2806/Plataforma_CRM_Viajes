import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@crm/db';
import { Proposal, type ProposalData } from './proposal';

export const dynamic = 'force-dynamic';

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = (await db.execute(
    sql`select get_public_quote(${token}) as q`,
  )) as unknown as { rows: Array<{ q: ProposalData | null }> };

  const data = res.rows?.[0]?.q;
  if (!data) notFound();

  return <Proposal data={data} token={token} />;
}
