'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';
import type { Forecast } from '@/lib/types';
import { Badge, Card, Loading, Page, Stat, TONE, button, money } from '@/components/ui';
import { IconArrowRight } from '@/components/icons';

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Time-off fund" value={money(f.timeOffMonthly)} unit="/mo" note="4%, like employer vacation pay" />
        <Stat label="Repair fund" value={money(f.repairFundMonthly)} unit="/mo" note="For medium and high-risk gear" />
        <Stat
          label="Weeks off covered"
          value={<>{f.weeksCoveredBefore} <span className="text-ink-3">→</span> {f.weeksCoveredAfter}</>}
          note="Before vs after a year with BYOB"
          accent
        />
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

      <div className="pt-4">
        <Link href="/claim" className={button}>
          Something broke? Make a claim <IconArrowRight width={18} height={18} />
        </Link>
      </div>
    </Page>
  );
}
