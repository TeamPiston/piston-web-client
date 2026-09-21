import { AppHeader } from "@/widgets/app-header";
import { PistonLogo } from "@/shared/ui";
import { FindPwdForm } from "@/features/auth-recovery";

export default function FindPwdPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <AppHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <div className="w-full max-w-[500px] flex flex-col items-center">
            <PistonLogo className="pb-4" />
            <FindPwdForm />
          </div>
        </main>
      </div>
    </div>
  );
}
