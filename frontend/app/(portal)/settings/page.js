'use client';
import { useEffect, useState } from 'react';
import { Chip, AsyncBtn, toast, PageHead, useLoad } from '@/components/ui';
import { useShell } from '@/components/Shell';
import { api, uploadFile, dTime, qp } from '@/lib/api';

export default function Settings() {
  const { me, refresh } = useShell();
  const [p, setP] = useState({});
  const [k, setK] = useState({ type: 'GST', number: '', doc_id: null });
  const [pw, setPw] = useState({ current: '', new: '' });
  const [welcome, setWelcome] = useState(false);
  const tickets = useLoad(() => api('/me/tickets'), []);
  useEffect(() => { setP({ name: me.name, business_name: me.business_name || '', mobile: me.mobile || '', city: me.city || '', gstin: me.gstin || '', bank_name: me.bank_name || '', bank_account: me.bank_account || '', bank_ifsc: me.bank_ifsc || '' }); setWelcome(qp('welcome') === '1'); }, [me]);
  const set = (k2) => (e) => setP({ ...p, [k2]: e.target.value });

  return (
    <>
      <PageHead title="Settings" sub="Profile, KYC, bank details for COD remittance and password" />
      {welcome && <div className="okmsg mb12">Welcome to Vishwaship! Next steps: complete KYC below → add a pickup address → recharge wallet → book your first shipment.</div>}
      <div className="split">
        <div className="card">
          <div className="card-h"><h3>Business profile</h3></div>
          <div className="grid2">
            <div className="field"><label>Full name</label><input className="input" value={p.name || ''} onChange={set('name')} /></div>
            <div className="field"><label>Business name</label><input className="input" value={p.business_name || ''} onChange={set('business_name')} /></div>
            <div className="field"><label>Mobile</label><input className="input" value={p.mobile || ''} onChange={set('mobile')} /></div>
            <div className="field"><label>Email</label><input className="input" value={me.email} disabled /></div>
            <div className="field"><label>City</label><input className="input" value={p.city || ''} onChange={set('city')} /></div>
            <div className="field"><label>GSTIN</label><input className="input" value={p.gstin || ''} onChange={set('gstin')} /></div>
          </div>
          <div className="card-h mt16"><h3>Bank account (COD remittance)</h3></div>
          <div className="grid3">
            <div className="field"><label>Bank</label><input className="input" value={p.bank_name || ''} onChange={set('bank_name')} /></div>
            <div className="field"><label>Account no.</label><input className="input" value={p.bank_account || ''} onChange={set('bank_account')} /></div>
            <div className="field"><label>IFSC</label><input className="input" value={p.bank_ifsc || ''} onChange={set('bank_ifsc')} /></div>
          </div>
          <AsyncBtn className="btn btn-orange mt16" onClick={async () => { await api('/me/profile', { method: 'PUT', body: p }); await refresh(); toast('Profile saved'); }}>Save profile</AsyncBtn>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-h"><h3>KYC</h3><Chip s={me.kyc_status} /></div>
            {me.kyc_status === 'verified' ? <p className="small">Your KYC is verified ({me.kyc_type}). You can book shipments.</p> : (
              <>
                {me.kyc_status === 'submitted' && <div className="note mb12">KYC submitted — our team will verify shortly.</div>}
                {me.kyc_status === 'rejected' && <div className="err mb12">KYC rejected{me.kyc_note ? `: ${me.kyc_note}` : ''}. Please re-submit.</div>}
                <div className="grid2">
                  <div className="field"><label>Document</label><select className="select" value={k.type} onChange={(e) => setK({ ...k, type: e.target.value })}><option value="GST">GST certificate</option><option value="PAN">PAN card</option><option value="AADHAAR">Aadhaar</option></select></div>
                  <div className="field"><label>{k.type === 'GST' ? 'GSTIN' : k.type === 'PAN' ? 'PAN number' : 'Aadhaar number'}</label><input className="input" value={k.number} onChange={(e) => setK({ ...k, number: e.target.value })} /></div>
                </div>
                <div className="field mt12"><label>Upload document (image / PDF)</label><input type="file" accept="image/*,application/pdf" onChange={async (e) => { try { const id = await uploadFile(e.target.files[0]); setK({ ...k, doc_id: id }); toast('Document uploaded'); } catch (er) { toast(er.message, true); } }} /></div>
                <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await api('/me/kyc', { method: 'POST', body: k }); await refresh(); toast('KYC submitted'); }}>Submit KYC</AsyncBtn>
              </>
            )}
          </div>
          <div className="card">
            <div className="card-h"><h3>Change password</h3></div>
            <div className="grid2"><input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><input className="input" type="password" placeholder="New password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} /></div>
            <AsyncBtn className="btn btn-navy mt12" onClick={async () => { await api('/auth/password', { method: 'POST', body: pw }); setPw({ current: '', new: '' }); toast('Password changed'); }}>Update password</AsyncBtn>
          </div>
          <div className="card">
            <div className="card-h"><h3>Support tickets</h3></div>
            {(tickets.data?.items || []).map((t) => <div key={t.id} className="kv" style={{ display: 'block' }}><div className="row between"><b className="small">{t.subject}</b><Chip s={t.status} /></div><div className="tiny muted">{dTime(t.created_at)}</div>{t.reply && <div className="note mt8">Reply: {t.reply}</div>}</div>)}
            {!tickets.data?.items.length && <p className="small muted">No tickets. Raise one from any shipment's detail page.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
