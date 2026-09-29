import { notFound } from "next/navigation";
import {
  getMockArtworkDetailById,
  MOCK_ARTWORK_DETAILS,
} from "@/entities/artwork";
import { ProtectedRoute } from "@/features/auth-guard";
import ArtworkDetailPage from "@/pages/artwork-detail";

interface ArtworkDetailRouteProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return MOCK_ARTWORK_DETAILS.map(({ id }) => ({ id }));
}

export default async function ArtworkDetailRoute({
  params,
}: ArtworkDetailRouteProps) {
  const { id } = await params;
  const artwork = getMockArtworkDetailById(id);

  if (!artwork) {
    notFound();
  }

  return (
    <ProtectedRoute>
      <ArtworkDetailPage artwork={artwork} />
    </ProtectedRoute>
  );
}
