'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Pool, PoolRequestResult } from '@/lib/types';
import { Card, Loading, Page, Stat, button, input, label, money } from '@/components/ui';

function PoolView() {
  const params = useSearchParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [amount, setAmount] = useState(Number(params.get('amount')) || 1000);
  const [monthsInGroup, setMonthsInGroup] = useState(8);
  const [whatIf, setWhatIf] = useState(3);
  const [result, setResult] = useState<PoolRequestResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.pool().then(setPool);
  }, []);

  if (!pool) return <Loading />;

  const capacity = pool.members.length * pool.pledgePerMember;
  // "What if" check: can the group survive several claims at once?
  const needed = whatIf * pool.maxGiftPerClaim;
  const perClaim = Math.min(pool.maxGiftPerClaim, capacity / whatIf);
  const perMember = needed / pool.members.length;
  const healthy = needed <= capacity;

  const request = async () => {
    setSending(true);
    setResult(await api.poolRequest(amount, monthsInGroup));
    setSending(false);
  };

  return (
    <>
      <Card className="!bg-brand !border-brand text-white">
        <p className="text-[13px] font-semibold text-white/80">{pool.groupName}</p>
        <p className="display mt-2 text-[2rem] sm:text-[2.5rem]">
          Your group has pledged up to {money(Math.min(pool.maxGiftPerClaim, capacity))}
        </p>
        <p className="mt-3 text-[14px] text-white/80">
          BYOB never holds money. Members keep their share in their own savings and send a gift if someone needs it. Gifts, not guarantees.
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Members" value={pool.members.length} />
        <Stat label="Max gift" value={money(pool.maxGiftPerClaim)} note={`Up to ${pool.maxMonths} months`} />
        <Stat label="Waiting period" value={pool.waitingMonths} unit=" mo" note="For new members" />
      </div>

      <Card className="space-y-4">
        <h2 className="title text-[19px] text-ink">Request support</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Amount needed ($)</label>
            <input type="number" min={0} className={input} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Months you&apos;ve been in the group</label>
            <input type="number" min={0} className={input} value={monthsInGroup} onChange={(e) => setMonthsInGroup(Number(e.target.value))} />
          </div>
        </div>
        <button onClick={request} disabled={sending} className={`${button} w-full`}>
          {sending ? 'Asking your group…' : 'Request support'}
        </button>
        {result && (
          <div className={`rise rounded-2xl p-4 text-[15px] font-medium ${result.approved ? 'bg-sage-soft text-sage' : 'bg-honey-soft text-honey'}`}>
            {result.message}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="title text-[19px] text-ink">What if several people claim at once?</h2>
        <input type="range" min={1} max={10} value={whatIf} onChange={(e) => setWhatIf(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
        <p className="text-[15px] text-ink-2">
          With <b>{whatIf}</b> claim{whatIf > 1 ? 's' : ''} at once, each member would gift about <b>{money(perMember)}</b> and each claim gets{' '}
          <b>{money(perClaim)}</b>.
        </p>
        <p className={`text-[15px] font-semibold ${healthy ? 'text-sage' : 'text-rose'}`}>
          {healthy ? '✓ The group can cover this.' : '⚠ Gifts would be reduced. Pledges max out at ' + money(capacity) + '.'}
        </p>
      </Card>

      <Card>
        <h2 className="title mb-4 text-[19px] text-ink">Members</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pool.members.map((m) => (
            <div key={m.name} className="flex items-center gap-3 rounded-2xl bg-sunken px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand">{m.name[0]}</span>
              <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{m.name}</p>
              <p className="truncate text-[12px] text-ink-3">{m.trade} · {m.monthsInGroup} mo</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
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
