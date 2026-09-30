import { Header } from "@/widgets/header";
import { PistonLogo } from "@/shared/ui";
import { LoginForm } from "@/features/auth-login";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:pb-24">
          <div className="flex w-full max-w-[500px] flex-col items-center">
            <PistonLogo className="pb-4" />
            <LoginForm />
          </div>
        </main>
      </div>
    </div>
  );
}
