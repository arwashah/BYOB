'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useLive } from '@/lib/useLive';
import { useProfile } from '@/lib/useProfile';
import { isExampleProfile } from '@/lib/examples';
import { createGroup, leaveGroup, useMyGroup, type MyGroup } from '@/lib/myGroup';
import type { Pool, PoolRequestResult } from '@/lib/types';
import { Card, Chip, Loading, NumberInput, Page, STATUS_TONE, Stat, TONE, button, buttonGhost, input, label, money } from '@/components/ui';
import { IconCheck, IconPool, IconX } from '@/components/icons';

const DECISION = {
  approved: { text: 'Approved', tone: 'low' },
  partial: { text: 'Partly approved', tone: 'medium' },
  denied: { text: 'Not approved', tone: 'high' },
} as const;

// The seeded "Toronto Solo Makers Circle": made-up members and money, real rules.
function SampleGroup({ exploring = false }: { exploring?: boolean }) {
  const params = useSearchParams();
  const profile = useProfile();
  const gapParam = params.get('gap');
  const gap = gapParam === null ? null : Number(gapParam);
  const [pool, setPool] = useState<Pool | null>(null);
  const [amount, setAmount] = useState(Number(params.get('amount')) || 1000);
  const [reason, setReason] = useState(params.get('for') ?? '');
  const [monthsInGroup, setMonthsInGroup] = useState(8);
  const [whatIf, setWhatIf] = useState(3);
  const [result, setResult] = useState<PoolRequestResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.pool().then(setPool);
  }, []);

  // Re-ask whenever the slider moves or the pledges change; the slider itself never waits.
  const scenario = useLive((signal) => api.poolWhatIf(whatIf, signal), [whatIf, pool?.health?.pledged]);

  if (!pool) return <Loading />;

  const capacity = pool.health?.pledged ?? pool.members.length * pool.pledgePerMember;
  const maxGiftNow = pool.health?.maxGiftNow ?? Math.min(pool.maxGiftPerClaim, capacity);
  const overGap = gap !== null && amount > gap;
  const invalid = amount <= 0 || overGap;

  const request = async () => {
    setSending(true);
    const r = await api.poolRequest({
      amount,
      monthsInGroup,
      uncoveredGap: gap ?? undefined,
      name: profile?.name,
      trade: profile?.business,
      reason: reason.trim() || 'Support request',
    });
    setResult(r);
    if (r.pool) setPool(r.pool);
    setSending(false);
  };

  const reset = async () => {
    setPool(await api.poolReset());
    setResult(null);
  };

  return (
    <>
      <Card className="!bg-brand !border-brand text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold">Sample group</span>
          <p className="text-[13px] font-semibold text-white/80">{pool.groupName}</p>
        </div>
        <p className="display mt-2 text-[2rem] sm:text-[2.5rem]">
          {exploring ? 'This' : 'Your'} group has pledged up to {money(maxGiftNow)}
        </p>
        <p className="mt-3 text-[14px] text-white/80">
          Made-up members and money, so you can see how a group works. The rules are real.
        </p>
        <p className="mt-2 text-[14px] text-white/80">
          {pool.disclaimer ??
            'BYOB never holds money. Members keep their share in their own savings and send a gift if someone needs it. Gifts, not guarantees.'}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Members" value={pool.members.length} />
        <Stat label="Max gift" value={money(pool.maxGiftPerClaim)} note={`Up to ${pool.maxMonths} months`} />
        <Stat label="Waiting period" value={pool.waitingMonths} unit=" mo" note="For new members" />
      </div>

      {pool.health && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="title text-[19px] text-ink">Group health</h2>
            <Chip tone={STATUS_TONE[pool.health.status].tone}>{STATUS_TONE[pool.health.status].text}</Chip>
          </div>
          <p className="mt-3 text-[15px] text-ink">
            {pool.health.fullGiftsLeft > 0 ? (
              <>Enough pledged for <b>{pool.health.fullGiftsLeft} more full gift{pool.health.fullGiftsLeft === 1 ? '' : 's'}</b> right now.</>
            ) : pool.health.maxGiftNow > 0 ? (
              <>Only smaller gifts right now, up to <b>{money(pool.health.maxGiftNow)}</b>.</>
            ) : (
              <>No gifts until next month&apos;s pledges come in.</>
            )}
          </p>
          <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-colors duration-300 ${i < pool.health!.fullGiftsLeft ? TONE[STATUS_TONE[pool.health!.status].tone].bar : 'bg-sunken'}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-x-5 gap-y-1 text-[14px]">
            <span className="text-ink-2">
              Left to pledge <b className="text-ink">{money(pool.health.pledged)}</b>
            </span>
            <span className="text-ink-2">
              Biggest gift right now <b className="text-ink">{money(pool.health.maxGiftNow)}</b>
            </span>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="title text-[19px] text-ink">Request support</h2>
        {gap !== null && (
          <p className="text-[14px] text-ink-2">
            From your claim: <b className="text-ink">{money(gap)}</b> is left after insurance and your repair fund.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="reason">What&apos;s it for?</label>
            <input
              id="reason"
              className={input}
              maxLength={80}
              placeholder="e.g. Oven repair, 2 weeks sick"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="amount">Amount needed</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">$</span>
              <NumberInput
                id="amount"
                min={0}
                className={`${input} pl-8 ${overGap ? '!border-rose focus:!ring-rose/30' : ''}`}
                value={amount}
                aria-invalid={overGap}
                aria-describedby={overGap ? 'amount-error' : undefined}
                onValue={setAmount}
              />
            </div>
            {overGap && (
              <p id="amount-error" className="mt-2 text-[13px] font-medium text-rose">
                Your group only covers what&apos;s left after insurance and your fund: up to {money(gap)}.
              </p>
            )}
          </div>
        </div>
        <button onClick={request} disabled={sending || invalid} className={`${button} w-full`}>
          {sending ? 'Asking your group…' : 'Request support'}
        </button>

        <div aria-live="polite">
          {result && (
            <div className="rise space-y-3 rounded-2xl bg-sunken p-4">
              {result.decision && (
                <Chip tone={DECISION[result.decision].tone}>{DECISION[result.decision].text}</Chip>
              )}
              <p className="text-[15px] font-medium text-ink">{result.message}</p>
              {result.checks && result.checks.length > 0 && (
                <details className="group">
                  <summary className="pressable cursor-pointer list-none text-[14px] font-semibold text-brand">
                    <span className="group-open:hidden">Why?</span>
                    <span className="hidden group-open:inline">Hide the rules</span>
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {result.checks.map((c) => (
                      <li key={c.rule} className="flex gap-2 text-[14px] text-ink-2">
                        {c.passed ? (
                          <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-sage" />
                        ) : (
                          <IconX width={16} height={16} className="mt-0.5 shrink-0 text-rose" />
                        )}
                        {c.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <details className="rounded-2xl border border-line px-4 py-3">
          <summary className="pressable cursor-pointer text-[13px] font-semibold text-ink-2">Demo options</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className={label} htmlFor="months">Months in the group</label>
              <NumberInput id="months" min={0} value={monthsInGroup} onValue={setMonthsInGroup} />
            </div>
            <button onClick={reset} className={`${buttonGhost} !px-4 !py-3 text-[14px]`}>Reset demo</button>
          </div>
          <p className="mt-2 text-[13px] text-ink-3">Try 1 month to see the waiting period in action.</p>
        </details>
      </Card>

      <Card className="space-y-3">
        <h2 className="title text-[19px] text-ink">What if several people claim at once?</h2>
        <label htmlFor="whatif" className="sr-only">Claims at the same time</label>
        <input
          id="whatif"
          type="range"
          min={1}
          max={10}
          value={whatIf}
          onChange={(e) => setWhatIf(Number(e.target.value))}
          className="w-full accent-[var(--brand)]"
        />
        <p className="text-[15px] text-ink-2">
          <b className="text-ink">{whatIf}</b> claim{whatIf > 1 ? 's' : ''} at once
          {scenario && (
            <>
              {' '}· each member would gift about <b className="text-ink">{money(scenario.perMember)}</b>
            </>
          )}
        </p>
        {scenario && (
          <p className={`text-[15px] font-semibold ${scenario.survives ? 'text-sage' : 'text-honey'}`}>{scenario.message}</p>
        )}
      </Card>

      {pool.gifts && pool.gifts.length > 0 && (
        <Card>
          <h2 className="title mb-3 text-[19px] text-ink">Recent gifts</h2>
          <ul className="divide-y divide-line">
            {pool.gifts.map((g, i) => (
              <li key={`${g.date}-${i}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{g.member}</span>
                  <span className="block truncate text-[13px] text-ink-3">{g.note} · {g.date}</span>
                </span>
                <span className="text-[15px] font-semibold text-ink">{money(g.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="title mb-4 text-[19px] text-ink">Members</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pool.members
            .map((m) => (m.isYou && profile ? { ...m, name: profile.name, trade: profile.business } : m))
            .map((m, i) => (
            <div
              key={`${m.name}-${i}`}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${m.isYou ? 'bg-brand-soft ring-1 ring-brand/30' : 'bg-sunken'}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${m.isYou ? 'bg-brand text-white' : 'bg-brand-soft text-brand'}`}>
                {m.name[0]}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{m.isYou ? `${m.name} (you)` : m.name}</p>
                <p className="truncate text-[12px] text-ink-3">{m.trade} · {m.monthsInGroup} mo</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

const DAY = 24 * 60 * 60 * 1000;

// A typed-in user with no group yet.
function NoGroup({ onCreate, onExplore }: { onCreate: () => void; onExplore: () => void }) {
  return (
    <Card className="text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <IconPool width={26} height={26} />
      </span>
      <h2 className="title mt-4 text-[22px] text-ink">You&apos;re not in a group yet</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">
        A group is a few solo workers who each set a little aside and send a gift when one of you is hit by a shock.
        Start your own, or look around the sample group first.
      </p>
      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
        <button onClick={onCreate} className={button}>Create a group</button>
        <button onClick={onExplore} className={buttonGhost}>Explore the sample group</button>
      </div>
    </Card>
  );
}

// The user's own group: just them, nothing pledged, waiting period running.
function OwnGroup({ group, onLeave }: { group: MyGroup; onLeave: () => void }) {
  const profile = useProfile();
  const [rules, setRules] = useState<Pool | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    api.pool().then(setRules); // only for the rules (waiting period, max gift), not the sample's members
  }, []);

  const waitingMonths = rules?.waitingMonths ?? 3;
  const maxGift = rules?.maxGiftPerClaim ?? 2000;
  const waitDays = waitingMonths * 30;
  const started = Date.parse(group.createdAt);
  const day = Math.min(waitDays, Math.max(1, Math.floor((now - started) / DAY) + 1));
  const askFrom = new Date(started + waitDays * DAY).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const waiting = day < waitDays;

  return (
    <>
      <Card className="!bg-brand !border-brand text-white">
        <p className="text-[13px] font-semibold text-white/80">{group.name}</p>
        <p className="display mt-2 text-[2rem] sm:text-[2.5rem]">Your group has pledged {money(0)}</p>
        <p className="mt-3 text-[14px] text-white/80">
          BYOB never holds money. Members keep their share in their own savings and send a gift if someone needs it. Gifts, not guarantees.
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Members" value={1} />
        <Stat label="Max gift" value={money(maxGift)} note="Once pledges come in" />
        <Stat label="Waiting period" value={waitingMonths} unit=" mo" note="Started today" />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="title text-[19px] text-ink">Waiting period</h2>
          <span className="text-[13px] font-medium text-ink-3">Day {day} of {waitDays}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(day / waitDays) * 100}%` }} />
        </div>
        <p className="mt-3 text-[15px] text-ink">
          You can ask for help from <b>{askFrom}</b>.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="title text-[19px] text-ink">Request support</h2>
        <ul className="space-y-2">
          {waiting && (
            <li className="flex gap-2 text-[14px] text-ink-2">
              <IconX width={16} height={16} className="mt-0.5 shrink-0 text-rose" />
              New members can ask for help after {waitingMonths} months.
            </li>
          )}
          <li className="flex gap-2 text-[14px] text-ink-2">
            <IconX width={16} height={16} className="mt-0.5 shrink-0 text-rose" />
            Nothing is pledged yet, so there&apos;s nothing to gift.
          </li>
        </ul>
        <button disabled className={`${button} w-full`}>Request support</button>
      </Card>

      <Card>
        <h2 className="title mb-4 text-[19px] text-ink">Members</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl bg-brand-soft px-3 py-2.5 ring-1 ring-brand/30">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">
              {(profile?.name ?? 'Y')[0]}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{profile?.name ?? 'You'} (you)</p>
              <p className="truncate text-[12px] text-ink-3">{profile?.business ?? 'Solo business'} · new</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="text-center">
        <button onClick={onLeave} className="pressable text-[14px] font-semibold text-ink-3 hover:text-rose">Leave group</button>
      </div>
    </>
  );
}

function PoolView() {
  const params = useSearchParams();
  const profile = useProfile();
  const group = useMyGroup();
  const [picked, setPicked] = useState<'mine' | 'sample' | null>(null);

  if (!profile) return <Loading />;
  if (isExampleProfile(profile)) return <SampleGroup />;

  // Coming from a claim with no group of their own: show how the sample group would help.
  const fromClaim = params.get('gap') !== null;
  const view = picked ?? (group || !fromClaim ? 'mine' : 'sample');

  return (
    <>
      <div role="tablist" aria-label="Which group" className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
        {(['mine', 'sample'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setPicked(v)}
            className={`pressable rounded-full py-2.5 text-[14px] font-semibold ${view === v ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(17,19,17,0.12)]' : 'text-ink-2'}`}
          >
            {v === 'mine' ? 'My group' : 'Sample group'}
          </button>
        ))}
      </div>

      {view === 'sample' ? (
        <>
          {fromClaim && !group && (
            <p className="rounded-2xl bg-brand-soft p-4 text-[14px] text-ink">
              You&apos;re not in a group yet, so here&apos;s how the sample group would handle your request.
            </p>
          )}
          <SampleGroup exploring />
        </>
      ) : group ? (
        <OwnGroup group={group} onLeave={() => { leaveGroup(); setPicked('mine'); }} />
      ) : (
        <NoGroup onCreate={() => { createGroup(profile); setPicked('mine'); }} onExplore={() => setPicked('sample')} />
      )}
    </>
  );
}

export default function PoolPage() {
  return (
    <Page eyebrow="Optional add-on" title="Your people, your pool." subtitle="A small group of solo workers who pledge gifts to each other when something goes wrong.">
      <Suspense fallback={<Loading />}>
        <PoolView />
      </Suspense>
    </Page>
  );
}
