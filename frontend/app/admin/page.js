'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Stat, Spinner, ErrorBox, useLoad } from '@/components/ui';
import { api, lakh, inr, monthLabel, dTime, months } from '@/lib/api';


export default function AdminDashboard() {
  const [m, setM] = useState(months()[0]);
  const { data: d, err, reload } = useLoad(() => api('/admin/dashboard?month=' + m), [m]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const st = d.status;
  const max = Math.max(1, st.in_transit + st.picked_up, st.out_for_delivery, st.delivered, st.rto, st.ndr, st.pickup_pending);
  const bars = [['In transit', st.in_transit + st.picked_up, '#2453d6'], ['Out for delivery', st.out_for_delivery, '#6b3fd4'], ['Delivered', st.delivered, '#1e7b3a'], ['RTO', st.rto, '#c62828'], ['NDR', st.ndr, '#c2560f'], ['Pickup pending', st.pickup_pending, '#a68000']];
  const mo = d.money;
  return (
    <>
      <div className="ph">
        <div><h1>Admin Dashboard</h1><p>All customers · all shipments · Delhivery cost vs your billing · {monthLabel(m)}</p></div>
        <select className="select" style={{ width: 'auto', border: '1.5px solid var(--navy)', fontWeight: 600 }} value={m} onChange={(e) => setM(e.target.value)}>{months().map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select>
      </div>
      <div className="stats s6">
        <Stat plain icon="users" title="Customers" value={d.customers} sub={`+${d.new_customers} this month`} subCls="green" />
        <Stat plain icon="box" title={`Shipments (${monthLabel(m).slice(0, 3)})`} value={mo.shipments.toLocaleString('en-IN')} sub={d.growth === null ? '—' : `${d.growth >= 0 ? '▲' : '▼'} ${Math.abs(d.growth)}%`} subCls={d.growth >= 0 ? 'green' : 'red'} />
        <Stat plain icon="rupee" title="Billed to customers" value={lakh(mo.billed)} sub="final rate" subCls="green" />
        <Stat plain icon="truck" title="Delhivery cost" value={lakh(mo.cost)} sub="base rate" />
        <Stat plain icon="percent" title="Your margin" value={lakh(mo.margin)} sub={`${mo.margin_pct}% of billing`} subCls="green" />
        <Stat plain icon="weight" title="Weight disputes open" value={d.disputes_open} sub={inr(d.disputes_amount)} subCls="orange" />
      </div>
      <div className="split-3 mt16">
        <div className="card">
          <div className="card-h"><h3>Shipments by status</h3><span className="tiny muted">live</span></div>
          {bars.map(([l, n, c]) => <div key={l} className="hbar"><span>{l}</span><span className="track"><i style={{ width: `${(n / max) * 100}%`, background: c }} /></span><b className="right">{n.toLocaleString('en-IN')}</b></div>)}
        </div>
        <div className="card p0">
          <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Top customers</h3><Link href="/admin/customers/" className="small muted">All →</Link></div>
          <table className="tbl"><thead><tr><th>Customer</th><th className="num">Shipments</th><th className="num">Billed</th><th className="num">Margin</th></tr></thead>
            <tbody>{d.top.map((t) => <tr key={t.id}><td>{t.business_name || t.name}</td><td className="num">{t.n}</td><td className="num">{lakh(t.billed)}</td><td className="num green">{lakh(t.margin)}</td></tr>)}
              {!d.top.length && <tr><td colSpan={4} className="empty">No shipments this month.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="card-h"><h3><Icon name="code" style={{ color: 'var(--orange)' }} />Delhivery API</h3></div>
          <div className="kv"><span>Connection</span><span className={'chip c-' + (d.api.connected ? 'connected' : 'pending')}>{d.api.connected ? 'Connected' : 'Simulation mode'}</span></div>
          <div className="kv"><span>Environment</span><b>{d.api.env}</b></div>
          <div className="kv"><span>Last status sync</span><b>{d.api.last_sync ? dTime(d.api.last_sync) : '—'}</b></div>
          <div className="kv"><span>Today API calls</span><b>{d.api.calls_today} · {d.api.errors_today} errors</b></div>
          <div className="kv"><span>Pickups scheduled today</span><b>{d.api.pickups_today}</b></div>
          <Link href="/admin/delhivery/" className="link small mt8" style={{ display: 'block' }}>Configure →</Link>
        </div>
      </div>
      <div className="split mt16">
        <div className="card">
          <div className="card-h"><h3>Pricing rule</h3><Link href="/admin/rates/" className="small link">Edit</Link></div>
          <div className="kv"><span>Global markup</span><b>{d.pricing.global}%</b></div>
          <div className="kv"><span>Example</span><b>Base ₹100 → customer ₹{Math.ceil(100 * (1 + d.pricing.global / 100))}</b></div>
          <div className="kv"><span>Custom markup customers</span><b>{d.pricing.custom}</b></div>
        </div>
        <div className="card">
          <div className="card-h"><h3><Icon name="bell" style={{ color: 'var(--red)' }} />Alerts</h3></div>
          <div className="kv"><span>Low wallet</span><b><Link href="/admin/customers/">{d.alerts.low_wallet} customers below {inr(d.alerts.low_wallet_threshold)}</Link></b></div>
          <div className="kv"><span>KYC pending</span><b><Link href="/admin/customers/?kyc=submitted">{d.alerts.kyc_pending} ({d.alerts.kyc_submitted} submitted)</Link></b></div>
          <div className="kv"><span>Weight disputes</span><b><Link href="/admin/disputes/">{d.disputes_open} open · {d.disputes_to_delhivery} to Delhivery</Link></b></div>
          <div className="kv"><span>Support</span><b><Link href="/admin/support/">{d.alerts.tickets} tickets · {d.alerts.enquiries} new enquiries</Link></b></div>
        </div>
      </div>
    </>
  );
}
