import { ProtectedRoute } from "@/features/auth-guard";
import CreatePage from "@/pages/create";

export default function CreateRoute() {
  return (
    <ProtectedRoute>
      <CreatePage />
    </ProtectedRoute>
  );
}
