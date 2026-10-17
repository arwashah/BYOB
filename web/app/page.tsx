'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { EXAMPLES } from '@/lib/examples';
import { readDraft, saveDraft, saveProfile, startOver, useSavedProfile } from '@/lib/useProfile';
import { LANGUAGES } from '@/lib/language';
import type { Equipment, Insurance, Profile } from '@/lib/types';
import { Card, MESSAGES, NumberInput, Shell, button, buttonGhost, input, label, money, useRotating } from '@/components/ui';
import { IconArrowRight, IconArrowUp, IconCake, IconCamera, IconCar, IconUpload, IconWrench, IconX } from '@/components/icons';

const EXAMPLE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  maya: IconCake,
  dev: IconCamera,
  priya: IconCar,
};

// Each example's biggest risk, so judges can pick the story they want to see.
const EXAMPLE_RISK: Record<string, string> = {
  maya: 'Oven is 6 years old, only one',
  dev: 'Baby on the way, not on EI',
  priya: 'No business insurance',
};

const STEPS = [
  { title: 'Does this look right?', hint: 'We pulled this from your description. Fix anything that’s off.' },
  { title: 'What do you earn?', hint: 'Upload a year of income, or just give us a rough monthly number.' },
  { title: 'Are you insured?', hint: 'No insurance is fine. BYOB still has your back.' },
];

const INSURANCE: { value: Insurance; title: string; note: string }[] = [
  { value: 'yes', title: 'Yes', note: 'You can upload the policy on the Claim tab and we’ll read it.' },
  { value: 'no', title: 'No', note: 'Your fund and the pool become your backup.' },
  { value: 'not_sure', title: 'Not sure', note: 'We’ll help you check. Home policies often exclude business gear.' },
];

// Pulls the last number on each line of a CSV, e.g. "2025-11,3900" -> 3900
function parseIncomeCsv(text: string): number[] {
  return text
    .split(/\r?\n/)
    .map((line) => Number(line.split(',').pop()?.replace(/[$\s"]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(-12);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [roughMonthly, setRoughMonthly] = useState('');
  const [csvNote, setCsvNote] = useState('');
  const [language, setLanguage] = useState('auto');
  const saved = useSavedProfile();
  const [draft, setDraft] = useState<ReturnType<typeof readDraft>>(null);
  const [dismissed, setDismissed] = useState(false);
  const thinking = useRotating(MESSAGES.profile, loading);

  // Read any half-finished onboarding once, after mount (localStorage is browser-only).
  useEffect(() => {
    const d = readDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d && d.profile) setDraft(d);
  }, []);

  // Save progress after every change past the first step.
  useEffect(() => {
    if (step > 0 && profile) saveDraft({ step, description, profile, roughMonthly });
  }, [step, description, profile, roughMonthly]);

  const update = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p));
  const updateEquipment = (i: number, patch: Partial<Equipment>) =>
    update({ equipment: profile!.equipment.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const pickExample = (key: string) => {
    const ex = EXAMPLES[key];
    setDescription(ex.description);
    setProfile({ ...structuredClone(ex), example: key, language: language === 'auto' ? 'English' : language });
    setRoughMonthly('');
    setCsvNote(`Using ${ex.name}’s last 12 months of invoices.`);
    setStep(1);
  };

  const describe = async () => {
    if (!description.trim() || loading) return;
    setLoading(true);
    const p = await api.profile(description, language);
    setProfile({ ...p, language: language === 'auto' ? p.language ?? 'English' : language });
    setRoughMonthly(String(p.monthlyIncome[0] ?? ''));
    setLoading(false);
    setStep(1);
  };

  const onCsv = async (file: File | undefined) => {
    if (!file) return;
    const months = parseIncomeCsv(await file.text());
    if (months.length === 0) {
      setCsvNote('Couldn’t find any amounts in that file.');
      return;
    }
    update({ monthlyIncome: months });
    setRoughMonthly('');
    setCsvNote(`Read ${months.length} months from ${file.name}.`);
  };

  const finish = () => {
    if (!profile) return;
    const final = roughMonthly ? { ...profile, monthlyIncome: Array(12).fill(Number(roughMonthly)) } : profile;
    saveProfile(final);
    router.push('/gaps');
  };

  const resume = () => {
    if (!draft || !draft.profile) return;
    setDescription(draft.description);
    setProfile(draft.profile);
    setRoughMonthly(draft.roughMonthly);
    setLanguage(draft.profile.language ?? 'auto');
    setStep(draft.step);
  };

  const reset = () => {
    startOver();
    setDraft(null);
    setDismissed(true);
  };

  // A finished profile beats a half-finished one.
  const returning = !dismissed ? (saved ? { name: saved.name, go: () => router.push('/gaps') } : draft?.profile ? { name: draft.profile.name, go: resume } : null) : null;

  if (step === 0 || !profile) {
    return (
      <Shell>
        {returning && (
          <div className="rise mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4">
            <p className="flex-1 text-[15px] text-ink">
              Welcome back. Pick up where you left off{returning.name && returning.name !== 'You' ? ` as ${returning.name}` : ''}?
            </p>
            <div className="flex gap-2">
              <button onClick={reset} className={`${buttonGhost} !px-4 !py-2.5 text-[14px]`}>Start over</button>
              <button onClick={returning.go} className={`${button} !px-4 !py-2.5 text-[14px]`}>
                Continue{returning.name && returning.name !== 'You' ? ` as ${returning.name}` : ''}
              </button>
            </div>
          </div>
        )}
        <section className="rise pt-2 sm:pt-8">
          <h1 className="display text-[2.6rem] text-ink sm:text-[4.75rem]">
            Get the benefits <br className="hidden sm:block" />
            of an employer.
            <span className="mt-1 block text-brand">
              Even when you’re <span className="whitespace-nowrap">the boss.</span>
            </span>
          </h1>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            describe();
          }}
          className="rise mt-10 rounded-2xl border border-line bg-surface p-2 shadow-[0_12px_40px_rgba(17,19,17,0.08)] focus-within:border-brand/60"
        >
          <label htmlFor="describe" className="sr-only">Describe your business</label>
          <textarea
            id="describe"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                describe();
              }
            }}
            placeholder="Tell us about your business like you’d tell a friend. What you do, roughly what you earn, the gear you rely on, and any benefits you have."
            className="block w-full resize-none bg-transparent px-4 pt-3 text-[17px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-1">
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3" aria-live="polite">
              {loading ? (
                <span className="font-medium text-brand">{thinking}</span>
              ) : (
                <>
                  <label htmlFor="language" className="sr-only">Language for your answers</label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="cursor-pointer rounded-full border border-line bg-surface py-1 pr-2 pl-2.5 text-[13px] text-ink-2 hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <span className="hidden sm:inline">Enter to send</span>
                </>
              )}
            </span>
            <button
              type="submit"
              disabled={!description.trim() || loading}
              aria-label="Build my profile"
              className="pressable grid h-11 w-11 place-items-center rounded-full bg-brand text-white hover:bg-brand-strong disabled:bg-sunken disabled:text-ink-3"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <IconArrowUp width={20} height={20} />}
            </button>
          </div>
        </form>

        <section className="rise mt-10">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-2">Or start from an example</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(EXAMPLES).map(([key, ex]) => {
              const Icon = EXAMPLE_ICONS[key] ?? IconWrench;
              const yearly = ex.monthlyIncome.reduce((a, b) => a + b, 0);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickExample(key)}
                  className="pressable group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left hover:border-brand/50 sm:flex-col sm:items-start sm:gap-6 sm:p-5"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line text-brand">
                    <Icon width={24} height={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="title block text-[17px] text-ink">{ex.name}</span>
                    <span className="block text-[14px] text-ink-2">{ex.business}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-3">
                      {ex.city} · ${Math.round(yearly / 1000)}k/yr
                    </span>
                    {EXAMPLE_RISK[key] && (
                      <span className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-rose">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                        {EXAMPLE_RISK[key]}
                      </span>
                    )}
                  </span>
                  <IconArrowRight width={18} height={18} className="shrink-0 text-ink-3 group-hover:text-brand sm:hidden" />
                </button>
              );
            })}
          </div>
        </section>
      </Shell>
    );
  }

  const s = STEPS[step - 1];
  const avg = profile.monthlyIncome.reduce((a, b) => a + b, 0) / Math.max(profile.monthlyIncome.length, 1);
  const maxMonth = Math.max(...profile.monthlyIncome, 1);

  return (
    <Shell>
      <div className="rise mb-8" key={step}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-brand' : 'bg-line'}`} />
            ))}
          </div>
          <span className="text-[13px] font-medium text-ink-3">{step} of 3</span>
        </div>
        <h1 className="display text-[2.75rem] text-ink sm:text-[3.75rem]">{s.title}</h1>
        <p className="mt-3 text-[17px] text-ink-2">{s.hint}</p>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          {profile.equipment.map((e, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2">
                  <IconWrench width={20} height={20} />
                </span>
                <input
                  aria-label="Equipment name"
                  placeholder="e.g. Oven"
                  className="title min-w-0 flex-1 bg-transparent text-[17px] text-ink placeholder:text-ink-3 focus:outline-none"
                  value={e.name}
                  onChange={(ev) => updateEquipment(i, { name: ev.target.value })}
                />
                <button
                  onClick={() => update({ equipment: profile.equipment.filter((_, j) => j !== i) })}
                  className="pressable grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-rose"
                  aria-label={`Remove ${e.name || 'item'}`}
                >
                  <IconX width={16} height={16} />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>Age (yrs)</label>
                  <NumberInput min={0} value={e.ageYears} onValue={(n) => updateEquipment(i, { ageYears: n })} />
                </div>
                <div>
                  <label className={label}>Repairs</label>
                  <NumberInput min={0} value={e.repairs} onValue={(n) => updateEquipment(i, { repairs: n })} />
                </div>
                <div>
                  <label className={label}>To replace</label>
                  <NumberInput min={0} value={e.replacementCost} onValue={(n) => updateEquipment(i, { replacementCost: n })} />
                </div>
              </div>
              <label className="mt-4 flex items-center justify-between gap-3 text-[15px] text-ink">
                It’s my only one
                <Toggle checked={e.isOnlyOne} onChange={(v) => updateEquipment(i, { isOnlyOne: v })} />
              </label>
            </Card>
          ))}
          <button
            onClick={() => update({ equipment: [...profile.equipment, { name: '', ageYears: 0, repairs: 0, replacementCost: 0, isOnlyOne: true }] })}
            className="pressable w-full rounded-2xl border border-dashed border-line py-4 text-[15px] font-semibold text-brand hover:bg-surface"
          >
            + Add equipment
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Card>
            <label className="pressable flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line p-4 hover:border-brand/60">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line text-brand">
                <IconUpload width={24} height={24} />
              </span>
              <span className="flex-1">
                <span className="title block text-[17px] text-ink">Upload income CSV</span>
                <span className="block text-[14px] text-ink-2">{csvNote || 'One row per month, amount in the last column'}</span>
              </span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onCsv(e.target.files?.[0])} />
            </label>

            {!roughMonthly && profile.monthlyIncome.length > 1 && (
              <div className="mt-5">
                <div className="flex h-16 items-end gap-1">
                  {profile.monthlyIncome.map((m, i) => (
                    <div key={i} className="flex-1 rounded-t bg-brand/70" style={{ height: `${(m / maxMonth) * 100}%` }} />
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-ink-3">Average {money(avg)} a month</p>
              </div>
            )}
          </Card>

          <div className="flex items-center gap-3 px-2 text-[13px] text-ink-3">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <Card>
            <label className={label} htmlFor="rough">Rough monthly income</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">$</span>
              <input id="rough" type="number" min={0} placeholder="5,000" className={`${input} pl-8`} value={roughMonthly} onChange={(e) => setRoughMonthly(e.target.value)} />
            </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Do you have business insurance?">
            {INSURANCE.map((o) => {
              const on = profile.insurance === o.value;
              return (
                <button
                  key={o.value}
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ insurance: o.value })}
                  className={`pressable rounded-2xl border p-5 text-left ${on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand/40'}`}
                >
                  <span className={`title block text-[19px] ${on ? 'text-brand' : 'text-ink'}`}>{o.title}</span>
                  <span className="mt-1 block text-[14px] text-ink-2">{o.note}</span>
                </button>
              );
            })}
          </div>
          <Card className="divide-y divide-line !py-1">
            <label className="flex items-center justify-between gap-3 py-4 text-[15px] text-ink">
              I have a health or dental plan
              <Toggle checked={profile.hasHealthPlan} onChange={(v) => update({ hasHealthPlan: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 py-4 text-[15px] text-ink">
              A baby or caregiving is coming this year
              <Toggle checked={profile.lifeEvents.length > 0} onChange={(v) => update({ lifeEvents: v ? ['baby'] : [] })} />
            </label>
          </Card>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <button onClick={() => setStep(step - 1)} className={buttonGhost}>Back</button>
        <button onClick={step < 3 ? () => setStep(step + 1) : finish} className={`${button} flex-1 sm:flex-none`}>
          {step < 3 ? 'Continue' : 'Find my gaps'}
          <IconArrowRight width={18} height={18} />
        </button>
      </div>
    </Shell>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-sage' : 'bg-line'}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.3,1.2,0.5,1)] motion-reduce:transition-none ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}
