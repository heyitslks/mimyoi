import type { Metadata } from "next";
import { Suspense } from "react";

import { Game } from "@/components/game";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Mimi",
};

const GameForParams = async ({
  params,
}: {
  params: PageProps<"/s/[id]">["params"];
}) => {
  const { id } = await params;

  return <Game id={id} />;
};

const SessionPage = ({ params }: PageProps<"/s/[id]">) => (
  <main className="flex min-h-dvh justify-center px-4 pt-6 pb-8 select-none sm:pt-24">
    <Suspense fallback={<Panel title="Lädt …" />}>
      <GameForParams params={params} />
    </Suspense>
  </main>
);

export default SessionPage;
