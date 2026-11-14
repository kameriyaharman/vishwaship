'use client';
import { useState } from 'react';
import { Stat, Chip, Spinner, ErrorBox, AsyncBtn, useLoad, PageHead } from '@/components/ui';
import { api, download, lakh, inr, dShort, monthLabel, months } from '@/lib/api';

const REPORTS = [['pl', 'Customer-wise P&L'], ['base_final', 'Base vs final rate'], ['zone', 'Zone-wise'], ['status', 'Status-wise'], ['rto', 'RTO %'], ['weight', 'Weight discrepancy'], ['cod', 'COD remittance'], ['wallet', 'Wallet ledger'], ['gst', 'GST invoice register']];

export default function Reports() {
  const [m, setM] = useState(months()[0]);
  const { data: d, err, reload } = useLoad(() => api('/admin/reports?month=' + m), [m]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const max = Math.max(1, ...d.trend.map((t) => t.billed));
  const mo = d.money;
  return (
    <>
      <PageHead title="Reports, Wallet & COD" sub="Revenue (final rate) vs Delhivery cost, margin trend, COD settlement — Excel export">
        <select className="select" style={{ width: 'auto', border: '1.5px solid var(--navy)', fontWeight: 600 }} value={m} onChange={(e) => setM(e.target.value)}>{months().map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select>
        <AsyncBtn onClick={() => download(`/admin/reports/export?type=pl&month=${m}`, `customer-pl-${m}.csv`)}>Download Excel</AsyncBtn>
      </PageHead>
      <div className="stats">
        <Stat plain icon="rupee" title={`Revenue (${monthLabel(m).slice(0, 3)})`} value={lakh(mo.billed)} sub={d.growth === null ? '—' : `${d.growth >= 0 ? '▲' : '▼'} ${Math.abs(d.growth)}%`} subCls={d.growth >= 0 ? 'green' : 'red'} />
        <Stat plain icon="truck" title="Delhivery cost" value={lakh(mo.cost)} sub=" " />
        <Stat plain icon="percent" title="Margin" value={lakh(mo.margin)} sub={`${mo.margin_pct}%`} subCls="green" />
        <Stat plain icon="wallet" title="COD to remit" value={lakh(d.cod_to_remit)} sub={`${d.cod_customers} customers`} subCls="orange" />
      </div>
      <div className="split-1-2 mt16" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="card">
          <div className="card-h"><h3>Revenue vs margin</h3></div>
          <div className="bars" style={{ height: 220 }}>
            {d.trend.map((t) => (
              <div key={t.month} className="b" title={`${monthLabel(t.month)}: revenue ${inr(t.billed)}, margin ${inr(t.margin)}`}>
                <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center' }}>
                  <i style={{ height: `${(t.billed / max) * 100}%`, maxWidth: 18 }} /><i style={{ height: `${(t.margin / max) * 100}%`, maxWidth: 18, background: 'var(--orange)' }} />
                </div><small>{t.label}</small>
              </div>
            ))}
          </div>
          <div className="row small mt12"><span className="row" style={{ gap: 4 }}><i style={{ width: 10, height: 10, background: '#cdd3ea', display: 'inline-block' }} />Revenue</span><span className="row" style={{ gap: 4 }}><i style={{ width: 10, height: 10, background: 'var(--orange)', display: 'inline-block' }} />Margin</span></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>COD remittance</h3></div>
          <table className="tbl"><thead><tr><th>Customer</th><th className="num">COD collected</th><th className="num">Received from Delhivery</th><th>Remit to customer</th><th>Status</th></tr></thead>
            <tbody>
              {d.cod_pending.map((r) => <tr key={'p' + r.user_id}><td>{r.customer}</td><td className="num">{inr(r.collected)}</td><td className="num">{inr(r.received)}</td><td>{dShort(d.next_remittance)}</td><td><Chip s="pending" label="Pending" /></td></tr>)}
              {d.cod_paid.map((r, i) => <tr key={'d' + i}><td>{r.customer}</td><td className="num">{inr(r.collected)}</td><td className="num">{inr(r.received)}</td><td>Paid {dShort(r.remit_date)}</td><td><Chip s="success" label="Success" /></td></tr>)}
            </tbody></table>
          <div className="pills mt16">{REPORTS.map(([k, l]) => <AsyncBtn key={k} className="pill" onClick={() => download(`/admin/reports/export?type=${k}&month=${m}`, `${k}-${m}.csv`)}>{l}</AsyncBtn>)}</div>
          <p className="tiny muted mt8">Click any report to download it as Excel (CSV) for {monthLabel(m)}.</p>
        </div>
      </div>
    </>
  );
}
