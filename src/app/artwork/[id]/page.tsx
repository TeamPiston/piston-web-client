import { notFound } from "next/navigation";
import { MOCK_ARTWORKS } from "@/entities/artwork";
import ArtworkDetailPage from "@/pages/artwork-detail";

interface ArtworkDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function ArtworkDetailRoute({ params }: ArtworkDetailRouteProps) {
  const { id } = await params;
  const artwork = MOCK_ARTWORKS.find((item) => item.id === Number(id));

  if (!artwork) {
    notFound();
  }

  return <ArtworkDetailPage artwork={artwork} />;
}
