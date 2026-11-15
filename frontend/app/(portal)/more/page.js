'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useShell } from '@/components/Shell';
import { Modal, AsyncBtn, toast } from '@/components/ui';
import { api, setToken, setUser, initials, inr } from '@/lib/api';
import { getTheme, setTheme } from '@/lib/theme';

const GROUPS = [
  ['Profile', [
    { t: 'My Profile', s: 'Manage profile, address & bank details', ic: 'user', href: '/settings/?tab=profile' },
    { t: 'Documents & KYC', ic: 'file', href: '/settings/?tab=kyc' },
    { t: 'Change Password', ic: 'lock', href: '/settings/?tab=password' },
  ]],
  ['Billing, Tools & Reports', [
    { t: 'Billing', ic: 'receipt', items: [['Passbook', '/billing/?view=passbook'], ['COD Remittance', '/billing/?view=cod'], ['Shipping Charges', '/billing/?view=charges'], ['All Recharges', '/billing/?view=recharges'], ['Invoices', '/billing/?view=invoices'], ['Credit Notes', '/billing/?view=credit_notes'], ['Debit Notes', '/billing/?view=debit_notes'], ['Ledgers', '/billing/?view=ledger'], ['Notification Credit History', '/billing/?view=notif']] },
    { t: 'Tools', ic: 'tool', items: [['Rate Calculator', '/rate-calculator/'], ['Shipment Price List', '/price-list/'], ['Activity logs', '/activity/'], ['Manage Courier', '/couriers/'], ['Report Download', '/reports/'], ['Track Order', '/shipment/'], ['Weight Discrepancy', '/weight-discrepancy/']] },
    { t: 'Reports', ic: 'chart', items: [['Shipment Report', '/reports/?type=shipment'], ['Order Reports', '/reports/?type=order'], ['NDR Reports', '/reports/?type=ndr'], ['Custom Report', '/reports/?type=custom']] },
  ]],
  ['Settings & Warehouse', [
    { t: 'Settings', ic: 'gear', items: [['Branded Tracking Page', '/settings/?tab=tracking'], ['Label Setting', '/settings/?tab=label'], ['Invoice settings', '/settings/?tab=invoice'], ['Auto-Assign Rule', '/settings/?tab=auto-assign'], ['Shipping Notification', '/settings/?tab=notifications'], ['COD Confirmation', '/settings/?tab=cod-confirmation'], ['Early COD Subscription', '/settings/?tab=early-cod']] },
    { t: 'Warehouse', ic: 'building', href: '/pickup-addresses/' },
  ]],
  ['Integrations & Others', [
    { t: 'Integrations', ic: 'plug', items: [['Order Channels', '/integrations/?tab=channels'], ['OMS', '/integrations/?tab=oms'], ['EDD Widget', '/integrations/?tab=edd'], ['API Integration', '/integrations/?tab=api']] },
    { t: 'Others', ic: 'layers', items: [['Wallet & Recharge', '/wallet/'], ['NDR / RTO', '/ndr/'], ['Book Shipment', '/book/'], ['Support tickets', '/support/']] },
  ]],
  ['Others', [
    { t: 'Contact Us', ic: 'phone', href: '/support/' },
    { t: 'Web Panel', ic: 'ext', href: '/dashboard/', ext: true },
  ]],
];

export default function More() {
  const { me } = useShell();
  const [open, setOpen] = useState('');
  const [del, setDel] = useState(false);
  const [theme, setTh] = useState(getTheme);
  const logout = () => { setToken(null); setUser(null); location.href = '/login/'; };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card row" style={{ gap: 14, borderRadius: 16 }}>
        <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(me.name)}</span>
        <div className="grow"><b style={{ fontSize: 16 }}>{me.business_name || me.name}</b><div className="small muted">{me.name} · {me.mobile} · {me.email}</div></div>
        <Link href="/settings/?tab=profile" className="btn btn-outline btn-sm">Edit</Link>
      </div>
      <div className="mh-2">
        <Link href="/wallet/" className="mh-card"><span className="mh-big">👛</span><b>{inr(me.wallet_balance, 2)}</b><span>Wallet Balance</span></Link>
        <Link href="/settings/?tab=kyc" className="mh-card"><span className="mh-big">{me.kyc_status === 'verified' ? '✅' : '🪪'}</span><b className={me.kyc_status === 'verified' ? 'green' : ''}>{me.kyc_status === 'verified' ? 'Verified' : me.kyc_status === 'submitted' ? 'Under review' : 'Pending'}</b><span>Profile Status</span></Link>
      </div>
      {GROUPS.map(([g, rows]) => (
        <div key={g}>
          <div className="more-grp">{g}</div>
          <div className="more-card">
            {rows.map((r) => r.items ? (
              <div key={r.t}>
                <button className="more-row" onClick={() => setOpen(open === r.t ? '' : r.t)}><span className="ic"><Icon name={r.ic} size={18} /></span>{r.t}<Icon name="chev" className={'chev' + (open === r.t ? ' up' : '')} /></button>
                {open === r.t && <div className="more-sub">{r.items.map(([l, h]) => <Link key={l} href={h}><span className="o" />{l}</Link>)}</div>}
              </div>
            ) : (
              <Link key={r.t} href={r.href} className="more-row"><span className="ic"><Icon name={r.ic} size={18} /></span><span>{r.t}{r.s && <span className="sub">{r.s}</span>}</span>{r.ext && <Icon name="ext" className="chev" />}</Link>
            ))}
          </div>
        </div>
      ))}
      <div className="more-card mt24" style={{ padding: 14 }}>
        <b className="small">Switch themes</b>
        <div className="seg mt8" style={{ display: 'flex' }}>{[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([k, l]) => <button key={k} type="button" className={theme === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setTh(k); setTheme(k); }}>{l}</button>)}</div>
      </div>
      <div className="more-card mt16">
        <button className="more-row" onClick={logout}><span className="ic"><Icon name="logout" size={18} /></span>Log out</button>
        <AsyncBtn className="more-row danger" confirmText="Log out from all other phones and computers? This device stays logged in." onClick={async () => { const r = await api('/auth/logout-all', { method: 'POST' }); setToken(r.token); toast('Logged out from all other devices'); }}><span className="ic"><Icon name="logout" size={18} /></span>Logout from all other active devices</AsyncBtn>
        <button className="more-row danger" onClick={() => setDel(true)}><span className="ic"><Icon name="user" size={18} /></span>{me.deletion_requested_at ? 'Account deletion requested' : 'Account Deletion Request'}</button>
      </div>
      <div className="center tiny muted mt16">Vishwaship web v2.0</div>
      <div className="more-legal"><Link href="/privacy/">Privacy Policy</Link><Link href="/refund-policy/">Refund & Cancellation</Link><Link href="/terms/">Terms & Conditions</Link></div>
      {del && <DeleteModal me={me} onClose={() => setDel(false)} />}
    </div>
  );
}

function DeleteModal({ me, onClose }) {
  const { refresh } = useShell();
  const [f, setF] = useState({ reason: '', password: '' });
  return (
    <Modal title="Account deletion request" onClose={onClose}>
      {me.deletion_requested_at ? (
        <>
          <p className="small">You requested deletion on <b>{me.deletion_requested_at}</b>. Our team will settle your wallet and COD dues and then delete the account.</p>
          <AsyncBtn className="btn btn-outline" onClick={async () => { await api('/me/delete-request/cancel', { method: 'POST' }); await refresh(); toast('Deletion request cancelled'); onClose(); }}>Cancel my request</AsyncBtn>
        </>
      ) : (
        <div className="col">
          <p className="small">Your account, shipments history and saved addresses will be permanently deleted after pending wallet balance and COD dues are settled. This cannot be undone.</p>
          <textarea className="textarea" placeholder="Reason (optional)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <input className="input" type="password" placeholder="Confirm with your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <AsyncBtn className="btn btn-red" onClick={async () => { const r = await api('/me/delete-request', { method: 'POST', body: f }); toast(r.message); await refresh(); onClose(); }}>Request deletion</AsyncBtn>
        </div>
      )}
    </Modal>
  );
}
