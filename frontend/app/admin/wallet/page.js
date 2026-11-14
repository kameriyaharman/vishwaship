'use client';
import { useState } from 'react';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead, Stat } from '@/components/ui';
import { api, inr, dShort, dTime, monthLabel, months } from '@/lib/api';

export default function WalletCod() {
  const { data: d, err, reload } = useLoad(() => api('/admin/cod'), []);
  const [tab, setTab] = useState('cod');
  const [remit, setRemit] = useState(null);
  const [period, setPeriod] = useState(months(3)[1]);
  const [next, setNext] = useState('');
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const pend = d.pending.reduce((t, r) => t + +r.collected, 0);
  return (
    <>
      <PageHead title="Wallet & COD" sub="COD collected → received from Delhivery → remitted to customer · wallet ledger · GST invoices" />
      <div className="stats">
        <Stat plain icon="rupee" title="COD to remit" value={inr(pend)} sub={`${d.pending.length} customers`} subCls="orange" />
        <Stat plain icon="clock" title="Next remittance date" value={dShort(d.next_remittance)} sub={<span className="row" style={{ gap: 4 }}><input type="date" className="input" style={{ minHeight: 26, padding: '2px 6px', width: 130 }} value={next} onChange={(e) => setNext(e.target.value)} /><AsyncBtn className="link small" disabled={!next} onClick={async () => { await api('/admin/cod/settings', { method: 'PUT', body: { next_remittance: next } }); toast('Updated'); reload(); }}>Set</AsyncBtn></span>} />
        <Stat plain icon="wallet" title="Total customer wallet balance" value={inr(d.wallet_total)} sub="prepaid liability" />
        <Stat plain icon="file" title="Invoices" value={d.invoices.length} sub="generated" />
      </div>
      <div className="seg mt16 mb12">{[['cod', 'COD remittance'], ['ledger', 'Wallet ledger'], ['inv', 'GST invoices']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'cod' && (
        <>
          <div className="card p0 tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Customer</th><th className="num">Shipments</th><th className="num">COD collected</th><th className="num">Received from Delhivery</th><th>Bank</th><th>Cycle</th><th></th></tr></thead>
              <tbody>
                {d.pending.map((r) => (
                  <tr key={r.user_id}><td className="b">{r.customer}</td><td className="num">{r.n}</td><td className="num">{inr(r.collected)}</td><td className="num">{inr(r.received)}</td><td>{r.bank_name || '—'} {r.bank_account ? '••' + r.bank_account.slice(-4) : ''}</td><td>{r.cod_cycle}</td>
                    <td className="right"><span className="row" style={{ justifyContent: 'flex-end' }}>
                      {+r.received < +r.collected && <AsyncBtn className="btn btn-outline btn-sm" onClick={async () => { await api('/admin/cod/receive', { method: 'POST', body: { user_id: r.user_id } }); toast('Marked received'); reload(); }}>Mark received</AsyncBtn>}
                      <button className="btn btn-orange btn-sm" onClick={() => setRemit(r)}>Remit</button></span></td></tr>
                ))}
                {!d.pending.length && <tr><td colSpan={7} className="empty">No COD pending remittance.</td></tr>}
              </tbody>
            </table>
          </div>
          <h3 className="mt16 mb8" style={{ fontSize: 15 }}>Remittance history</h3>
          <div className="card p0 tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Customer</th><th className="num">Shipments</th><th>UTR / Ref</th><th className="num">Amount</th><th>Status</th></tr></thead>
            <tbody>{d.remittances.map((r) => <tr key={r.id}><td>{dShort(r.remit_date)}</td><td>{r.customer}</td><td className="num">{r.shipments}</td><td>{r.utr || '—'}</td><td className="num">{inr(r.amount, 2)}</td><td><Chip s="success" label="Paid" /></td></tr>)}
              {!d.remittances.length && <tr><td colSpan={6} className="empty">No remittances yet.</td></tr>}</tbody></table></div>
        </>
      )}
      {tab === 'ledger' && (
        <div className="card p0 tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Customer</th><th>Description</th><th>Type</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
          <tbody>{d.txns.map((t) => <tr key={t.id}><td>{dTime(t.created_at)}</td><td>{t.customer}</td><td>{t.description}</td><td><Chip s={t.type} /></td><td className="num">{inr(t.amount, 2)}</td><td className="num">{inr(t.balance_after, 2)}</td></tr>)}</tbody></table></div>
      )}
      {tab === 'inv' && (
        <>
          <div className="card row wrap mb12">
            <span className="small">Generate monthly GST invoices for all customers for</span>
            <select className="select" style={{ width: 'auto' }} value={period} onChange={(e) => setPeriod(e.target.value)}>{months(12).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
            <AsyncBtn onClick={async () => { const r = await api('/admin/invoices/generate', { method: 'POST', body: { period } }); toast(`${r.count} invoices generated for ${monthLabel(r.period)}`); reload(); }}>Generate</AsyncBtn>
          </div>
          <div className="card p0 tbl-wrap"><table className="tbl"><thead><tr><th>Invoice</th><th>Customer</th><th>Period</th><th className="num">Shipments</th><th className="num">Taxable</th><th className="num">GST</th><th className="num">Total</th><th></th></tr></thead>
            <tbody>{d.invoices.map((i) => <tr key={i.id}><td>{i.number}</td><td>{i.customer}</td><td>{monthLabel(i.period)}</td><td className="num">{i.shipments}</td><td className="num">{inr(i.taxable, 2)}</td><td className="num">{inr(i.gst, 2)}</td><td className="num">{inr(i.amount, 2)}</td>
              <td className="right"><a className="link small" href={`/invoice/?id=${i.id}`} target="_blank">View</a> · <AsyncBtn className="link-navy small" confirmText="Delete invoice?" onClick={async () => { await api('/admin/invoices/' + i.id, { method: 'DELETE' }); reload(); }}>Delete</AsyncBtn></td></tr>)}
              {!d.invoices.length && <tr><td colSpan={8} className="empty">No invoices yet.</td></tr>}</tbody></table></div>
        </>
      )}
      {remit && (
        <Modal title={`Remit COD · ${remit.customer}`} onClose={() => setRemit(null)}>
          <RemitForm r={remit} onDone={() => { setRemit(null); reload(); }} />
        </Modal>
      )}
    </>
  );
}

function RemitForm({ r, onDone }) {
  const [f, setF] = useState({ utr: '', to_wallet: false });
  return (
    <div className="col">
      <div className="kv"><span>Amount</span><b>{inr(r.collected, 2)} ({r.n} shipments)</b></div>
      <div className="kv"><span>Bank</span><b>{r.bank_name || '—'} {r.bank_account || ''}</b></div>
      <label className="check"><input type="checkbox" checked={f.to_wallet} onChange={(e) => setF({ ...f, to_wallet: e.target.checked })} /> Adjust into customer wallet instead of bank transfer</label>
      {!f.to_wallet && <input className="input" placeholder="Bank UTR / reference" value={f.utr} onChange={(e) => setF({ ...f, utr: e.target.value })} />}
      <AsyncBtn onClick={async () => { await api('/admin/cod/remit', { method: 'POST', body: { user_id: r.user_id, ...f } }); toast('Remittance recorded'); onDone(); }}>Confirm remittance</AsyncBtn>
    </div>
  );
}
