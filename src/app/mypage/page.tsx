import { ProtectedRoute } from "@/features/auth-guard";
import MyPage from "@/pages/mypage";

export default function MyPageRoute() {
  return (
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  );
}
