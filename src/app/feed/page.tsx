import { ProtectedRoute } from "@/features/auth-guard";
import FeedPage from "@/pages/feed";

export default function FeedRoute() {
  return (
    <ProtectedRoute>
      <FeedPage />
    </ProtectedRoute>
  );
}
