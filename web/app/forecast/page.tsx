'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { downloadReminder, useAutoSave } from '@/lib/autoSave';
import { useLive } from '@/lib/useLive';
import { useProfile } from '@/lib/useProfile';
import type { Forecast, NudgeSeverity, Profile } from '@/lib/types';
import { Badge, Card, Chip, Loading, Page, TONE, button, buttonGhost, label, money } from '@/components/ui';
import { IconArrowRight, IconCheck, IconForecast, IconMoon } from '@/components/icons';

// Recommend the amount and walk the user through their own bank's recurring transfer.
// BYOB never asks for bank details and never moves the money.
function AutoSaveCard({ forecast, on, setOn }: { forecast: Forecast; on: boolean; setOn: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(2);
  const panelId = useId();
  const monthly = forecast.timeOffMonthly + forecast.repairFundMonthly;

  const steps = [
    { title: 'Open a separate savings account', body: 'Name it “BYOB fund” so it stays apart from your spending money.' },
    { title: 'Go to Transfers → Recurring (or Scheduled) transfer', body: 'Every bank app has one. Pick your chequing account as “from” and the BYOB fund as “to”.' },
    { title: `Amount: ${money(monthly)}, every month`, body: 'Set it for the day after you usually get paid, so the money moves before you can spend it.' },
  ];

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <IconForecast width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="title text-[19px] text-ink">Set up auto-save: {money(monthly)}/month</h2>
          <p className="mt-1 text-[14px] text-ink-2">BYOB recommends the amount. Your bank moves the money.</p>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-line rounded-2xl bg-sunken px-4">
        <div className="flex items-baseline justify-between gap-3 py-3">
          <dt>
            <span className="block text-[15px] font-semibold text-ink">Time-off fund</span>
            <span className="block text-[13px] text-ink-3">4%, like employer vacation pay</span>
          </dt>
          <dd className="text-[15px] font-semibold text-ink">{money(forecast.timeOffMonthly)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-3">
          <dt>
            <span className="block text-[15px] font-semibold text-ink">Repair fund</span>
            <span className="block text-[13px] text-ink-3">For medium and high-risk gear</span>
          </dt>
          <dd className="text-[15px] font-semibold text-ink">{money(forecast.repairFundMonthly)}</dd>
        </div>
      </dl>

      <div aria-live="polite">
        {on && (
          <div className="rise mt-4 flex items-center gap-3 rounded-2xl bg-sage-soft p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage text-white">
              <IconCheck width={16} height={16} />
            </span>
            <p className="text-[15px] font-semibold text-sage">
              Auto-save on: you&apos;ll have {money(monthly * 12)} by next year
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`${on ? buttonGhost : button} mt-5 w-full`}
      >
        {open ? 'Hide the steps' : on ? 'See the steps again' : 'Set up auto-save'}
      </button>

      {open && (
        <div id={panelId} className="rise mt-5">
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                  <span className="block text-[14px] text-ink-2">{s.body}</span>
                </span>
              </li>
            ))}
            <li className="flex gap-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">4</span>
              <label className="pressable flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3 has-[:checked]:border-sage has-[:checked]:bg-sage-soft">
                <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-[var(--sage)]" />
                <span className="text-[15px] font-semibold text-ink">Done: I&apos;ve set it up</span>
              </label>
            </li>
          </ol>

          <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-line pt-5">
            <div>
              <label className={label} htmlFor="remind-day">Remind me on day</label>
              <select
                id="remind-day"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button onClick={() => downloadReminder(monthly, day)} className={`${buttonGhost} flex-1`}>
              Add a monthly reminder to my calendar
            </button>
          </div>
          <p className="mt-2 text-[13px] text-ink-3">Downloads a calendar file for Google Calendar, Outlook or Apple Calendar.</p>
        </div>
      )}

      <p className="mt-5 text-[13px] font-medium text-ink-2">
        BYOB never moves or holds your money, and never asks for bank details, card numbers or logins.
      </p>
    </Card>
  );
}

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
  const [autoSave, setAutoSave] = useAutoSave(profile?.name ?? 'you');

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
  // The "after" number counts your own time-off savings only once auto-save is on.
  const weeklyIncome = (f.average * 12) / 52;
  const savingsWeeks = weeklyIncome > 0 ? (f.timeOffMonthly * 12) / weeklyIncome : 0;
  const groupWeeks = Math.max(0, Math.round((f.weeksCoveredAfter - savingsWeeks) * 10) / 10);
  const afterWeeks = autoSave ? f.weeksCoveredAfter : groupWeeks;

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
            <p className="text-[14px] text-white/70">{autoSave ? 'After a year with auto-save' : 'With your group today'}</p>
            <p className="display mt-1 text-[3.25rem] sm:text-[4.5rem]" aria-live="polite">
              {afterWeeks}
              <span className="ml-2 text-[17px] font-medium tracking-normal text-white/70">weeks</span>
            </p>
          </div>
        </div>
        <p className="mt-4 text-[14px] text-white/80">
          {autoSave
            ? 'Your time-off fund plus the most your group could gift.'
            : `The most your group could gift. Turn on auto-save to reach ${f.weeksCoveredAfter} weeks.`}
        </p>
      </section>

      <AutoSaveCard forecast={f} on={autoSave} setOn={setAutoSave} />

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
