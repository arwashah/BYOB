'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';
import type { Gap } from '@/lib/types';
import { textDir } from '@/lib/language';
import { Badge, Card, Loading, MESSAGES, Page, TONE, button } from '@/components/ui';
import { IconArrowRight, IconGaps } from '@/components/icons';

export default function GapsPage() {
  const profile = useProfile();
  const [gaps, setGaps] = useState<Gap[] | null>(null);

  useEffect(() => {
    if (profile) api.gaps(profile).then(setGaps);
  }, [profile]);

  const high = gaps?.filter((g) => g.severity === 'high').length ?? 0;

  return (
    <Page
      eyebrow={profile ? `${profile.name} · ${profile.business}` : undefined}
      title="What you’re missing."
      subtitle="Everything an employee gets that you don’t, most urgent first, with how to fix it."
    >
      {!gaps ? (
        <Loading messages={MESSAGES.gaps} />
      ) : (
        <>
          <div className="rise flex flex-wrap gap-2">
            <span className="rounded-full bg-rose-soft px-3 py-1.5 text-[13px] font-semibold text-rose">{high} urgent</span>
            <span className="rounded-full bg-sunken px-3 py-1.5 text-[13px] font-semibold text-ink-2">{gaps.length} gaps found</span>
          </div>

          {gaps.map((g, i) => (
            <Card key={g.id}>
              <div dir={textDir(profile?.language)}>
                <div className="flex items-start gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONE[g.severity].chip}`}>
                    <IconGaps width={22} height={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="title text-[19px] text-ink">{g.title}</h2>
                      <Badge level={g.severity} />
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{g.why}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-sunken p-4">
                  <p className="mb-3 text-[13px] font-semibold text-ink-2">How to fix it</p>
                  <ol className="space-y-2.5">
                    {g.fixes.map((f, j) => (
                      <li key={f} className="flex gap-3 text-[15px] text-ink">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[12px] font-semibold text-brand">{j + 1}</span>
                        <span className="pt-0.5">{f}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {g.source && <p className="mt-3 text-[12px] text-ink-3">Source: {g.source}</p>}
              </div>
              <span className="sr-only">Gap {i + 1} of {gaps.length}</span>
            </Card>
          ))}

          <div className="flex flex-col items-start gap-3 pt-4">
            <Link href="/forecast" className={button}>
              See my savings plan <IconArrowRight width={18} height={18} />
            </Link>
            <p className="text-[12px] text-ink-3">BYOB informs, never sells. This isn’t financial advice.</p>
          </div>
        </>
      )}
    </Page>
  );
}
