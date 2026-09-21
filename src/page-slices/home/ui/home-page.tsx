import { PistonLogo } from "@/shared/ui";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <PistonLogo height={36} />
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Welcome to Piston
        </h1>
      </div>
    </main>
  );
}
