import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { Admin, Login } from "@/components/admin";
import { Panel } from "@/components/ui/panel";
import { isAdmin } from "@/lib/admin";
import { store } from "@/lib/store";
import { summarize } from "@/lib/summary";
import type { SessionSummary } from "@/lib/view";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Mimi · Verwaltung",
};

const loadSummaries = async (origin: string): Promise<SessionSummary[]> => {
  const sessions = await store().list();
  const now = Date.now();

  return sessions.map((s) => summarize(s, origin, now));
};

const AdminContent = async () => {
  const headerStore = await headers();

  if (!isAdmin({ authorization: null, cookie: headerStore.get("cookie") })) {
    return <Login />;
  }

  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;

  return <Admin sessions={await loadSummaries(origin)} />;
};

const AdminPage = () => (
  <main className="flex min-h-dvh justify-center px-4 pt-12 pb-8">
    <Suspense fallback={<Panel title="Lädt …" />}>
      <AdminContent />
    </Suspense>
  </main>
);

export default AdminPage;
