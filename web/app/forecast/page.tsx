'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLive } from '@/lib/useLive';
import { useProfile } from '@/lib/useProfile';
import type { Forecast, NudgeSeverity, Profile } from '@/lib/types';
import { Badge, Card, Chip, Loading, Page, Stat, TONE, button, money } from '@/components/ui';
import { IconArrowRight, IconMoon } from '@/components/icons';

const WEEKS = ['3 weeks ago', '2 weeks ago', 'Last week', 'This week'];
const NUDGE_CHIP: Record<NudgeSeverity, { text: string; tone: 'low' | 'medium' | 'high' }> = {
  none: { text: 'On track', tone: 'low' },
  heads_up: { text: 'Heads-up', tone: 'medium' },
  strong: { text: 'Take a break', tone: 'high' },
};

// "Should I take a break?" The steppers respond instantly; the answer follows.
function NudgeCard({ profile, forecast }: { profile: Profile; forecast: Forecast }) {
  const [days, setDays] = useState<number[]>(profile.daysWorked ?? [5, 5, 5, 5]);
  const weeklyIncome = (forecast.average * 12) / 52;
  const fundWeeks = weeklyIncome > 0 ? Math.round(((forecast.timeOffMonthly * 12) / weeklyIncome) * 10) / 10 : 0;
  const nudge = useLive((signal) => api.nudge(days, fundWeeks, profile.name, signal), [days.join(','), fundWeeks, profile.name]);

  const change = (i: number, delta: number) =>
    setDays((d) => d.map((v, j) => (j === i ? Math.min(7, Math.max(0, v + delta)) : v)));

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <IconMoon width={20} height={20} />
          </span>
          <h2 className="title text-[19px] text-ink">Time to rest?</h2>
        </div>
        {nudge && <Chip tone={NUDGE_CHIP[nudge.severity].tone}>{NUDGE_CHIP[nudge.severity].text}</Chip>}
      </div>
      <p className="mt-2 text-[14px] text-ink-2">Days you worked each week.</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.map((d, i) => (
          <div key={WEEKS[i]} className="rounded-2xl bg-sunken p-3 text-center">
            <p className="text-[12px] font-medium text-ink-3">{WEEKS[i]}</p>
            <div className="mt-1 flex items-center justify-between gap-1">
              <button
                onClick={() => change(i, -1)}
                disabled={d === 0}
                aria-label={`One less day, ${WEEKS[i]}`}
                className="pressable grid h-11 w-11 place-items-center rounded-full text-[20px] text-ink-2 hover:bg-surface disabled:opacity-30"
              >
                −
              </button>
              <span className="display text-[1.75rem] text-ink" aria-live="polite">{d}</span>
              <button
                onClick={() => change(i, 1)}
                disabled={d === 7}
                aria-label={`One more day, ${WEEKS[i]}`}
                className="pressable grid h-11 w-11 place-items-center rounded-full text-[20px] text-ink-2 hover:bg-surface disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div aria-live="polite">
        {nudge && (
          <div className="mt-5">
            <p className="text-[16px] font-medium leading-relaxed text-ink">{nudge.message}</p>
            {nudge.reasons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {nudge.reasons.map((r) => (
                  <li key={r} className="text-[13px] text-ink-2">· {r}</li>
                ))}
              </ul>
            )}
            {nudge.resources.length > 0 && (
              <div className="mt-4 rounded-2xl border border-line p-4">
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Free support, any time</p>
                <ul className="space-y-1.5">
                  {nudge.resources.map((r) => (
                    <li key={r.name} className="text-[14px] text-ink">
                      <b>{r.name}</b> <span className="text-ink-2">· {r.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-[12px] text-ink-3">{nudge.disclaimer}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ForecastPage() {
  const profile = useProfile();
  const [f, setF] = useState<Forecast | null>(null);

  useEffect(() => {
    if (profile) api.forecast(profile).then(setF);
  }, [profile]);

  const header = {
    eyebrow: profile ? `${profile.name} · ${profile.business}` : undefined,
    title: 'Pay yourself first.',
    subtitle: 'Your lean months, your riskiest gear, and what to set aside each month.',
  };

  if (!f) return <Page {...header}><Loading /></Page>;

  const max = Math.max(...f.months.map((m) => m.income), 1);

  return (
    <Page {...header}>
      <section aria-label="Weeks off covered" className="rise overflow-hidden rounded-2xl bg-brand p-6 text-white sm:p-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">Weeks of income covered if you stop working</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[14px] text-white/70">Before BYOB</p>
            <p className="display mt-1 text-[3.25rem] sm:text-[4.5rem]">
              {f.weeksCoveredBefore}
              <span className="ml-2 text-[17px] font-medium tracking-normal text-white/70">weeks</span>
            </p>
          </div>
          <div className="border-l border-white/20 pl-4 sm:pl-6">
            <p className="text-[14px] text-white/70">After a year with BYOB</p>
            <p className="display mt-1 text-[3.25rem] sm:text-[4.5rem]">
              {f.weeksCoveredAfter}
              <span className="ml-2 text-[17px] font-medium tracking-normal text-white/70">weeks</span>
            </p>
          </div>
        </div>
        <p className="mt-4 text-[14px] text-white/80">Your time-off fund plus the most your group could gift.</p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Time-off fund" value={money(f.timeOffMonthly)} unit="/mo" note="4%, like employer vacation pay" />
        <Stat label="Repair fund" value={money(f.repairFundMonthly)} unit="/mo" note="For medium and high-risk gear" />
      </div>

      <Card>
        <h2 className="title text-[19px] text-ink">Income, last 12 months</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          Average {money(f.average)} a month.{' '}
          {f.leanMonths.length > 0 ? `Lean months: ${f.leanMonths.join(', ')}.` : 'No lean months.'}
        </p>
        <div className="mt-6 flex h-44 items-end gap-1.5">
          {f.months.map((m) => (
            <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div
                title={money(m.income)}
                className={`w-full rounded-t-lg ${f.leanMonths.includes(m.label) ? 'bg-honey' : 'bg-brand/80'}`}
                style={{ height: `${(m.income / max) * 100}%` }}
              />
              <span className="text-[11px] text-ink-3">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-5 text-[13px] text-ink-2">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand/80" /> Normal</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-honey" /> Lean</span>
        </div>
      </Card>

      <Card>
        <h2 className="title mb-5 text-[19px] text-ink">Equipment risk</h2>
        <div className="space-y-5">
          {f.equipment.map((e) => (
            <div key={e.name}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold text-ink">{e.name}</span>
                <Badge level={e.level} />
              </div>
              <div className="mt-2 h-2 rounded-full bg-sunken">
                <div className={`h-2 rounded-full ${TONE[e.level].bar}`} style={{ width: `${e.score}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-ink-2">
                Score {e.score}/100 · {e.reason} · set aside <b className="text-ink">{money(e.monthlySetAside)}/mo</b>
              </p>
            </div>
          ))}
        </div>
      </Card>

      {profile && <NudgeCard key={profile.name} profile={profile} forecast={f} />}

      <div className="pt-4">
        <Link href="/claim" className={button}>
          Something broke? Make a claim <IconArrowRight width={18} height={18} />
        </Link>
      </div>
    </Page>
  );
}
