import RenewalDetailPage from '@/components/features/renewal/RenewalDetailPage';

export default async function RenewalDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RenewalDetailPage renewalId={id} />;
}
