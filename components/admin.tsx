"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import { z } from "zod";

import { formatDuration, formatPercent } from "@/lib/format";
import { DEFAULT_TARGET_CANS, MAX_TARGET_CANS } from "@/lib/rules";
import { summarySchema } from "@/lib/view";
import type { Phase, SessionSummary } from "@/lib/view";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Panel } from "./ui/panel";

const PHASE_LABELS: Record<Phase, string> = {
  done: "Fertig",
  lines: "Läuft",
  pending: "Nicht gestartet",
  reflection: "Letzter Satz",
};

const COLUMNS = [
  "Name",
  "Status",
  "Dosen",
  "Strafzeilen",
  "Fehler",
  "Genauigkeit",
  "Leerlauf",
  "Verlassen",
  "Nachgeschaut",
  "Zu schnell",
  "Zeit",
  "Link",
];

const createdSchema = z.object({ session: summarySchema });
const errorSchema = z.object({ error: z.string() });

const loginFormSchema = z.object({ secret: z.string() });

const createFormSchema = z.object({
  fadePrompt: z.literal("on").optional(),
  hardMode: z.literal("on").optional(),
  name: z.string(),
  targetCans: z.coerce.number(),
  webhookUrl: z.string(),
});

const readForm = <T,>(schema: z.ZodType<T>, form: HTMLFormElement): T =>
  schema.parse(Object.fromEntries(new FormData(form)));

type Result<T> = { data: T; error: null } | { data: null; error: string };

const postJson = async <T,>(
  schema: z.ZodType<T>,
  path: string,
  body: Record<string, string | number | boolean>
): Promise<Result<T>> => {
  try {
    const response = await fetch(path, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const json: unknown = await response.json();

    if (response.ok) {
      return { data: schema.parse(json), error: null };
    }

    const failure = errorSchema.safeParse(json);

    return {
      data: null,
      error: failure.success ? failure.data.error : "Fehler.",
    };
  } catch {
    return { data: null, error: "Keine Verbindung." };
  }
};

const Field = ({
  children,
  label,
}: {
  children: (id: string) => ReactNode;
  label: string;
}) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-muted text-sm" htmlFor={id}>
        {label}
      </label>
      {children(id)}
    </div>
  );
};

/**
 * Password form. Sets an HttpOnly cookie, then reloads the page data.
 * @returns The login screen.
 */
export const Login = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { secret } = readForm(loginFormSchema, event.currentTarget);

    const result = await postJson(
      z.object({ ok: z.boolean() }),
      "/api/admin/login",
      { secret }
    );

    setError(result.error);

    if (result.error === null) {
      router.refresh();
    }
  };

  return (
    <Panel title="Verwaltung">
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Field label="Passwort (ADMIN_SECRET)">
          {(id) => (
            <Input
              autoComplete="current-password"
              id={id}
              name="secret"
              type="password"
            />
          )}
        </Field>
        {error === null ? null : <p className="text-danger">{error}</p>}
        <div>
          <Button type="submit">Anmelden</Button>
        </div>
      </form>
    </Panel>
  );
};

const CreateForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SessionSummary | null>(null);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formElement = event.currentTarget;

    const { fadePrompt, hardMode, name, targetCans, webhookUrl } = readForm(
      createFormSchema,
      formElement
    );

    const result = await postJson(createdSchema, "/api/admin/sessions", {
      fadePrompt: fadePrompt === "on",
      hardMode: hardMode === "on",
      name,
      targetCans,
      webhookUrl,
    });

    setError(result.error);

    if (result.data !== null) {
      setCreated(result.data.session);
      formElement.reset();
      router.refresh();
    }
  };

  return (
    <Panel title="Neue Sitzung">
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Field label="Name">
          {(id) => <Input id={id} maxLength={60} name="name" required />}
        </Field>
        <Field label="Dosen (Zeilen)">
          {(id) => (
            <Input
              defaultValue={DEFAULT_TARGET_CANS}
              id={id}
              max={MAX_TARGET_CANS}
              min={1}
              name="targetCans"
              required
              type="number"
            />
          )}
        </Field>
        <Field label="Discord-Webhook (optional, meldet Start und Ende)">
          {(id) => (
            <Input
              id={id}
              name="webhookUrl"
              placeholder="https://discord.com/api/webhooks/…"
              type="url"
            />
          )}
        </Field>
        <label className="text-muted flex items-center gap-2 text-sm">
          <input name="fadePrompt" type="checkbox" />
          Satz ausblenden: verschwindet nach 3 Sekunden oder beim ersten
          Tastendruck
        </label>
        <label className="text-muted flex items-center gap-2 text-sm">
          <input name="hardMode" type="checkbox" />
          Schwer: nur die drei Wörter zeigen
        </label>
        {error === null ? null : <p className="text-danger">{error}</p>}
        <div>
          <Button type="submit">Link erstellen</Button>
        </div>
      </form>
      {created === null ? null : (
        <div className="border-border bg-panel flex flex-col gap-2 border p-4 break-all">
          <span className="text-muted text-sm">Link für {created.name}:</span>
          <a className="underline underline-offset-4" href={created.url}>
            {created.url}
          </a>
        </div>
      )}
    </Panel>
  );
};

const SessionRow = ({ session: s }: { session: SessionSummary }) => (
  <tr className="border-border border-b">
    <td className="px-3 py-2.5">
      {s.name}
      {s.fadePrompt ? " (ausblenden)" : ""}
      {s.hardMode ? " (schwer)" : ""}
    </td>
    <td className="px-3 py-2.5">{PHASE_LABELS[s.phase]}</td>
    <td className="px-3 py-2.5">
      {s.completed} / {s.targetCans + s.penalties}
    </td>
    <td className="px-3 py-2.5">{s.penalties}</td>
    <td className="px-3 py-2.5">{s.errors}</td>
    <td className="px-3 py-2.5">{formatPercent(s.accuracy)}</td>
    <td className="px-3 py-2.5">{s.idles + s.absences}</td>
    <td className="px-3 py-2.5">{s.focusLosses}</td>
    <td className="px-3 py-2.5">{s.peeks}</td>
    <td className="px-3 py-2.5">{s.tooFast}</td>
    <td className="px-3 py-2.5">
      {s.elapsed === null ? "–" : formatDuration(s.elapsed)}
    </td>
    <td className="px-3 py-2.5">
      <a
        className="underline underline-offset-4"
        href={s.url}
        rel="noreferrer"
        target="_blank"
      >
        öffnen
      </a>
    </td>
  </tr>
);

/**
 * Admin page: create sessions and watch their progress.
 * @param props - Sessions loaded on the server.
 * @returns The admin screen.
 */
export const Admin = ({ sessions }: { sessions: SessionSummary[] }) => {
  const router = useRouter();

  return (
    <div className="flex w-full max-w-6xl flex-col gap-12">
      <CreateForm />
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Sitzungen</h2>
          <Button
            onClick={() => {
              router.refresh();
            }}
            variant="link"
          >
            Aktualisieren
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm whitespace-nowrap tabular-nums">
            <thead>
              <tr className="border-border text-muted border-b">
                {COLUMNS.map((column) => (
                  <th
                    className="px-3 py-2.5 font-medium"
                    key={column}
                    scope="col"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td className="text-muted px-3 py-6" colSpan={COLUMNS.length}>
                    Noch keine Sitzungen.
                  </td>
                </tr>
              ) : null}
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
