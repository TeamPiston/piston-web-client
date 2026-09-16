import { Header } from "@/components/Header";
import { PistonLogo } from "@/shared/ui";
import { RegisterForm } from "@/features/auth-register";

export default function RegisterFormPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden bg-white">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <PistonLogo className="w-auto h-10" />
        </div>

        <RegisterForm />
      </main>
    </div>
  );
}
