'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Gift, RotateCcw, ShieldAlert } from 'lucide-react';

type Tier = 'BASIC' | 'PRO';
type Status = 'SUCCESS' | 'FAILED' | 'CANCELLED';
type RecordItem = { sequence: number; tier: Tier; status: Status; amount: number; kind: 'CHECKOUT' | 'GIFT'; at: string };
const peso = (v: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v);

export function SubscriptionDemo() {
  const [tier, setTier] = useState<Tier>('BASIC');
  const [amountText, setAmountText] = useState('100');
  const [org, setOrg] = useState('Demo Organization');
  const [step, setStep] = useState<'select' | 'checkout' | 'result'>('select');
  const [items, setItems] = useState<RecordItem[]>([]);
  const amount = Number(amountText);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(amountText.trim()) && Number.isFinite(amount) && amount > 0 && amount <= 1000000;
  const record = (status: Status, kind: RecordItem['kind'] = 'CHECKOUT') => {
    setItems(previous => [{ sequence: (previous[0]?.sequence ?? 0) + 1, tier: kind === 'GIFT' ? 'PRO' : tier, status, amount: kind === 'GIFT' ? 0 : amount, kind, at: new Date().toLocaleString('en-PH', { timeZone:'Asia/Manila' }) }, ...previous].slice(0, 20));
    setStep('result');
  };
  const last = items[0];

  return <div className="platform-section-gap">
    <Link href="/platform" className="platform-page-back"><ArrowLeft size={15}/> Back to overview</Link>
    <div className="platform-page-heading">
      <div><p className="platform-eyebrow">WorkPulse / SaaS</p><h1 className="platform-title">Subscription Payment Demo</h1>
      <p className="platform-description">Demonstrate Basic and Pro checkout outcomes as many times as needed, without a payment gateway or real charges.</p></div>
      <span className="rounded-lg bg-[#faeae5] px-3 py-2 text-xs font-bold text-[#7a0000]">SIMULATION ONLY</span>
    </div>
    <section role="note" className="platform-muted-box flex items-start gap-3">
      <ShieldAlert size={19} className="shrink-0 text-[#7a0000]"/>
      <span><strong>No real payment or subscription activation.</strong> This demo never requests card details, sends money, creates an invoice, or updates SAGA or any organization's records. The sample ₱100 amount is not your final subscription pricing.</span>
    </section>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.7fr)]">
      <section className="platform-card overflow-hidden">
        <div className="platform-card-header"><div><h2 className="platform-card-title">Interactive Checkout</h2><p className="platform-card-description">Choose plan · Simulate checkout · Review result</p></div><span className="text-xs text-[#7a0000]">{step === 'select' ? '1 / 3' : step === 'checkout' ? '2 / 3' : '3 / 3'}</span></div>
        <div className="space-y-5 border-t border-[#eee2dc] p-6">
          {step === 'select' && <>
            <h3 className="text-sm font-bold">1. Select a subscription plan</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['BASIC','PRO'] as Tier[]).map(option =>
                <button type="button" key={option} aria-pressed={tier === option} onClick={() => setTier(option)}
                  className={'rounded-xl border p-5 text-left ' + (tier === option ? 'border-[#7a0000] bg-[#fff4ef] ring-1 ring-[#7a0000]' : 'border-[#e8ddd5] bg-white')}>
                  <span className="text-lg font-bold">{option === 'BASIC' ? 'Basic' : 'Pro'}</span>
                  <p className="mt-2 text-xs text-[#687783]">{option === 'BASIC' ? 'Core HR services' : 'Additional HR capabilities and integrations'}</p>
                  <p className="mt-3 text-xs font-semibold text-[#7a0000]">Pricing to be finalized</p>
                </button>)}
            </div>
            <label className="wp-label">Demo organization (not a real tenant)
              <input className="wp-input mt-2" maxLength={60} value={org} onChange={e => setOrg(e.target.value)} />
            </label>
            <label className="wp-label">Illustrative amount (PHP)
              <input className="wp-input mt-2" inputMode="decimal" value={amountText} onChange={e => setAmountText(e.target.value)}/>
            </label>
            <p className="text-xs text-[#697783]">You can change the demo amount after deciding your Basic and Pro pricing. It is not charged or saved.</p>
            <button type="button" className="wp-button-primary inline-flex items-center gap-2" disabled={!valid || !org.trim()} onClick={() => setStep('checkout')}>Continue to demo checkout <ArrowRight size={16}/></button>
            {!valid && <p role="alert" className="text-xs text-[#9b1717]">Enter a sample amount greater than ₱0 and at most ₱1,000,000.</p>}
          </>}
          {step === 'checkout' && <>
            <h3 className="text-sm font-bold">2. Simulated checkout</h3>
            <div className="rounded-xl bg-[#faf6f2] p-5 text-sm">
              <p className="text-xs text-[#71808b]">Demo organization</p><p className="mt-1 font-bold">{org.trim()}</p>
              <p className="mt-4 text-xs text-[#71808b]">Selected plan</p><p className="mt-1 font-bold">{tier === 'BASIC' ? 'Basic' : 'Pro'}</p>
              <div className="mt-5 flex justify-between border-t border-[#ebded7] pt-4"><span>Simulation amount</span><strong>{peso(amount)}</strong></div>
            </div>
            <p className="text-xs text-[#687783]">Choose an outcome. These buttons do not contact a payment provider.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" className="rounded-xl border border-[#bbd4bb] bg-[#f1f8f1] p-4 text-sm font-bold text-[#276b3e]" onClick={() => record('SUCCESS')}>Success</button>
              <button type="button" className="rounded-xl border border-[#eac9a8] bg-[#fff6ec] p-4 text-sm font-bold text-[#90561f]" onClick={() => record('FAILED')}>Failed</button>
              <button type="button" className="rounded-xl border border-[#e1d9d4] bg-[#f8f6f4] p-4 text-sm font-bold text-[#5f6670]" onClick={() => record('CANCELLED')}>Cancelled</button>
            </div>
            <button type="button" className="wp-button-secondary" onClick={() => setStep('select')}>Edit selected plan</button>
          </>}
          {step === 'result' && last && <>
            <h3 className="text-sm font-bold">3. Demo outcome</h3>
            <div role="status" className="rounded-xl border border-[#eadbd2] bg-[#fcf7f2] p-5">
              <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={19} className="text-[#7a0000]"/>{last.kind === 'GIFT' ? 'Complimentary Pro demo' : 'Simulated payment: ' + last.status}</p>
              <p className="mt-3 text-sm">Plan: <strong>{last.tier === 'BASIC' ? 'Basic' : 'Pro'}</strong></p>
              <p className="mt-1 text-sm">Illustrative amount: <strong>{peso(last.amount)}</strong></p>
              <p className="mt-1 text-sm">Reference: <strong>DEMO-{String(last.sequence).padStart(4,'0')}</strong></p>
              <p className="mt-3 text-xs leading-6 text-[#687783]">{last.kind === 'GIFT' ? 'This previews a complimentary two-year SAGA Pro benefit. No SAGA subscription record has been created.' : last.status === 'SUCCESS' ? 'A real system would activate only after independently verified payment. This demo does not activate anything.' : 'A real system would not activate a subscription for an unsuccessful or cancelled checkout. No access was changed.'}</p>
            </div>
            <button type="button" className="wp-button-primary inline-flex items-center gap-2" onClick={() => setStep('select')}><RotateCcw size={16}/> Run another simulation</button>
          </>}
        </div>
      </section>
      <aside className="space-y-5">
        <section className="platform-card p-5">
          <div className="flex items-center gap-2"><Gift size={19} className="text-[#7a0000]"/><h2 className="platform-card-title">SAGA · Pilot Pro</h2></div>
          <p className="mt-3 text-2xl font-bold">₱0.00</p>
          <p className="mt-2 text-xs leading-6 text-[#687783]">Proposed complimentary Pro for two years. Preview only; no payment or account changes.</p>
          <button type="button" className="wp-button-secondary mt-4 w-full" onClick={() => record('SUCCESS','GIFT')}>Simulate complimentary Pro</button>
        </section>
        <section className="platform-card p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="platform-card-title">Demo history</h2><button type="button" className="text-xs font-semibold text-[#7a0000] underline" onClick={() => {setItems([]);setStep('select');}}>Clear</button></div>
          <p className="mt-1 text-xs text-[#687783]">Temporary browser history only; not real transaction records.</p>
          {items.length === 0 ? <p className="mt-4 text-xs text-[#687783]">No simulated payments yet.</p> :
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{items.map(item => <div key={item.sequence} className="rounded-lg border border-[#e9ddd5] p-3">
              <div className="flex justify-between gap-2 text-xs font-bold"><span>{item.kind === 'GIFT' ? 'Complimentary' : item.tier}</span><span>{item.status}</span></div>
              <p className="mt-1 text-xs">{peso(item.amount)} · DEMO-{String(item.sequence).padStart(4,'0')}</p><p className="mt-1 text-[10px] text-[#71808b]">{item.at}</p>
            </div>)}</div>}
        </section>
      </aside>
    </div>
  </div>;
}
