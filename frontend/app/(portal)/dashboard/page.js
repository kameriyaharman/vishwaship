'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useShell } from '@/components/Shell';
import { Stat, Chip, Spinner, ErrorBox, useLoad } from '@/components/ui';
import { api, inr, kg, dLong, dShort, qp, lakh } from '@/lib/api';
import MobileHome from '@/components/MobileHome';

const RANGES = { today: 'Today', week: 'Last 7 days', month: 'This month', last_month: 'Last month', all: 'All time' };

export default function Dashboard() {
  const { me } = useShell();
  const [range, setRange] = useState('month');
  const [tab, setTab] = useState('overview');
  useEffect(() => { if (qp('tab') === 'status') setTab('status'); }, []);
  const { data: d, err, reload } = useLoad(() => api('/me/dashboard?range=' + range), [range]);
  const max = d ? Math.max(1, ...d.chart.map((x) => x.n)) : 1;
  const c = d?.range_counts;
  const L = d?.live;

  return (
    <>
      {d && <div className="show-sm"><MobileHome d={d} me={me} /></div>}
      <div className={d ? 'hide-sm' : ''}>
      <div className="ph">
        <div><h1>Dashboard</h1><p>Hi {me.name.split(' ')[0]} 👋 — your shipments at a glance · {dLong(new Date().toISOString())}</p></div>
        <select className="select btn-outline" style={{ width: 'auto', fontWeight: 600, border: '1.5px solid var(--navy)' }} value={range} onChange={(e) => setRange(e.target.value)}>
          {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="seg mb16"><button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'status' ? 'on' : ''} onClick={() => setTab('status')}>Order Status</button></div>
      {tab === 'status' ? <OrderStatus /> : <>
      <ErrorBox err={err} onRetry={reload} />
      {!d ? <Spinner /> : (
        <>
          {me.kyc_status !== 'verified' && (
            <div className="card mb12 row between wrap" style={{ background: 'var(--orange-soft)', borderColor: 'var(--orange-line)' }}>
              {me.kyc_status === 'submitted'
                ? <span className="row"><Icon name="clock" style={{ color: 'var(--orange)' }} /> <b>KYC pending approval</b> <span className="small muted">— our team is reviewing your documents.</span></span>
                : <span className="row"><Icon name="alert" style={{ color: 'var(--orange)' }} /> <b>{me.kyc_status === 'rejected' ? 'KYC rejected — please re-submit' : 'Complete your KYC'}</b> <span className="small muted">— Aadhaar, PAN, cancelled cheque & bank details.</span></span>}
              <Link href="/settings/?tab=kyc" className="btn btn-orange btn-sm">{me.kyc_status === 'submitted' ? 'View status' : 'Complete KYC'}</Link>
            </div>
          )}
          <div className="stats">
            <Stat href="/shipments/" icon="box" title="Total shipments" value={c.all.toLocaleString('en-IN')} sub={`all time ${L.all.toLocaleString('en-IN')}`} color="navy" />
            <Stat href="/shipments/?tab=pickup_pending" icon="clock" title="Pickup pending" value={L.pickup_pending} sub={`pickup today ${d.pickup_today}`} color="yellow" />
            <Stat href="/shipments/?tab=in_transit_all" icon="truck" title="In transit" value={L.in_transit + L.picked_up} sub="live" color="blue" />
            <Stat href="/shipments/?tab=out_for_delivery" icon="truck" title="Out for delivery" value={L.out_for_delivery} sub="live" color="purple" />
            <Stat href="/shipments/?tab=delivered" icon="check" title="Delivered" value={c.delivered.toLocaleString('en-IN')} sub={`${d.delivered_pct}%`} color="green" />
            <Stat href="/shipments/?tab=rto" icon="undo" title="RTO" value={c.rto} sub={`${d.rto_pct}%`} color="red" />
            <Stat href="/ndr/" icon="alert" title="NDR (action needed)" value={d.ndr_open} sub="re-attempt / RTO" color="orange" />
            <Stat href="/weight-discrepancy/" icon="weight" title="Weight discrepancy" value={d.wd_open} sub={`${inr(d.wd_amount)} extra · view`} color="orange" />
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
                        <td className="hide-sm">{kg(s.chargeable_weight)}</td><td><Chip s={s.status_key} label={s.status_label} /></td><td className="num">{inr(s.total)}</td>
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
      </>}
      </div>
    </>
  );
}

function OrderStatus() {
  const { data: d, err, reload } = useLoad(() => api('/me/dashboard/status'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const c = d.counts;
  const link = (tab) => `/shipments/?from=${d.from}&to=${d.to}${tab ? '&tab=' + tab : ''}`;
  const tiles = [['Total Shipments', c.total, '', 'box', 'navy'], ['Pickup Pending', c.pickup_pending, 'pickup_pending', 'clock', 'yellow'], ['In Transit', c.in_transit, 'in_transit_all', 'truck', 'blue'],
    ['Delivered', c.delivered, 'delivered', 'check', 'green'], ['Undelivered', c.undelivered, 'undelivered', 'alert', 'orange'], ['RTO', c.rto, 'rto', 'undo', 'red'], ['Lost', c.lost, 'lost', 'x', 'purple']];
  const R = d.revenue;
  return (
    <>
      <div className="split" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="card" style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' }}>
          <div className="small" style={{ color: '#b9c3d4' }}>Today’s Orders</div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: '6px 0' }}>{d.today.orders}</div>
          <div className="small" style={{ color: '#cfd6e4' }}>Order value {inr(d.today.value)}</div>
          <div className="row mt12" style={{ gap: 16, fontSize: 13 }}><span>Prepaid <b>{d.today.prepaid}</b></span><span>COD <b>{d.today.cod}</b></span><span>Pickup pending <b>{d.today.pickup_pending}</b></span></div>
          <Link href="/book/" className="btn btn-orange btn-sm mt16">+ Book shipment</Link>
        </div>
        <div className="card">
          <div className="card-h"><h3>Shipment Details</h3><span className="small muted">Last 30 days · {dShort(d.from)} – {dShort(d.to)}</span></div>
          <div className="grid4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {tiles.map(([l, n, t, ic, col]) => (
              <Link key={l} href={link(t)} className={'stat bl-' + col} style={{ display: 'block' }} title={`Open ${l.toLowerCase()} shipments`}>
                <div className="t"><Icon name={ic} size={14} />{l}</div><div className="v">{n}</div><div className="s link small">View →</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="card mt16">
        <div className="card-h"><h3>Revenue <span className="small muted">(order value of shipments booked)</span></h3></div>
        <div className="grid4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {[['Today’s Revenue', R.today], ['This Week', R.week], ['This Month', R.month], ['Last 90 Days', R.days90], ['This Year', R.year]].map(([l, v]) => (
            <div key={l} className="stat plain"><div className="t">{l}</div><div className="v" style={{ fontSize: 22 }}>{lakh(v)}</div></div>
          ))}
        </div>
      </div>
      <Link href="/billing/?view=cod" className="card mt16 row between" style={{ background: 'var(--orange-soft)', borderColor: 'var(--orange-line)' }}>
        <span className="row"><Icon name="rupee" style={{ color: 'var(--orange)' }} /><span><b>COD Remittance</b><div className="small muted">Due {inr(d.cod_due)} · next remittance {dShort(d.next_remittance)}</div></span></span>
        <span className="link">Open →</span>
      </Link>
    </>
  );
}
