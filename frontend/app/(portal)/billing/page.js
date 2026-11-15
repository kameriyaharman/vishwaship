'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead, Stat, Modal } from '@/components/ui';
import Icon from '@/components/Icon';
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
      {['passbook', 'recharges', 'credit_notes', 'debit_notes', 'ledger'].includes(view) && (
        <div className="card mb12 row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field"><label>From</label><input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        </div>
      )}
      {['passbook', 'recharges', 'credit_notes', 'debit_notes', 'ledger'].includes(view) && <Ledger view={view} range={range} />}
      {view === 'charges' && <Charges range={range} setRange={setRange} />}
      {view === 'cod' && <Cod range={range} setRange={setRange} />}
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

function Filters({ range, setRange, fields, vals, setVals, onDownload, onRefresh }) {
  return (
    <div className="card mb12 row wrap" style={{ alignItems: 'flex-end', gap: 10 }}>
      <div className="field"><label>From</label><input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
      <div className="field"><label>To</label><input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      {fields.map(([k, l]) => <div key={k} className="field" style={{ flex: '1 1 150px' }}><label>{l}</label><input className="input" placeholder={`Search by ${l.toLowerCase()}`} value={vals[k] || ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></div>)}
      <span className="row" style={{ gap: 6 }}>
        <AsyncBtn className="icon-btn" title="Download" onClick={onDownload} style={{ width: 42, height: 42 }}><Icon name="download" /></AsyncBtn>
        <button className="icon-btn" title="Refresh" onClick={onRefresh} style={{ width: 42, height: 42 }}><Icon name="undo" style={{ transform: 'scaleX(-1)' }} /></button>
      </span>
    </div>
  );
}
function useDebounced(v, ms = 400) { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; }

function Charges({ range, setRange }) {
  const [vals, setVals] = useState({ order: '', awb: '', order_ref: '' });
  const dv = useDebounced(vals);
  const [bd, setBd] = useState(null);
  const qs = new URLSearchParams({ from: range.from, to: range.to, ...Object.fromEntries(Object.entries(dv).filter(([, v]) => v)) }).toString();
  const { data: d, err, reload, loading } = useLoad(() => api('/me/shipping-charges?' + qs), [qs]);
  const W = (w) => w.weight == null ? <span className="muted">Awaited</span> : <>{w.weight} kg<div className="tiny muted">{w.dims ? `${w.dims} cm` : '—'}{w.vol != null ? ` · vol ${w.vol} kg` : ''}</div>{w.charged != null && <div className="tiny">Charged on {w.charged} kg</div>}</>;
  return (
    <>
      <Filters range={range} setRange={setRange} fields={[['order', 'Order ID'], ['awb', 'AWB'], ['order_ref', 'Order Reference ID']]} vals={vals} setVals={setVals}
        onDownload={() => download('/me/shipping-charges?export=1&' + qs, 'shipping-charges.csv')} onRefresh={reload} />
      <ErrorBox err={err} onRetry={reload} />
      <div className="card p0 tbl-wrap">
        {!d ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Order Date</th><th>ID & Type</th><th>Tracking Info</th><th>Payment</th><th>Entered Weight & Dims.</th><th>Courier Weight & Dims.</th><th className="num">Entered Weight Charges</th><th className="num">Courier Weight Charges</th></tr></thead>
            <tbody>
              {d.items.map((r) => (
                <tr key={r.id} style={loading ? { opacity: .5 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dTime(r.created_at)}</td>
                  <td><Link className="b link-navy" href={'/shipment/?id=' + r.id}>#{r.order_no}</Link>{r.order_ref && <div className="tiny muted">Ref {r.order_ref}</div>}<div className="tiny">{r.type}</div></td>
                  <td><div className="small b">{r.courier}</div><div className="mono small">{r.awb}</div><div className="tiny muted">{r.status}</div></td>
                  <td className="small">{inr(r.invoice_value)}<div><span className={'chip c-' + r.payment_mode}>{r.payment_mode === 'cod' ? 'COD' : r.payment_mode === 'topay' ? 'To Pay' : 'Prepaid'}</span></div>{r.payment_mode === 'cod' && <div className="tiny">COD {inr(r.cod_amount)}</div>}</td>
                  <td className="small">{W(r.entered)}</td>
                  <td className="small">{W(r.courier_w)}</td>
                  <td className="num b">{inr(r.entered_charges, 2)} <button className="link-navy" title="Charge breakdown" onClick={() => setBd(r)}><Icon name="alert" size={13} /></button></td>
                  <td className={'num b' + (r.courier_charges > r.entered_charges ? ' red' : '')}>{r.courier_charges == null ? <span className="muted small">Awaited</span> : inr(r.courier_charges, 2)}</td>
                </tr>
              ))}
              {!d.items.length && <tr><td colSpan={8} className="empty">No shipments for these filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {d && <div className="small mt8 right muted">{d.items.length} shipments · total charged {inr(d.total, 2)}</div>}
      {bd && (
        <Modal title={`Charge breakdown · #${bd.order_no}`} onClose={() => setBd(null)}>
          <div className="kv"><span>Freight ({bd.courier}, {bd.entered.charged} kg)</span><b>{inr(bd.breakdown.freight, 2)}</b></div>
          <div className="kv"><span>COD charges</span><b>{bd.breakdown.cod_charge ? inr(bd.breakdown.cod_charge, 2) : '—'}</b></div>
          <div className="kv"><span>GST {bd.breakdown.gst_pct}%</span><b>{inr(bd.breakdown.gst, 2)}</b></div>
          <div className="kv"><span>Booking total</span><b>{inr(bd.breakdown.total, 2)}</b></div>
          {bd.breakdown.weight_extra > 0 && <div className="kv"><span>Weight discrepancy ({bd.breakdown.weight_extra_status})</span><b className="red">+{inr(bd.breakdown.weight_extra, 2)} + GST</b></div>}
          {bd.breakdown.rto_charge > 0 && <div className="kv"><span>RTO charges</span><b className="red">{inr(bd.breakdown.rto_charge, 2)}</b></div>}
          <div className="kv" style={{ fontSize: 15 }}><span>Total charged</span><b>{inr(bd.breakdown.grand_total, 2)}</b></div>
        </Modal>
      )}
    </>
  );
}

function Cod({ range, setRange }) {
  const [vals, setVals] = useState({ ref: '', utr: '' });
  const dv = useDebounced(vals);
  const qs = new URLSearchParams({ from: range.from, to: range.to, ...Object.fromEntries(Object.entries(dv).filter(([, v]) => v)) }).toString();
  const { data: d, err, reload, loading } = useLoad(() => api('/me/cod-remittances?' + qs), [qs]);
  const sm = d?.summary;
  return (
    <>
      {sm && (
        <div className="stats mb12">
          <Stat plain icon="rupee" title="Total Generated" value={inr(sm.total_generated)} sub="all COD collected" />
          <Stat plain icon="check" title="Total Paid" value={inr(sm.total_paid)} sub="bank + wallet" subCls="green" />
          <Stat plain icon="clock" title="Next Remittance" value={inr(sm.next_amount)} sub={`on ${dShort(sm.next_date)}`} subCls="orange" />
          <Stat plain icon="wallet" title="Total Due" value={inr(sm.total_due)} sub={<Link href="/settings/?tab=early-cod" className="link">Get COD faster →</Link>} />
        </div>
      )}
      <Filters range={range} setRange={setRange} fields={[['ref', 'Reference ID'], ['utr', 'Bank Transaction ID']]} vals={vals} setVals={setVals}
        onDownload={() => download('/me/cod-remittances?export=1&' + qs, 'cod-remittance-report.csv')} onRefresh={reload} />
      <ErrorBox err={err} onRetry={reload} />
      <div className="card p0 tbl-wrap">
        {!d ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Generated Date</th><th>Ref ID</th><th className="num">Generated COD</th><th className="num">ECOD Charge</th><th className="num">Wallet Used</th><th className="num">Net COD Amount</th><th className="num">Amount Paid</th><th>Payment Date</th><th>Bank Transaction ID</th><th>Orders</th><th>Status</th></tr></thead>
            <tbody>
              {d.items.map((r) => (
                <tr key={r.id} style={loading ? { opacity: .5 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dShort(r.generated_at)}</td><td className="mono small">{r.ref_no}</td><td className="num">{inr(r.generated, 2)}</td>
                  <td className="num">{r.ecod ? '−' + inr(r.ecod, 2) : '—'}</td><td className="num">{r.wallet_used ? inr(r.wallet_used, 2) : '—'}</td><td className="num b">{inr(r.net, 2)}</td>
                  <td className="num">{inr(r.paid, 2)}</td><td>{r.paid_at ? dShort(r.paid_at) : '—'}</td><td className="mono small">{r.utr || '—'}</td>
                  <td><AsyncBtn className="link small" title="Download order list" onClick={() => download(`/me/cod-remittances/${r.id}/orders`, `${r.ref_no}-orders.csv`)}>{r.orders} <Icon name="download" size={12} /></AsyncBtn></td>
                  <td><Chip s={r.status === 'Pending' ? 'pending' : 'success'} label={r.status} /></td>
                </tr>
              ))}
              {!d.items.length && <tr><td colSpan={11} className="empty">No COD remittances for these filters.</td></tr>}
            </tbody>
          </table>
        )}
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
