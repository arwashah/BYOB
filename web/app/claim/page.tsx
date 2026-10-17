'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';
import { fakeForecast } from '@/lib/fake';
import type { ClaimResult } from '@/lib/types';
import { Card, Loading, Page, button, buttonGhost, input, label, money } from '@/components/ui';
import { IconArrowRight, IconCheck, IconClaim, IconCopy, IconGaps, IconPool, IconUpload, IconWrench, IconX } from '@/components/icons';

const STATUS = {
  covered: { text: 'Covered', cls: 'bg-sage-soft text-sage' },
  partial: { text: 'Partly covered', cls: 'bg-honey-soft text-honey' },
  not_covered: { text: 'Not covered', cls: 'bg-rose-soft text-rose' },
};

function SplitBar({ parts }: { parts: { label: string; value: number; cls: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-1 overflow-hidden rounded-full">
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} className={`${p.cls} rounded-full transition-[width] duration-500`} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[14px]">
            <span className={`h-2.5 w-2.5 rounded-full ${p.cls}`} />
            <span className="text-ink-2">{p.label}</span>
            <span className="font-semibold text-ink">{money(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">{n}</span>
      <h2 className="title text-[19px] text-ink">{children}</h2>
    </div>
  );
}

export default function ClaimPage() {
  const profile = useProfile();
  const [item, setItem] = useState('');
  const [cost, setCost] = useState(3200);
  const [policy, setPolicy] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  if (!profile) return <Page title="Something broke?"><Loading /></Page>;

  const broken = item || profile.equipment[0]?.name || '';
  const noPolicy = profile.insurance === 'no';
  const repairFund = fakeForecast(profile).repairFundMonthly * 12;
  const askPool = (amount: number) => `/pool?amount=${Math.round(amount)}`;

  const read = async () => {
    if (!policy) return;
    setLoading(true);
    setResult(null);
    const r = await api.claim(profile, broken, cost, policy);
    setResult(r);
    setDraft(r.draft);
    setReady([]);
    setLoading(false);
  };

  const pickFile = (f: File | undefined | null) => {
    if (f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) setPolicy(f);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const fromFund = Math.min(repairFund, cost);
  const fromPool = Math.max(0, cost - fromFund);

  return (
    <Page
      eyebrow="When something breaks"
      title="Something broke?"
      subtitle={noPolicy ? 'No policy? Your repair fund and your pool still have your back.' : 'Drop in your policy. We’ll say what’s covered, what to gather, and write the claim for you.'}
    >
      <Card>
        <SectionTitle n={1}>What broke?</SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {profile.equipment.map((e) => {
            const on = e.name === broken;
            return (
              <button
                key={e.name}
                onClick={() => setItem(e.name)}
                aria-pressed={on}
                className={`pressable flex items-center gap-3 rounded-2xl border p-3.5 text-left ${on ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/40'}`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-brand text-white' : 'bg-sunken text-ink-2'}`}>
                  <IconWrench width={20} height={20} />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[15px] font-semibold ${on ? 'text-brand' : 'text-ink'}`}>{e.name}</span>
                  <span className="block text-[13px] text-ink-3">{e.ageYears} yrs · {e.repairs} repairs</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 max-w-xs">
          <label className={label} htmlFor="cost">Repair estimate</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">$</span>
            <input id="cost" type="number" min={0} className={`${input} pl-8`} value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </div>
        </div>
      </Card>

      {noPolicy ? (
        <Card>
          <SectionTitle n={2}>Your backup plan</SectionTitle>
          <SplitBar
            parts={[
              { label: 'Repair fund', value: fromFund, cls: 'bg-sage' },
              { label: 'Pool gift', value: fromPool, cls: 'bg-brand' },
            ]}
          />
          <ol className="mt-6 space-y-4">
            {[
              { Icon: IconGaps, title: 'Use your repair fund', body: `A year of set-asides is about ${money(repairFund)} toward the ${money(cost)} repair.` },
              { Icon: IconPool, title: 'Ask your pool for the rest', body: `Your group can gift about ${money(fromPool)} from their own savings.` },
              { Icon: IconWrench, title: 'Keep earning meanwhile', body: 'Rent a shared space or borrow capacity from a pool member while it’s fixed.' },
            ].map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-brand"><Icon width={20} height={20} /></span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{title}</span>
                  <span className="block text-[14px] text-ink-2">{body}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link href={askPool(fromPool)} className={`${button} mt-6`}>
            Ask my pool for help <IconArrowRight width={18} height={18} />
          </Link>
        </Card>
      ) : (
        <Card>
          <SectionTitle n={2}>Your policy</SectionTitle>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
            className={`pressable flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center ${
              dragging ? 'border-brand bg-brand-soft' : policy ? 'border-sage/60 bg-sage-soft' : 'border-line hover:border-brand/50'
            }`}
          >
            <span className={`grid h-14 w-14 place-items-center rounded-2xl ${policy ? 'bg-sage text-white' : 'bg-brand-soft text-brand'}`}>
              {policy ? <IconCheck width={26} height={26} /> : <IconUpload width={26} height={26} />}
            </span>
            <span className="title mt-4 block text-[17px] text-ink">{policy ? policy.name : 'Drop your policy PDF here'}</span>
            <span className="mt-1 block text-[14px] text-ink-2">{policy ? 'Tap to choose a different file' : 'or tap to choose a file'}</span>
            <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          <button onClick={read} disabled={!policy || loading} className={`${button} mt-5 w-full`}>
            {loading ? 'Reading your policy…' : 'Read my policy'}
            {!loading && <IconArrowRight width={18} height={18} />}
          </button>
        </Card>
      )}

      {!noPolicy && !result && !loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { Icon: IconGaps, title: 'A clear verdict', body: 'Covered, partly covered or not, with the exact clause.' },
            { Icon: IconCheck, title: 'What to gather', body: 'A checklist of the documents your insurer will ask for.' },
            { Icon: IconClaim, title: 'A claim, written', body: 'A ready-to-send draft you can edit and copy.' },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rise rounded-2xl border border-dashed border-line p-5">
              <Icon width={22} height={22} className="text-brand" />
              <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
              <p className="mt-1 text-[14px] text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <Loading />}

      {result && (
        <>
          <Card>
            <SectionTitle n={3}>What your policy says</SectionTitle>
            <span className={`inline-block rounded-full px-3 py-1.5 text-[13px] font-semibold ${STATUS[result.status].cls}`}>{STATUS[result.status].text}</span>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">{result.summary}</p>
            {result.source && (
              <blockquote className="mt-4 border-l-2 border-brand pl-4 text-[14px] italic text-ink-2">{result.source}</blockquote>
            )}

            <div className="mt-6">
              <SplitBar
                parts={[
                  { label: 'Insurer pays', value: result.insurerPays, cls: 'bg-sage' },
                  { label: 'Left for you', value: result.uncovered, cls: 'bg-honey' },
                ]}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-sage-soft p-4">
                <p className="mb-2 text-[13px] font-semibold text-sage">Covered</p>
                <ul className="space-y-2">
                  {result.covered.map((c) => (
                    <li key={c} className="flex gap-2 text-[14px] text-ink"><IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-sage" />{c}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-rose-soft p-4">
                <p className="mb-2 text-[13px] font-semibold text-rose">Not covered</p>
                <ul className="space-y-2">
                  {result.notCovered.map((c) => (
                    <li key={c} className="flex gap-2 text-[14px] text-ink"><IconX width={16} height={16} className="mt-0.5 shrink-0 text-rose" />{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="title text-[19px] text-ink">Documents to gather</h2>
              <span className="text-[13px] font-medium text-ink-3">{ready.length} of {result.documents.length} ready</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-sage transition-[width] duration-300" style={{ width: `${(ready.length / result.documents.length) * 100}%` }} />
            </div>
            <ul className="mt-3 divide-y divide-line">
              {result.documents.map((d) => {
                const on = ready.includes(d);
                return (
                  <li key={d}>
                    <button
                      onClick={() => setReady(on ? ready.filter((x) => x !== d) : [...ready, d])}
                      className="pressable flex w-full items-center gap-3 py-3.5 text-left text-[15px]"
                      aria-pressed={on}
                    >
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${on ? 'border-sage bg-sage text-white' : 'border-line'}`}>
                        {on && <IconCheck width={14} height={14} />}
                      </span>
                      <span className={on ? 'text-ink-3 line-through' : 'text-ink'}>{d}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="title text-[19px] text-ink">Your claim, written</h2>
              <button onClick={copy} className={`${buttonGhost} !px-4 !py-2 text-[14px]`}>
                {copied ? <IconCheck width={16} height={16} className="text-sage" /> : <IconCopy width={16} height={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              rows={13}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full resize-y rounded-2xl border border-line bg-sunken p-4 text-[14px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </Card>

          {result.uncovered > 0 && (
            <div className="rise flex flex-col gap-4 rounded-2xl bg-brand p-6 text-white sm:flex-row sm:items-center">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><IconPool width={24} height={24} /></span>
              <div className="flex-1">
                <p className="title text-[19px]">Your pool can help with the other {money(result.uncovered)}</p>
                <p className="mt-1 text-[14px] text-white/80">Gifts from your group, sent from their own savings.</p>
              </div>
              <Link href={askPool(result.uncovered)} className="pressable inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-brand">
                Ask my pool <IconArrowRight width={18} height={18} />
              </Link>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
