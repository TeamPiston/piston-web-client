import { AppHeader } from "@/widgets/app-header";
import { TermsAgreement } from "@/features/auth-register";

export default function RegisterTermsPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-white">
      {/* 상단 공통 헤더 */}
      <AppHeader />

      {/* 중앙 메인 콘텐츠 영역 */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-16">
        <TermsAgreement />
      </main>
    </div>
  );
}
