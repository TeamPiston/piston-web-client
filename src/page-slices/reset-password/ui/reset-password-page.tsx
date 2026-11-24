import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth-recovery";
import { PistonLogo } from "@/shared/ui";
import { Header } from "@/widgets/header";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:pb-24">
        <div className="flex w-full max-w-[500px] flex-col items-center">
          <PistonLogo className="pb-4" />
          <Suspense fallback={<p role="status" className="text-sm text-gray-600">재설정 화면을 불러오는 중...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
