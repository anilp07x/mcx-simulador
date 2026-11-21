import { connection } from "next/server";
import { Suspense } from "react";
import { configured } from "@/lib/appypay";
import { Simulator } from "./simulator";

export default function Home() {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-10 sm:py-16">
      <Suspense>
        <Ready />
      </Suspense>
    </main>
  );
}

async function Ready() {
  await connection(); // lê a configuração em cada pedido (não no build)
  return <Simulator ready={configured()} />;
}
