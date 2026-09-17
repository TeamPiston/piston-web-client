import { AppHeader } from "@/widgets/app-header";
import { TermsAgreement } from "@/features/auth-register";

export default function RegisterTermsPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden bg-white">
      {/* 상단 공통 헤더 */}
      <AppHeader />

      {/* 중앙 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <TermsAgreement />
      </main>
    </div>
  );
}
