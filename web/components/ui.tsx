"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import type { Severity } from "@/lib/types";
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
        <span className="hidden text-xs text-ink-3 sm:block">Informs, never sells · Not financial advice</span>
      </div>
    </header>
  );
}

// iOS-style tab bar: separate tabs, each with its own icon, floating on a
// translucent material so content scrolls underneath.
function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Steps"
      className="fixed inset-x-0 bottom-0 z-30 px-3 sm:bottom-5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
    >
      <ul className="glass mx-auto grid max-w-md grid-cols-5 gap-1 rounded-2xl border border-line/70 p-1.5 shadow-[0_8px_30px_rgba(17,19,17,0.12)]">
        {STEPS.map(({ href, label, Icon }) => {
          const active = path === href;
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

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-36 sm:pt-12">{children}</main>
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

export function Loading() {
  return (
    <div className="space-y-4" aria-label="Loading">
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
