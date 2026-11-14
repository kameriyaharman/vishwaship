'use client';
import { useState } from 'react';
import { Stat, Chip, Spinner, ErrorBox, toast, useLoad } from '@/components/ui';
import { useShell } from '@/components/Shell';
import { api, inr, dTime, dShort, monthLabel } from '@/lib/api';

function loadRazorpay() {
  return new Promise((res) => {
    if (window.Razorpay) return res(true);
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
  });
}

export default function Wallet() {
  const { refresh } = useShell();
  const { data: d, err, reload } = useLoad(() => api('/me/wallet'), []);
  const [amt, setAmt] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('txns');
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;

  const pay = async () => {
    setBusy(true);
    try {
      const r = await api('/me/wallet/recharge', { method: 'POST', body: { amount: +amt } });
      if (r.mode === 'test') { toast(`${inr(amt)} added to wallet`); reload(); refresh(); return; }
      if (!(await loadRazorpay())) throw new Error('Could not load payment page');
      new window.Razorpay({
        key: r.key, order_id: r.order_id, amount: Math.round(r.amount * 100), currency: 'INR', name: 'Vishwaship', description: 'Wallet recharge',
        prefill: { name: r.name, email: r.email, contact: r.contact }, theme: { color: '#f26b1d' },
        handler: async (resp) => { try { await api('/me/wallet/verify', { method: 'POST', body: resp }); toast('Payment successful — wallet recharged'); reload(); refresh(); } catch (e) { toast(e.message, true); } },
      }).open();
    } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="ph"><div><h1>Wallet, COD Remittance & Invoices</h1><p>Prepaid wallet for booking · COD money settlement · monthly GST invoice</p></div>
        <a href="#recharge" className="btn btn-orange">+ Recharge wallet</a></div>
      <div className="stats">
        <Stat plain icon="wallet" title="Wallet balance" value={inr(d.balance, 2)} sub={+d.credit_limit ? `credit limit ${inr(d.credit_limit)}` : 'prepaid'} subCls="green" />
        <Stat plain icon="rupee" title="COD pending" value={inr(d.cod_pending)} sub={`next remittance ${dShort(d.next_remittance)}`} subCls="orange" />
        <Stat plain icon="check" title="COD remitted (this month)" value={inr(d.cod_remitted_month)} sub={d.bank_last4 ? `to bank ••${d.bank_last4}` : 'add bank in Settings'} subCls="green" />
        <Stat plain icon="chart" title="Spent (this month)" value={inr(d.spent_month, 2)} sub={`${d.shipments_month} shipments`} />
      </div>
      <div className="split-2-1 mt16">
        <div className="card">
          <div className="seg mb12"><button className={tab === 'txns' ? 'on' : ''} onClick={() => setTab('txns')}>Wallet transactions</button><button className={tab === 'cod' ? 'on' : ''} onClick={() => setTab('cod')}>COD remittances</button></div>
          <div className="tbl-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
            {tab === 'txns' ? (
              <table className="tbl">
                <thead><tr><th>Date</th><th>Description</th><th>Type</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
                <tbody>
                  {d.txns.map((t) => <tr key={t.id}><td>{dTime(t.created_at)}</td><td>{t.description}</td><td><Chip s={t.type} /></td><td className="num">{t.type === 'debit' ? '−' : '+'}{inr(t.amount, 2)}</td><td className="num">{inr(t.balance_after, 2)}</td></tr>)}
                  {!d.txns.length && <tr><td colSpan={5} className="empty">No transactions yet.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="tbl">
                <thead><tr><th>Date</th><th>Shipments</th><th>UTR / Ref</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {d.remittances.map((r) => <tr key={r.id}><td>{dShort(r.remit_date)}</td><td>{r.shipments}</td><td>{r.utr || '—'}</td><td className="num">{inr(r.amount, 2)}</td></tr>)}
                  {!d.remittances.length && <tr><td colSpan={4} className="empty">No COD remittances yet.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card" id="recharge">
            <div className="card-h"><h3>Recharge</h3></div>
            <div className="pills">{[1000, 2000, 5000, 10000].map((v) => <button key={v} className={'pill' + (+amt === v ? ' on' : '')} onClick={() => setAmt(v)}>{inr(v)}</button>)}</div>
            <div className="field mt12"><label>Amount</label><input className="input" type="number" min={d.min_recharge} value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
            <button className="btn btn-orange btn-block mt12" disabled={busy || +amt < d.min_recharge} onClick={pay}>{busy ? 'Please wait…' : 'Pay via UPI / card / netbanking'}</button>
            {d.gateway !== 'razorpay' && <div className="tiny muted mt8">Test mode: amount is added instantly. Admin can connect Razorpay for live payments.</div>}
          </div>
          <div className="card">
            <div className="card-h"><h3>GST invoices</h3></div>
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Period</th><th className="num">Amount</th><th></th></tr></thead>
              <tbody>
                {d.invoices.map((i) => <tr key={i.id}><td>{i.number}</td><td>{monthLabel(i.period)}</td><td className="num">{inr(i.amount)}</td><td><a className="link small" href={`/invoice/?id=${i.id}`} target="_blank">PDF</a></td></tr>)}
                {!d.invoices.length && <tr><td colSpan={4} className="empty small">Invoices appear here after month end.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
