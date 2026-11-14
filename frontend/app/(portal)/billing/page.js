'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead, Stat } from '@/components/ui';
import { useShell } from '@/components/Shell';
import { api, download, inr, kg, dTime, dShort, qp, monthLabel } from '@/lib/api';

const VIEWS = [['passbook', 'Passbook'], ['cod', 'COD Remittance'], ['charges', 'Shipping Charges'], ['recharges', 'All Recharges'], ['invoices', 'Invoices'], ['credit_notes', 'Credit Notes'], ['debit_notes', 'Debit Notes'], ['ledger', 'Ledger'], ['notif', 'Notification Credits']];
const first = () => { const d = new Date(); d.setMonth(d.getMonth() - 2); d.setDate(1); return d.toISOString().slice(0, 10); };

export default function Billing() {
  const [view, setView] = useState(null);
  const [range, setRange] = useState({ from: first(), to: new Date().toISOString().slice(0, 10) });
  useEffect(() => { setView(qp('view') || 'passbook'); }, []);
  const go = (v) => { setView(v); history.replaceState(null, '', '/billing/?view=' + v); };
  if (!view) return <Spinner />;
  const label = VIEWS.find((x) => x[0] === view)?.[1];
  return (
    <>
      <PageHead title={label} sub="Billing — passbook, COD, charges, recharges, invoices, credit/debit notes and ledger" />
      <div className="pills mb12" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>{VIEWS.map(([k, l]) => <button key={k} className={'pill' + (view === k ? ' on' : '')} onClick={() => go(k)}>{l}</button>)}</div>
      {['passbook', 'charges', 'recharges', 'credit_notes', 'debit_notes', 'ledger'].includes(view) && (
        <div className="card mb12 row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field"><label>From</label><input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        </div>
      )}
      {['passbook', 'recharges', 'credit_notes', 'debit_notes', 'ledger'].includes(view) && <Ledger view={view} range={range} />}
      {view === 'charges' && <Charges range={range} />}
      {view === 'cod' && <Cod />}
      {view === 'invoices' && <Invoices />}
      {view === 'notif' && <Notif />}
    </>
  );
}

function Ledger({ view, range }) {
  const v = view === 'ledger' ? 'passbook' : view;
  const qs = `view=${v}&from=${range.from}&to=${range.to}`;
  const { data: d, err, reload } = useLoad(() => api('/me/ledger?' + qs), [qs]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const isLedger = view === 'ledger';
  const rows = isLedger ? [...d.items].reverse() : d.items;
  const empty = { recharges: 'No recharges in this period.', credit_notes: 'No credit notes (refunds, COD adjustments, admin credits) in this period.', debit_notes: 'No debit notes (weight discrepancy, RTO, adjustments) in this period.' }[view] || 'No transactions in this period.';
  return (
    <>
      <div className="stats mb12">
        <Stat plain title="Opening balance" value={inr(d.opening, 2)} sub={dShort(d.from)} />
        <Stat plain title="Credits" value={inr(d.credits, 2)} subCls="green" sub={`${d.items.filter((x) => x.type === 'credit').length} entries`} />
        <Stat plain title="Debits" value={inr(d.debits, 2)} subCls="red" sub={`${d.items.filter((x) => x.type === 'debit').length} entries`} />
        <Stat plain title="Closing balance" value={inr(d.closing, 2)} sub={dShort(d.to)} />
      </div>
      <div className="card p0 tbl-wrap">
        <div className="row between" style={{ padding: '12px 16px' }}><b className="small">{rows.length} entries</b><AsyncBtn className="btn btn-outline btn-sm" onClick={() => download(`/me/ledger?view=${v}&from=${range.from}&to=${range.to}&export=1`, `${view}.csv`)}>Download Excel</AsyncBtn></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Particulars</th><th className="hide-sm">Ref</th>{isLedger ? <><th className="num">Debit</th><th className="num">Credit</th></> : <><th>Type</th><th className="num">Amount</th></>}<th className="num">Balance</th></tr></thead>
          <tbody>
            {isLedger && <tr><td>{dShort(d.from)}</td><td className="b">Opening balance</td><td className="hide-sm" /><td /><td /><td className="num b">{inr(d.opening, 2)}</td></tr>}
            {rows.map((t) => (
              <tr key={t.id}><td>{dTime(t.created_at)}</td><td>{t.description}</td><td className="hide-sm small muted">{t.ref}</td>
                {isLedger ? <><td className="num red">{t.type === 'debit' ? inr(t.amount, 2) : ''}</td><td className="num green">{t.type === 'credit' ? inr(t.amount, 2) : ''}</td></>
                  : <><td><Chip s={t.type} label={t.type === 'credit' ? 'Credit' : 'Debit'} /></td><td className="num">{t.type === 'debit' ? '−' : '+'}{inr(t.amount, 2)}</td></>}
                <td className="num">{inr(t.balance_after, 2)}</td></tr>
            ))}
            {isLedger && <tr><td>{dShort(d.to)}</td><td className="b">Closing balance</td><td className="hide-sm" /><td className="num b">{inr(d.debits, 2)}</td><td className="num b">{inr(d.credits, 2)}</td><td className="num b">{inr(d.closing, 2)}</td></tr>}
            {!rows.length && <tr><td colSpan={6} className="empty">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Charges({ range }) {
  const qs = `from=${range.from}&to=${range.to}`;
  const { data: d, err, reload } = useLoad(() => api('/me/shipping-charges?' + qs), [qs]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <div className="card p0 tbl-wrap">
      <div className="row between" style={{ padding: '12px 16px' }}><b className="small">{d.items.length} shipments · total {inr(d.total, 2)}</b><AsyncBtn className="btn btn-outline btn-sm" onClick={() => download('/me/shipping-charges?export=1&' + qs, 'shipping-charges.csv')}>Download Excel</AsyncBtn></div>
      <table className="tbl">
        <thead><tr><th>AWB</th><th>Date</th><th className="hide-sm">Destination</th><th className="hide-sm">Zone</th><th>Chargeable</th><th className="num">Freight</th><th className="num hide-sm">COD</th><th className="num hide-sm">GST</th><th className="num hide-sm">RTO</th><th className="num hide-sm">Weight extra</th><th className="num">Total</th></tr></thead>
        <tbody>
          {d.items.map((s) => <tr key={s.id} className="click" onClick={() => (location.href = '/shipment/?id=' + s.id)}><td className="mono">{s.awb}</td><td>{dShort(s.created_at)}</td><td className="hide-sm">{s.to_city} {s.to_pincode}</td><td className="hide-sm">{s.zone}</td><td>{kg(s.chargeable_weight)}</td>
            <td className="num">{inr(s.freight, 2)}</td><td className="num hide-sm">{+s.cod_charge ? inr(s.cod_charge, 2) : '—'}</td><td className="num hide-sm">{inr(s.gst, 2)}</td><td className="num hide-sm">{+s.rto_charge ? inr(s.rto_charge, 2) : '—'}</td><td className="num hide-sm">{s.weight_charge ? inr(s.weight_charge, 2) : '—'}</td><td className="num b">{inr(s.net, 2)}</td></tr>)}
          {!d.items.length && <tr><td colSpan={11} className="empty">No shipments in this period.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Cod() {
  const { me } = useShell();
  const { data: d, err, reload } = useLoad(() => api('/me/wallet'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <div className="stats mb12">
        <Stat plain icon="rupee" title="COD pending" value={inr(d.cod_pending)} sub={`next remittance ${dShort(d.next_remittance)}`} subCls="orange" />
        <Stat plain icon="check" title="Remitted this month" value={inr(d.cod_remitted_month)} sub={d.bank_last4 ? `to bank ••${d.bank_last4}` : 'add bank in Settings'} />
        <Stat plain icon="clock" title="Remittance cycle" value={<span style={{ fontSize: 18 }}>{me.cod_cycle}</span>} sub={<Link href="/settings/?tab=early-cod" className="link">Get COD faster →</Link>} />
      </div>
      <div className="card p0 tbl-wrap">
        <table className="tbl"><thead><tr><th>Date</th><th>Shipments</th><th>UTR / Ref</th><th className="num">COD collected</th><th className="num">Early COD fee</th><th className="num">Remitted</th></tr></thead>
          <tbody>{d.remittances.map((r) => <tr key={r.id}><td>{dShort(r.remit_date)}</td><td>{r.shipments}</td><td>{r.utr || '—'}</td><td className="num">{inr(r.gross ?? r.amount, 2)}</td><td className="num">{+r.fee ? '−' + inr(r.fee, 2) : '—'}</td><td className="num b">{inr(r.amount, 2)}</td></tr>)}
            {!d.remittances.length && <tr><td colSpan={6} className="empty">No COD remittances yet.</td></tr>}</tbody></table>
      </div>
    </>
  );
}

function Invoices() {
  const { data: d, err, reload } = useLoad(() => api('/me/wallet'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <div className="card p0 tbl-wrap">
      <table className="tbl"><thead><tr><th>Invoice no.</th><th>Period</th><th className="num">Shipments</th><th className="num">Taxable</th><th className="num">GST</th><th className="num">Total</th><th /></tr></thead>
        <tbody>{d.invoices.map((i) => <tr key={i.id}><td className="b">{i.number}</td><td>{monthLabel(i.period)}</td><td className="num">{i.shipments}</td><td className="num">{inr(i.taxable, 2)}</td><td className="num">{inr(i.gst, 2)}</td><td className="num">{inr(i.amount, 2)}</td><td><a className="link small" target="_blank" href={`/invoice/?id=${i.id}`}>Download PDF</a></td></tr>)}
          {!d.invoices.length && <tr><td colSpan={7} className="empty">Monthly GST invoices appear here after month end.</td></tr>}</tbody></table>
    </div>
  );
}

function Notif() {
  const { refresh } = useShell();
  const { data: d, err, reload } = useLoad(() => api('/me/notif-credits'), []);
  const [n, setN] = useState(500);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <div className="split-1-2">
      <div className="card">
        <div className="card-h"><h3>Notification credits</h3></div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{d.balance.toLocaleString('en-IN')}</div>
        <div className="small muted">1 credit = 1 SMS / WhatsApp update to your buyer · ₹{d.price} per credit + GST</div>
        {!d.provider && <div className="note mt12">SMS / WhatsApp sending is not switched on yet by Vishwaship. Credits are used only once it is live.</div>}
        <div className="row mt16"><select className="select" value={n} onChange={(e) => setN(+e.target.value)}>{[100, 500, 1000, 5000].map((x) => <option key={x} value={x}>{x} credits</option>)}</select>
          <AsyncBtn onClick={async () => { await api('/me/notif-credits/buy', { method: 'POST', body: { credits: n } }); toast('Credits added'); reload(); refresh(); }}>Buy · {inr(n * d.price * 1.18, 2)}</AsyncBtn></div>
        <Link href="/settings/?tab=notifications" className="link small mt12" style={{ display: 'block' }}>Choose which updates buyers get →</Link>
      </div>
      <div className="card p0 tbl-wrap">
        <table className="tbl"><thead><tr><th>Date</th><th>Details</th><th className="num">Credits</th><th className="num">Balance</th></tr></thead>
          <tbody>{d.items.map((x) => <tr key={x.id}><td>{dTime(x.created_at)}</td><td>{x.description}</td><td className={'num ' + (x.type === 'credit' ? 'green' : 'red')}>{x.type === 'credit' ? '+' : '−'}{x.credits}</td><td className="num">{x.balance_after}</td></tr>)}
            {!d.items.length && <tr><td colSpan={4} className="empty">No credit history yet.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
