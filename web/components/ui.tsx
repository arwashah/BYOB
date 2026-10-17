"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logOut, useAuth, useGuest } from "@/lib/cloud";
import type { ComponentType, InputHTMLAttributes, ReactNode, SVGProps } from "react";
import type { Severity } from "@/lib/types";
import { useEffect, useState } from "react";
import { clearOffline, useOffline } from "@/lib/api";
import { useSavedProfile } from "@/lib/useProfile";
import { IconClaim, IconForecast, IconGaps, IconPool, IconStart, Logo, Wordmark } from "./icons";

export const APP_NAME = "BYOB";

const STEPS: { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/", label: "Start", Icon: IconStart },
  { href: "/gaps", label: "Gaps", Icon: IconGaps },
  { href: "/forecast", label: "Savings", Icon: IconForecast },
  { href: "/claim", label: "Claim", Icon: IconClaim },
  { href: "/pool", label: "Pool", Icon: IconPool },
];

function Header() {
  return (
    <header className="glass sticky z-30 border-b border-line/60" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
        <Link href="/" className="pressable flex items-center gap-2.5">
          <Logo />
          <Wordmark className="text-[26px] text-ink" />
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <OfflineChip />
          <Account />
        </div>
      </div>
    </header>
  );
}

// "Logged in as … · Log out", or a Log in link for guests. Hidden when logins aren't set up.
function Account() {
  const auth = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [leaving, setLeaving] = useState(false);
  if (!auth.enabled || path === "/login") return null;
  if (!auth.user) {
    return (
      <Link href="/login" className="pressable shrink-0 rounded-full px-1 text-[13px] font-semibold text-brand">
        Log in
      </Link>
    );
  }
  const out = async () => {
    setLeaving(true);
    await logOut();
    router.push("/login");
  };
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px]">
      <span className="hidden min-w-0 max-w-[15rem] truncate text-ink-3 sm:inline">
        Logged in as <span className="font-semibold text-ink-2">{auth.user.email}</span>
      </span>
      <span aria-hidden className="hidden text-ink-3 sm:inline">·</span>
      <button onClick={out} disabled={leaving} title={auth.user.email ?? undefined} className="pressable shrink-0 font-semibold text-brand disabled:opacity-40">
        {leaving ? "Logging out…" : "Log out"}
      </button>
    </span>
  );
}

// Honest status: say so whenever a screen is showing stand-in data.
function OfflineChip() {
  const offline = useOffline();
  const path = usePathname();
  useEffect(() => clearOffline(), [path]);
  if (!offline) return <span className="hidden text-xs text-ink-3 sm:block">Informs, never sells · Not financial advice</span>;
  return (
    <span
      role="status"
      title="The server didn't answer part of this screen, so it shows sample numbers."
      className="inline-flex items-center gap-1.5 rounded-full bg-honey-soft px-3 py-1 text-xs font-semibold text-honey"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-honey" />
      Offline demo data
    </span>
  );
}

export const STATUS_TONE: Record<"healthy" | "watch" | "low", { text: string; tone: Severity }> = {
  healthy: { text: "Healthy", tone: "low" },
  watch: { text: "Stretched", tone: "medium" },
  low: { text: "Low", tone: "high" },
};

// Small coloured label, using the same tones as risk badges.
export function Chip({ tone, children }: { tone: Severity; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[tone].chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} />
      {children}
    </span>
  );
}

// iOS-style tab bar: separate tabs, each with its own icon, floating on a
// translucent material so content scrolls underneath. Until onboarding is done
// the later tabs are greyed out and point back to Start.
function TabBar() {
  const path = usePathname();
  const saved = useSavedProfile();
  const locked = saved === null && path === "/";
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 2200);
    return () => clearTimeout(t);
  }, [hint]);
  return (
    <nav
      aria-label="Steps"
      className="fixed inset-x-0 bottom-0 z-30 px-3 sm:bottom-5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
    >
      {hint && (
        <p role="status" className="rise mx-auto mb-2 w-fit rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg">
          Start here first: describe your business
        </p>
      )}
      <ul className="glass mx-auto grid max-w-md grid-cols-5 gap-1 rounded-2xl border border-line/70 p-1.5 shadow-[0_8px_30px_rgba(17,19,17,0.12)]">
        {STEPS.map(({ href, label, Icon }) => {
          const active = path === href;
          if (locked && href !== "/") {
            return (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => setHint(true)}
                  aria-disabled="true"
                  title="Start here first"
                  className="flex w-full cursor-not-allowed flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium text-ink-3/60"
                >
                  <Icon width={22} height={22} />
                  {label}
                </button>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium ${
                  active ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"
                }`}
              >
                <Icon width={22} height={22} strokeWidth={active ? 2.1 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// With logins switched on, a first visit goes to /login; "Try as guest" or logging in lets you through.
function useLoginGate() {
  const auth = useAuth();
  const guest = useGuest();
  const path = usePathname();
  const router = useRouter();
  const open = !auth.enabled || guest || path === "/login";
  const mustLogin = !open && auth.ready && !auth.user;
  useEffect(() => {
    if (mustLogin) router.replace("/login");
  }, [mustLogin, router]);
  return !open && !auth.user; // still checking the session, or on the way to /login
}

export function Shell({ children }: { children: ReactNode }) {
  const waiting = useLoginGate();
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-36 sm:pt-12">{waiting ? <Loading /> : children}</main>
      <TabBar />
    </div>
  );
}

export function Page({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Shell>
      <div className="rise mb-8">
        {eyebrow && <p className="mb-2 text-sm font-semibold text-brand">{eyebrow}</p>}
        <h1 className="display text-[2.75rem] text-ink sm:text-[3.75rem]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-xl text-[17px] text-ink-2">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </Shell>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rise rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(17,19,17,0.04)] sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export const TONE: Record<Severity, { chip: string; dot: string; bar: string; text: string }> = {
  high: { chip: "bg-rose-soft text-rose", dot: "bg-rose", bar: "bg-rose", text: "text-rose" },
  medium: { chip: "bg-honey-soft text-honey", dot: "bg-honey", bar: "bg-honey", text: "text-honey" },
  low: { chip: "bg-sage-soft text-sage", dot: "bg-sage", bar: "bg-sage", text: "text-sage" },
};

export function Badge({ level }: { level: Severity }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[level].chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE[level].dot}`} />
      {level === "high" ? "High" : level === "medium" ? "Medium" : "Low"} risk
    </span>
  );
}

// Cycles through messages every 3 s so a 10-20 s AI wait feels intentional.
export function useRotating(messages: string[], active = true, every = 3000) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((n) => n + 1), every);
    return () => {
      clearInterval(t);
      setI(0);
    };
  }, [active, every, messages.length]);
  return messages[i % messages.length];
}

export const MESSAGES = {
  claim: ["Reading your policy…", "Finding what’s covered…", "Doing the maths…", "Writing your claim letter…"],
  profile: ["Understanding your business…", "Spotting the gear you rely on…"],
  gaps: ["Understanding your business…", "Comparing you to an employee…"],
};

export function Loading({ messages }: { messages?: string[] }) {
  const message = useRotating(messages ?? [""], !!messages);
  return (
    <div className="space-y-4" aria-label="Loading">
      {messages && (
        <p key={message} role="status" aria-live="polite" className="rise flex items-center gap-2.5 text-[15px] font-medium text-brand">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
          {message}
        </p>
      )}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-6">
          <div className="skeleton h-4 w-2/5 rounded-full" />
          <div className="skeleton mt-4 h-3 w-full rounded-full" />
          <div className="skeleton mt-2 h-3 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, note, accent }: { label: string; value: ReactNode; unit?: string; note?: string; accent?: boolean }) {
  return (
    <Card>
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className={`display mt-1 text-[1.9rem] sm:text-[2.5rem] ${accent ? "text-brand" : "text-ink"}`}>
        {value}
        {unit && <span className="ml-0.5 text-base font-medium tracking-normal text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-[13px] text-ink-3">{note}</p>}
    </Card>
  );
}

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const button =
  "pressable inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-brand-strong disabled:opacity-40";
export const buttonGhost =
  "pressable inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3.5 text-[15px] font-semibold text-ink hover:bg-sunken";
export const input =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";
export const label = "mb-2 block text-[13px] font-semibold text-ink-2";

// A number field you can clear and retype. Keeping the text (not the number) as the
// field's value stops an emptied box snapping back to "0" and turning "200" into "0200".
export function NumberInput({
  value,
  onValue,
  className = input,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValue: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // Follow changes from outside (e.g. picking different equipment) without fighting the typing.
  if (value !== seen) {
    setSeen(value);
    if ((text === "" ? 0 : Number(text)) !== value) setText(String(value));
  }
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      className={className}
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/^0+(?=\d)/, ""); // "0200" -> "200", keeps "0.5"
        setText(next);
        const n = next === "" ? 0 : Number(next);
        setSeen(n);
        if (Number.isFinite(n)) onValue(n);
      }}
    />
  );
}
