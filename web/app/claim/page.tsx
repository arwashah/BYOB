'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLive } from '@/lib/useLive';
import { useProfile } from '@/lib/useProfile';
import { textDir } from '@/lib/language';
import type { ClaimPlan, ClaimResult, Insurance, PlanStep } from '@/lib/types';
import { Card, Loading, MESSAGES, NumberInput, Page, button, buttonGhost, input, label, money } from '@/components/ui';
import { IconArrowRight, IconCamera, IconCheck, IconClaim, IconCopy, IconGaps, IconPool, IconUpload, IconWrench, IconX } from '@/components/icons';

const STATUS = {
  covered: { text: 'Covered', cls: 'bg-sage-soft text-sage' },
  partial: { text: 'Partly covered', cls: 'bg-honey-soft text-honey' },
  not_covered: { text: 'Not covered', cls: 'bg-rose-soft text-rose' },
};

const STEP_ICON: Record<PlanStep['step'], typeof IconClaim> = {
  insurance: IconClaim,
  fund: IconGaps,
  pool: IconPool,
  backup: IconWrench,
};

function SplitBar({ parts }: { parts: { label: string; value: number; cls: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-3 gap-1 overflow-hidden rounded-full">
        {shown.map((p) => (
          <div key={p.label} className={`${p.cls} rounded-full transition-[width] duration-500`} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {shown.map((p) => (
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

// Insurance first, then your own fund, then your group, then a way to keep earning.
function RecoveryPlan({ n, plan, item }: { n: number; plan: ClaimPlan; item: string }) {
  const amountOf = (step: PlanStep['step']) => plan.steps.find((s) => s.step === step)?.amount ?? 0;
  const fromPool = amountOf('pool');
  const askGap = fromPool + plan.stillUncovered; // what's left after insurance and the fund
  return (
    <Card>
      <SectionTitle n={n}>Your recovery plan</SectionTitle>
      <SplitBar
        parts={[
          { label: 'Insurer', value: plan.insurerPays, cls: 'bg-sage' },
          { label: 'Your fund', value: amountOf('fund'), cls: 'bg-brand/60' },
          { label: 'Group gift', value: fromPool, cls: 'bg-brand' },
          { label: 'Still uncovered', value: plan.stillUncovered, cls: 'bg-rose' },
        ]}
      />
      <ol className="mt-6 space-y-4">
        {plan.steps.map((s) => {
          const Icon = STEP_ICON[s.step];
          return (
            <li key={s.step} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-brand">
                <Icon width={20} height={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold text-ink">{s.title}</span>
                  {s.step !== 'backup' && <span className="text-[15px] font-semibold text-ink">{money(s.amount)}</span>}
                </span>
                {s.note && <span className="block text-[14px] text-ink-2">{s.note}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {plan.weeksCovered !== null && (
        <p className="mt-5 text-[14px] text-ink-2">
          Your fund and your group together cover about <b className="text-ink">{plan.weeksCovered} weeks</b> of income.
        </p>
      )}
      {fromPool > 0 && (
        <Link
          href={`/pool?amount=${Math.round(fromPool)}&gap=${Math.round(askGap)}&for=${encodeURIComponent(`${item} repair`)}`}
          className={`${button} mt-6`}
        >
          Ask my group for {money(fromPool)} <IconArrowRight width={18} height={18} />
        </Link>
      )}
    </Card>
  );
}

export default function ClaimPage() {
  const profile = useProfile();
  const [item, setItem] = useState('');
  const [costInput, setCostInput] = useState<number | null>(null);
  const [fundInput, setFundInput] = useState<number | null>(null);
  const [policy, setPolicy] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [skipPolicy, setSkipPolicy] = useState(false);
  const [ready, setReady] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const equipment = profile?.equipment.find((e) => e.name === item) ?? profile?.equipment[0];
  const broken = equipment?.name ?? '';
  const cost = costInput ?? equipment?.replacementCost ?? 0;
  const fund = fundInput ?? profile?.repairFundSaved ?? 0;
  const noPolicy = profile?.insurance === 'no';
  const notSure = profile?.insurance === 'not_sure';
  const income = profile?.monthlyIncome ?? [];
  const weeklyIncome = income.length ? Math.round(((income.reduce((a, b) => a + b, 0) / income.length) * 12) / 52) : undefined;

  // A read policy means the user is insured, whatever they said at onboarding.
  const branch: Insurance = result ? 'yes' : profile?.insurance ?? 'not_sure';
  const plan = useLive(
    (signal) =>
      api.claimPlan(
        { insurance: branch, repairCost: cost, insurerPays: result?.insurerPays, fundBalance: fund, equipment: broken.toLowerCase(), weeklyExpenses: weeklyIncome },
        signal,
      ),
    [branch, cost, fund, broken, result?.insurerPays, weeklyIncome],
    150,
    profile !== null && cost > 0, // the server needs a real repair cost
  );

  if (!profile) return <Page title="Something broke?"><Loading /></Page>;

  // Never shows a made-up answer: if the server can't read the policy, say so
  // and let the user re-send the same file.
  const read = async () => {
    if (!policy) return;
    setLoading(true);
    setFailed(false);
    setResult(null);
    try {
      const r = await api.claim(profile, broken, cost, policy);
      setResult(r);
      setDraft(r.draft);
      setReady([]);
    } catch (err) {
      console.warn('Policy reader failed:', err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // A PDF, or a photo of a paper policy (the server reads both).
  const pickFile = (f: File | undefined | null) => {
    if (f && (f.type === 'application/pdf' || f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.pdf'))) {
      setPolicy(f);
      setFailed(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const showPlan = plan && cost > 0 && (noPolicy || skipPolicy || result);
  const planStep = noPolicy ? 2 : result ? 4 : 3;

  return (
    <Page
      eyebrow="When something breaks"
      title="Something broke?"
      subtitle={noPolicy ? 'No policy? Your repair fund and your group still have your back.' : 'Drop in your policy. We’ll say what’s covered, what to gather, and write the claim for you.'}
    >
      <Card>
        <SectionTitle n={1}>What broke?</SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {profile.equipment.map((e) => {
            const on = e.name === broken;
            return (
              <button
                key={e.name}
                onClick={() => { setItem(e.name); setCostInput(null); }}
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
        <div className="mt-5 grid max-w-md grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="cost">Repair estimate</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">$</span>
              <NumberInput id="cost" min={0} className={`${input} pl-8`} value={cost} onValue={setCostInput} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="fund">Repair fund saved</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">$</span>
              <NumberInput id="fund" min={0} className={`${input} pl-8`} value={fund} onValue={setFundInput} />
            </div>
          </div>
        </div>
      </Card>

      {!noPolicy && (
        <>
          {notSure && plan && plan.checklist.length > 0 && (
            <Card>
              <h2 className="title text-[19px] text-ink">Not sure what you&apos;re covered for?</h2>
              <p className="mt-1 text-[14px] text-ink-2">Look for these in any policy you have, or upload it and we&apos;ll read it for you.</p>
              <ul className="mt-4 space-y-2.5">
                {plan.checklist.map((c) => (
                  <li key={c} className="flex gap-2.5 text-[14px] text-ink">
                    <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-brand" />
                    {c}
                  </li>
                ))}
              </ul>
            </Card>
          )}

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
              <span className="title mt-4 block text-[17px] text-ink">{policy ? policy.name : 'Drop your policy here'}</span>
              <span className="mt-1 block text-[14px] text-ink-2">{policy ? 'Tap to choose a different file' : 'A PDF, or a photo of the paper copy'}</span>
              <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            <label className={`${buttonGhost} mt-3 w-full cursor-pointer sm:hidden`}>
              <IconCamera width={18} height={18} />
              Snap a photo of your policy
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            <button onClick={read} disabled={!policy || loading} className={`${button} mt-5 w-full`}>
              {loading ? 'Reading your policy…' : 'Read my policy'}
              {!loading && <IconArrowRight width={18} height={18} />}
            </button>
            {!result && !skipPolicy && (
              <button onClick={() => setSkipPolicy(true)} className={`${buttonGhost} mt-3 w-full`}>
                Don&apos;t have it handy? See my plan without it
              </button>
            )}
          </Card>
        </>
      )}

      {!noPolicy && !result && !loading && !failed && !skipPolicy && (
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

      {loading && <Loading messages={MESSAGES.claim} />}

      {failed && !loading && (
        <Card className="!border-rose/30">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-soft text-rose">
              <IconX width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="title text-[19px] text-ink">We couldn&apos;t read your policy right now.</h2>
              <p className="mt-1 text-[15px] text-ink-2">Try again in a minute. We won&apos;t guess at what you&apos;re owed.</p>
              <button onClick={read} className={`${button} mt-4`}>
                Try again <IconArrowRight width={18} height={18} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <SectionTitle n={3}>What your policy says</SectionTitle>
            <div dir={textDir(profile.language)}>
              <span className={`inline-block rounded-full px-3 py-1.5 text-[13px] font-semibold ${STATUS[result.status].cls}`}>{STATUS[result.status].text}</span>
              <p className="mt-3 text-[17px] leading-relaxed text-ink">{result.summary}</p>

              {result.sourceClauses && result.sourceClauses.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-[13px] font-semibold text-ink-2">From your policy</p>
                  {result.sourceClauses.map((c) => (
                    <blockquote key={c.quote} className="border-l-2 border-brand pl-4">
                      <p className="text-[14px] italic text-ink-2">&ldquo;{c.quote}&rdquo;</p>
                      <p className="mt-1 text-[12px] text-ink-3">{c.section}</p>
                    </blockquote>
                  ))}
                </div>
              ) : (
                result.source && <blockquote className="mt-4 border-l-2 border-brand pl-4 text-[14px] italic text-ink-2">{result.source}</blockquote>
              )}

              {result.calculation && result.calculation.length > 0 && (
                <div className="mt-6 rounded-2xl bg-sunken p-4">
                  <p className="mb-2 text-[13px] font-semibold text-ink-2">How the payout is worked out</p>
                  <dl className="divide-y divide-line">
                    {result.calculation.map((line, i) => (
                      <div key={line.label} className="flex justify-between gap-3 py-2 text-[14px]">
                        <dt className="text-ink-2">{line.label}</dt>
                        <dd className={i === result.calculation!.length - 1 ? 'font-semibold text-ink' : 'text-ink'}>{money(line.amount)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
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
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="title text-[19px] text-ink">Documents to gather</h2>
              <span className="text-[13px] font-medium text-ink-3">{ready.length} of {result.documents.length} ready</span>
            </div>
            {result.deadline && <p className="mt-1 text-[14px] text-ink-2">{result.deadline}</p>}
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
              aria-label="Claim draft"
              className="w-full resize-y rounded-2xl border border-line bg-sunken p-4 text-[14px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </Card>
        </>
      )}

      {showPlan && <RecoveryPlan n={planStep} plan={plan} item={broken} />}
    </Page>
  );
}
