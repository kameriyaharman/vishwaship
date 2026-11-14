'use client';
import { useEffect, useState } from 'react';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, download, inr, lakh, qp, getToken, setToken, fileUrl, dShort } from '@/lib/api';

export default function Customers() {
  const [f, setF] = useState({ q: '', kyc: '', markup: '', status: '' });
  const [applied, setApplied] = useState(null);
  const [selId, setSelId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [kycOk, setKycOk] = useState(null);
  useEffect(() => { const k = qp('kyc') || ''; setF((x) => ({ ...x, kyc: k })); setApplied({ kyc: k }); }, []);
  const qs = () => new URLSearchParams(Object.fromEntries(Object.entries({ ...applied }).filter(([, v]) => v))).toString();
  const { data: d, err, reload } = useLoad(() => applied ? api('/admin/customers?' + qs()) : Promise.resolve(null), [applied]);
  const det = useLoad(() => selId ? api('/admin/customers/' + selId) : Promise.resolve(null), [selId]);
  useEffect(() => { if (d?.items[0] && !selId) setSelId(d.items[0].id); }, [d, selId]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const refreshAll = () => { reload(); det.reload(); };
  const c = det.data;

  const loginAs = async (id) => {
    const r = await api(`/admin/customers/${id}/impersonate`, { method: 'POST' });
    localStorage.setItem('vs_admin_token', getToken());
    setToken(r.token); localStorage.setItem('vs_user', JSON.stringify(r.user));
    location.href = '/dashboard/';
  };

  return (
    <>
      <PageHead title="Customers" sub="All customers, KYC, wallet, custom markup, shipments — search & filter">
        <AsyncBtn className="btn btn-outline" onClick={() => download('/admin/customers?export=1&' + qs(), 'customers.csv')}>Export</AsyncBtn>
        <button className="btn btn-orange" onClick={() => setEdit({})}>Add customer</button>
      </PageHead>
      <form className="card mb12" onSubmit={(e) => { e.preventDefault(); setApplied({ ...f }); }}>
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Search</label><input className="input" placeholder="Name / phone / GSTIN / email" value={f.q} onChange={set('q')} /></div>
          <div className="field"><label>KYC</label><select className="select" value={f.kyc} onChange={set('kyc')}><option value="">All</option><option value="verified">Verified</option><option value="submitted">Submitted</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></div>
          <div className="field"><label>Commission</label><select className="select" value={f.markup} onChange={set('markup')}><option value="">All</option><option value="global">Global</option><option value="custom">Custom</option></select></div>
          <div className="field"><label>Status</label><select className="select" value={f.status} onChange={set('status')}><option value="">All</option><option value="active">Active</option><option value="blocked">Blocked</option></select></div>
          <button className="btn btn-navy">Apply</button>
        </div>
      </form>
      <ErrorBox err={err} onRetry={reload} />
      <div className="split-2-1" style={{ gridTemplateColumns: '2.2fr 1fr' }}>
        <div className="card p0 tbl-wrap">
          {!d ? <Spinner /> : (
            <table className="tbl">
              <thead><tr><th>Customer</th><th>Contact</th><th>KYC</th><th className="num">Wallet</th><th className="num">Shipments</th><th>Commission</th><th className="num hide-md">Billed (month)</th><th>Status</th></tr></thead>
              <tbody>
                {d.items.map((u) => (
                  <tr key={u.id} className={'click' + (u.id === selId ? ' sel' : '')} onClick={() => setSelId(u.id)}>
                    <td className="b">{u.business_name || u.name}</td><td className="small">{u.name}<br />{u.mobile}</td>
                    <td className="small">{u.kyc_status === 'verified' ? <span className="green">✓ Approved</span> : <Chip s={u.kyc_status === 'submitted' ? 'pending' : u.kyc_status} label={u.kyc_status === 'submitted' ? 'Pending approval' : u.kyc_status === 'pending' ? 'Not submitted' : u.kyc_status} />}</td>
                    <td className={'num' + (+u.wallet_balance < 0 ? ' red' : '')}>{inr(u.wallet_balance)}</td><td className="num">{u.shipments}</td>
                    <td className="small">{u.markup_pct === null ? `${d.global_markup}% (global)` : <b className="blue">{+u.markup_pct}% custom</b>}</td>
                    <td className="num hide-md">{+u.billed_month ? lakh(u.billed_month) : '—'}</td>
                    <td><Chip s={u.status === 'blocked' ? 'blocked' : u.kyc_status !== 'verified' ? 'kyc_pending' : 'active'} label={u.status === 'blocked' ? 'Blocked' : u.kyc_status !== 'verified' ? 'KYC pending' : 'Active'} /></td>
                  </tr>
                ))}
                {!d.items.length && <tr><td colSpan={8} className="empty">No customers found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          {!c ? (selId ? <Spinner /> : <div className="muted small">Select a customer</div>) : (
            <>
              <h3 style={{ fontSize: 16 }}>{c.business_name || c.name}</h3>
              <div className="mt12">
                <div className="kv"><span>Business</span><b>{c.business_name || '—'}{c.city ? ', ' + c.city : ''}</b></div>
                <div className="kv"><span>Contact</span><b>{c.name} · {c.mobile}</b></div>
                <div className="kv"><span>Email</span><b style={{ wordBreak: 'break-all' }}>{c.email}</b></div>
                <div className="kv"><span>GSTIN</span><b>{c.gstin || '—'} {c.kyc_status === 'verified' && c.gstin && '✓'}</b></div>
                <div className="kv"><span>KYC</span><b><Chip s={c.kyc_status} /> {c.kyc_type}{c.pan ? ` · PAN ${c.pan}` : ''}{c.aadhaar ? ` · ${c.aadhaar}` : ''}</b></div>
                <div className="kv"><span>Pickup addresses</span><b>{c.pickups.length} ({c.pickups.filter((p) => p.delhivery_status === 'registered').length} registered)</b></div>
                <div className="kv"><span>Commission</span><b>{c.markup_pct === null ? `Global ${d?.global_markup}%` : `${+c.markup_pct}% custom`}</b></div>
                <div className="kv"><span>Wallet</span><b>{inr(c.wallet_balance, 2)}</b></div>
                <div className="kv"><span>COD remittance</span><b>{c.cod_cycle} · {c.bank_name || '—'} {c.bank_account ? '••' + c.bank_account.slice(-4) : ''}</b></div>
                <div className="kv"><span>Credit limit</span><b>{+c.credit_limit ? inr(c.credit_limit) : '₹0 (prepaid)'}</b></div>
                <div className="kv"><span>Shipments</span><b>{c.stats.all} · {c.stats.delivered} delivered · {c.stats.rto} RTO</b></div>
                <div className="kv"><span>Joined</span><b>{dShort(c.created_at)}</b></div>
              </div>
              {['submitted', 'verified', 'rejected'].includes(c.kyc_status) && (c.aadhaar_doc_id || c.pan_doc_id || c.cheque_doc_id) && (
                <div className="note mt12" style={{ background: c.kyc_status === 'submitted' ? 'var(--orange-soft)' : undefined }}>
                  <div className="row between"><b>KYC documents</b><Chip s={c.kyc_status === 'submitted' ? 'pending' : c.kyc_status} label={c.kyc_status === 'submitted' ? 'Pending approval' : c.kyc_status} /></div>
                  <div className="kv"><span>Type</span><b>{c.account_type === 'company' ? 'Company' : 'Individual'}</b></div>
                  <div className="kv"><span>Aadhaar</span><b>{c.aadhaar || '—'} {c.aadhaar_doc_id && <a className="link" href={fileUrl(c.aadhaar_doc_id)} target="_blank">View</a>}</b></div>
                  <div className="kv"><span>PAN</span><b>{c.pan || '—'} {c.pan_doc_id && <a className="link" href={fileUrl(c.pan_doc_id)} target="_blank">View</a>}</b></div>
                  <div className="kv"><span>Bank</span><b>{c.bank_name} · {c.bank_account} · {c.bank_ifsc}</b></div>
                  <div className="kv"><span>Cancelled cheque</span><b>{c.cheque_doc_id ? <a className="link" href={fileUrl(c.cheque_doc_id)} target="_blank">View</a> : '—'}</b></div>
                  {c.account_type === 'company' && <div className="kv"><span>GST</span><b>{c.gstin || '—'} {c.gst_doc_id && <a className="link" href={fileUrl(c.gst_doc_id)} target="_blank">View</a>}</b></div>}
                  {c.kyc_status === 'submitted' && (
                    <div className="row mt8">
                      <button className="btn btn-sm btn-navy" onClick={() => setKycOk(c)}>Approve & set commission</button>
                      <AsyncBtn className="btn btn-sm btn-outline" onClick={async () => { const n = prompt('Reason for rejection (customer will see this)?'); if (n === null) return; await api('/admin/customers/' + c.id, { method: 'PUT', body: { kyc_status: 'rejected', kyc_note: n } }); refreshAll(); }}>Reject</AsyncBtn>
                    </div>
                  )}
                </div>
              )}
              {c.kyc_status === 'submitted' && !(c.aadhaar_doc_id || c.pan_doc_id || c.cheque_doc_id) && (
                <div className="note mt12">
                  <b>KYC submitted</b> — {c.kyc_type} {c.kyc_type === 'GST' ? c.gstin : c.kyc_type === 'PAN' ? c.pan : c.aadhaar}
                  {c.kyc_doc_id && <> · <a className="link" href={fileUrl(c.kyc_doc_id)} target="_blank">View document</a></>}
                  <div className="row mt8"><button className="btn btn-sm btn-navy" onClick={() => setKycOk(c)}>Approve & set commission</button></div>
                </div>
              )}
              <div className="grid2 mt16" style={{ gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setWallet(c)}>Adjust wallet</button>
                <AsyncBtn className="btn btn-navy btn-sm" onClick={() => loginAs(c.id)}>Login as customer</AsyncBtn>
                <button className="btn btn-outline btn-sm" onClick={() => setEdit(c)}>Edit / commission</button>
                <AsyncBtn className="btn btn-outline btn-sm" onClick={async () => { await api('/admin/customers/' + c.id, { method: 'PUT', body: { status: c.status === 'blocked' ? 'active' : 'blocked' } }); refreshAll(); }}>{c.status === 'blocked' ? 'Unblock' : 'Block'}</AsyncBtn>
              </div>
              <a className="link small mt12" style={{ display: 'block' }} href={`/admin/shipments/?customer=${c.id}`}>View shipments →</a>
              {c.deletion_requested_at && <div className="err mt12 small">Account deletion requested on {dShort(c.deletion_requested_at)}</div>}
              {c.early_cod == 1 && <div className="note mt8 small">Early COD subscribed</div>}
              <details className="mt12"><summary className="small b" style={{ cursor: 'pointer' }}>Activity log ({c.activity?.length || 0})</summary>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>{(c.activity || []).map((a) => <div key={a.id} className="tiny" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}><b>{a.action}</b> {a.detail} <span className="muted">· {dShort(a.created_at)}{a.actor ? ` · by ${a.actor}` : ''}</span></div>)}</div></details>
              <AsyncBtn className="link-navy small mt8 red" confirmText="Permanently delete this customer and ALL their shipments, wallet history and data?" onClick={async () => { await api(`/admin/customers/${c.id}?force=1`, { method: 'DELETE' }); toast('Customer deleted'); setSelId(null); reload(); }}>Delete customer</AsyncBtn>
            </>
          )}
        </div>
      </div>
      {edit && <EditCustomer c={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); refreshAll(); }} />}
      {kycOk && <KycApprove c={kycOk} globalPct={d?.global_markup} onClose={() => setKycOk(null)} onDone={() => { setKycOk(null); refreshAll(); }} />}
      {wallet && <WalletAdjust c={wallet} onClose={() => setWallet(null)} onDone={() => { setWallet(null); refreshAll(); }} />}
    </>
  );
}

function EditCustomer({ c, onClose, onDone }) {
  const isNew = !c.id;
  const [f, setF] = useState({
    name: c.name || '', business_name: c.business_name || '', email: c.email || '', mobile: c.mobile || '', city: c.city || '', gstin: c.gstin || '', pan: c.pan || '',
    markup_pct: c.markup_pct ?? '', markup_reason: c.markup_reason || '', credit_limit: c.credit_limit ?? 0, cod_cycle: c.cod_cycle || 'Weekly',
    bank_name: c.bank_name || '', bank_account: c.bank_account || '', bank_ifsc: c.bank_ifsc || '', kyc_status: c.kyc_status || 'pending', status: c.status || 'active', password: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const F = (k, l, t = 'text') => <div className="field"><label>{l}</label><input className="input" type={t} value={f[k]} onChange={set(k)} /></div>;
  return (
    <Modal title={isNew ? 'Add customer' : 'Edit ' + (c.business_name || c.name)} onClose={onClose} wide>
      <div className="grid3">
        {F('name', 'Full name')}{F('business_name', 'Business name')}{F('email', 'Email', 'email')}
        {F('mobile', 'Mobile')}{F('city', 'City')}{F('gstin', 'GSTIN')}
        {F('pan', 'PAN')}
        <div className="field"><label>KYC</label><select className="select" value={f.kyc_status} onChange={set('kyc_status')}>{['pending', 'submitted', 'verified', 'rejected'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Status</label><select className="select" value={f.status} onChange={set('status')}><option>active</option><option>blocked</option></select></div>
      </div>
      <h4 className="mt16 mb8">Commission & credit</h4>
      <div className="grid3">
        <div className="field"><label>Commission % on API price (blank = global)</label><input className="input" type="number" step="0.5" value={f.markup_pct} onChange={set('markup_pct')} /></div>
        {F('markup_reason', 'Reason')}{F('credit_limit', 'Credit limit (₹)', 'number')}
      </div>
      <h4 className="mt16 mb8">COD remittance</h4>
      <div className="grid4">
        <div className="field"><label>Cycle</label><select className="select" value={f.cod_cycle} onChange={set('cod_cycle')}>{['Daily', 'Twice a week', 'Weekly', 'Fortnightly'].map((x) => <option key={x}>{x}</option>)}</select></div>
        {F('bank_name', 'Bank')}{F('bank_account', 'Account no.')}{F('bank_ifsc', 'IFSC')}
      </div>
      <div className="grid3 mt12">{F('password', isNew ? 'Password (default Welcome@123)' : 'Reset password (optional)', 'text')}</div>
      <AsyncBtn className="btn btn-orange mt16" onClick={async () => {
        const body = { ...f }; if (!body.password) delete body.password;
        const r = await api(isNew ? '/admin/customers' : '/admin/customers/' + c.id, { method: isNew ? 'POST' : 'PUT', body });
        toast(isNew ? `Customer created${r.default_password ? ' · password ' + r.default_password : ''}` : 'Saved'); onDone();
      }}>Save</AsyncBtn>
    </Modal>
  );
}

function WalletAdjust({ c, onClose, onDone }) {
  const [f, setF] = useState({ type: 'credit', amount: '', note: '' });
  return (
    <Modal title={`Adjust wallet · ${c.business_name || c.name}`} onClose={onClose}>
      <p className="small">Current balance: <b>{inr(c.wallet_balance, 2)}</b></p>
      <div className="col">
        <div className="seg"><button className={f.type === 'credit' ? 'on' : ''} onClick={() => setF({ ...f, type: 'credit' })}>Credit (+)</button><button className={f.type === 'debit' ? 'on' : ''} onClick={() => setF({ ...f, type: 'debit' })}>Debit (−)</button></div>
        <input className="input" type="number" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input className="input" placeholder="Note (shown to customer)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <AsyncBtn onClick={async () => { await api(`/admin/customers/${c.id}/wallet`, { method: 'POST', body: f }); toast('Wallet updated'); onDone(); }}>Apply</AsyncBtn>
      </div>
    </Modal>
  );
}

function KycApprove({ c, globalPct, onClose, onDone }) {
  const [f, setF] = useState({ markup_pct: c.markup_pct ?? '', markup_reason: c.markup_reason || '', credit_limit: c.credit_limit || 0 });
  const pct = f.markup_pct === '' ? +globalPct : +f.markup_pct;
  return (
    <Modal title={`Approve KYC · ${c.business_name || c.name}`} onClose={onClose}>
      <div className="note mb12">{c.kyc_type} {c.kyc_type === 'GST' ? c.gstin : c.kyc_type === 'PAN' ? c.pan : c.aadhaar}{c.kyc_doc_id && <> · <a className="link" href={fileUrl(c.kyc_doc_id)} target="_blank">View document</a></>}</div>
      <div className="col">
        <div className="field"><label>Your commission % on courier API price</label><input className="input" type="number" step="0.5" min="0" placeholder={`Blank = global ${globalPct}%`} value={f.markup_pct} onChange={(e) => setF({ ...f, markup_pct: e.target.value })} />
          <span className="tiny muted">Applied on Delhivery / Shipmozo price for this customer. Example: API ₹100 → customer pays ₹{Math.ceil(100 * (1 + pct / 100))} + GST</span></div>
        <div className="field"><label>Note (optional)</label><input className="input" placeholder="e.g. High volume, contract rate" value={f.markup_reason} onChange={(e) => setF({ ...f, markup_reason: e.target.value })} /></div>
        <div className="field"><label>Credit limit (₹, optional)</label><input className="input" type="number" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value })} /></div>
        <AsyncBtn onClick={async () => { await api('/admin/customers/' + c.id, { method: 'PUT', body: { ...f, kyc_status: 'verified' } }); toast(`KYC approved · commission ${pct}%`); onDone(); }}>Approve KYC</AsyncBtn>
      </div>
    </Modal>
  );
}
