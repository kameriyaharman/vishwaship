'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useShell } from '@/components/Shell';
import { Stat, Chip, Spinner, ErrorBox, useLoad } from '@/components/ui';
import { api, inr, kg, dLong, dShort } from '@/lib/api';

const RANGES = { today: 'Today', week: 'Last 7 days', month: 'This month', last_month: 'Last month', all: 'All time' };

export default function Dashboard() {
  const { me } = useShell();
  const [range, setRange] = useState('month');
  const { data: d, err, reload } = useLoad(() => api('/me/dashboard?range=' + range), [range]);
  const max = d ? Math.max(1, ...d.chart.map((x) => x.n)) : 1;
  const c = d?.range_counts;
  const L = d?.live;

  return (
    <>
      <div className="ph">
        <div><h1>Dashboard</h1><p>Hi {me.name.split(' ')[0]} 👋 — your shipments at a glance · {dLong(new Date().toISOString())}</p></div>
        <select className="select btn-outline" style={{ width: 'auto', fontWeight: 600, border: '1.5px solid var(--navy)' }} value={range} onChange={(e) => setRange(e.target.value)}>
          {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <ErrorBox err={err} onRetry={reload} />
      {!d ? <Spinner /> : (
        <>
          {me.kyc_status !== 'verified' && (
            <div className="card mb12 row between wrap" style={{ background: 'var(--orange-soft)', borderColor: 'var(--orange-line)' }}>
              <span className="row"><Icon name="alert" style={{ color: 'var(--orange)' }} /> <b>Complete your KYC</b> <span className="small muted">— PAN / GST / Aadhaar needed to start shipping.</span></span>
              <Link href="/settings/" className="btn btn-orange btn-sm">Complete KYC</Link>
            </div>
          )}
          <div className="stats">
            <Stat icon="box" title="Total shipments" value={c.all.toLocaleString('en-IN')} sub={`all time ${L.all.toLocaleString('en-IN')}`} color="navy" />
            <Stat icon="clock" title="Pickup pending" value={L.pickup_pending} sub={`pickup today ${d.pickup_today}`} color="yellow" />
            <Stat icon="truck" title="In transit" value={L.in_transit + L.picked_up} sub="live" color="blue" />
            <Stat icon="truck" title="Out for delivery" value={L.out_for_delivery} sub="live" color="purple" />
            <Stat icon="check" title="Delivered" value={c.delivered.toLocaleString('en-IN')} sub={`${d.delivered_pct}%`} color="green" />
            <Stat icon="undo" title="RTO" value={c.rto} sub={`${d.rto_pct}%`} color="red" />
            <Stat icon="alert" title="NDR (action needed)" value={d.ndr_open} sub={<Link href="/ndr/">re-attempt / RTO</Link>} color="orange" />
            <Stat icon="weight" title="Weight discrepancy" value={d.wd_open} sub={<Link href="/weight-discrepancy/">{inr(d.wd_amount)} extra · view</Link>} color="orange" />
          </div>

          <div className="split-1-2 mt16" style={{ gridTemplateColumns: '1fr 1.45fr' }}>
            <div className="card">
              <div className="card-h"><h3>Shipments — last 7 days</h3></div>
              <div className="bars">
                {d.chart.map((x, i) => (
                  <div key={x.date} className={'b' + (i === 6 ? ' hl' : '')}><em>{x.n}</em><i style={{ height: `${(x.n / max) * 100}%` }} /><small>{x.label}</small></div>
                ))}
              </div>
            </div>
            <div className="card p0">
              <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Recent shipments</h3><Link href="/shipments/" className="small muted">View all →</Link></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>AWB</th><th className="hide-sm">From</th><th>To</th><th className="hide-sm">Weight</th><th>Status</th><th className="num">Rate</th></tr></thead>
                  <tbody>
                    {d.recent.map((s) => (
                      <tr key={s.id} className="click" onClick={() => (location.href = '/shipment/?id=' + s.id)}>
                        <td className="mono">{s.awb}</td><td className="hide-sm">{s.from_city} {s.from_pincode}</td><td>{s.to_city} {s.to_pincode}</td>
                        <td className="hide-sm">{kg(s.chargeable_weight)}</td><td><Chip s={s.status_key} label={s.status_label} /></td><td className="num">{inr(+s.freight + +s.cod_charge)}</td>
                      </tr>
                    ))}
                    {!d.recent.length && <tr><td colSpan={6} className="empty">No shipments yet. <Link href="/book/" className="link">Book your first shipment →</Link></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="split-3 mt16">
            <div className="card"><div className="card-h"><h3>COD</h3></div>
              <div className="kv"><span>COD to be remitted</span><b>{inr(d.cod_pending)}</b></div>
              <div className="kv"><span>Next remittance</span><b>{dShort(d.next_remittance)}</b></div></div>
            <div className="card"><div className="card-h"><h3>Wallet</h3></div>
              <div className="kv"><span>Balance</span><b>{inr(d.wallet, 2)}</b></div>
              <div className="kv"><span>Spent this month</span><b>{inr(d.spent_month, 2)}</b></div></div>
            <div className="card" style={{ background: 'var(--orange-soft)', borderColor: 'var(--orange-line)' }}>
              <h3 className="row" style={{ fontSize: 15 }}><Icon name="weight" style={{ color: 'var(--orange)' }} />Weight discrepancy ({d.wd_open})</h3>
              <p className="small" style={{ marginBottom: 0 }}>{d.wd_open ? <>Courier weight is higher than declared on {d.wd_open} shipment{d.wd_open > 1 ? 's' : ''}. Review and accept or raise dispute within the deadline. <Link className="link" href="/weight-discrepancy/">Review →</Link></> : 'No open weight discrepancies. Keep declaring accurate weight & size.'}</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
