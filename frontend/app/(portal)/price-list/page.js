'use client';
import Link from 'next/link';
import { Spinner, ErrorBox, useLoad, PageHead } from '@/components/ui';
import { api, inr } from '@/lib/api';

export default function PriceList() {
  const { data: d, err, reload } = useLoad(() => api('/me/price-list'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title="Shipment Price List" sub="Your final rates per zone (before GST) — these are the prices you are charged"><Link href="/rate-calculator/" className="btn btn-orange">Rate calculator</Link></PageHead>
      {['surface', 'express'].map((svc) => {
        const rows = d.items.filter((r) => r.service === svc);
        if (!rows.length) return null;
        return (
          <div key={svc} className="card p0 tbl-wrap mb16">
            <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Delhivery {svc === 'surface' ? 'Surface' : 'Express (Air)'} <span className="small muted">· {d.services[svc]?.days}</span></h3>{rows[0].disabled && <span className="chip c-cancelled">Disabled in Manage Courier</span>}</div>
            <table className="tbl"><thead><tr><th>Zone</th><th className="num">First 500 g</th><th className="num">Every addl. 500 g</th><th className="num">1 kg</th><th className="num">2 kg</th><th className="num">5 kg</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.zone}><td className="b">Zone {r.zone} <span className="muted small">· {r.zone_label}</span></td><td className="num">{inr(r.first_500)}</td><td className="num">{inr(r.add_500)}</td><td className="num">{inr(r.kg1)}</td><td className="num">{inr(r.kg2)}</td><td className="num">{inr(r.kg5)}</td></tr>)}</tbody></table>
          </div>
        );
      })}
      <div className="card">
        <div className="kv"><span>COD charges</span><b>{inr(d.cod_fixed)} or {d.cod_pct}% of COD amount, whichever is higher</b></div>
        <div className="kv"><span>Volumetric weight</span><b>L × B × H (cm) ÷ {d.vol_divisor}</b></div>
        <div className="kv"><span>GST</span><b>{d.gst_pct}% extra</b></div>
        <div className="kv"><span>Zones</span><b>A same city · B same region · C metro to metro · D rest of India · E North-East & J&K</b></div>
      </div>
    </>
  );
}
