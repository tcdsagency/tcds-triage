// Page Route: /app/(dashboard)/customer/[id]/page.tsx
// Customer Profile Page

import CustomerProfilePage from "@/components/CustomerProfilePage";

export default function Page() {
  return <CustomerProfilePage />;
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Customer Profile - TCDS`,
    description: "View customer profile and policies",
  };
}
