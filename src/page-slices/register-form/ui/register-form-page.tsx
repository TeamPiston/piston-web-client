import { Header } from "@/widgets/header";
import { PistonLogo } from "@/shared/ui";
import { RegisterForm } from "@/features/auth-register";

export default function RegisterFormPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-white">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="mb-8 shrink-0">
          <PistonLogo className="w-auto h-10" />
        </div>

        <RegisterForm />
      </main>
    </div>
  );
}
