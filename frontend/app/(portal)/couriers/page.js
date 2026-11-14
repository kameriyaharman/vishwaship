'use client';
import { Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import Icon from '@/components/Icon';
import { api } from '@/lib/api';
import { useConfig } from '@/lib/config';

export default function Couriers() {
  const cfg = useConfig();
  const { data: d, err, reload } = useLoad(() => api('/me/prefs'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d || !cfg) return <Spinner />;
  const dis = d.prefs.disabled_services || [];
  const list = [['surface', 'Delhivery Surface', cfg.services.surface?.days, 'Best price for most parcels'], ['express', 'Delhivery Express (Air)', cfg.services.express?.days, 'Fastest — air network to metros & major cities']];
  return (
    <>
      <PageHead title="Manage Courier" sub="Choose which courier services appear when you book. Auto-assign rules pick between the enabled ones." />
      <div className="grid2">
        {list.filter(([k]) => cfg.service_enabled[k]).map(([k, n, days, desc]) => {
          const on = !dis.includes(k);
          return (
            <div key={k} className="card">
              <div className="row between"><span className="row"><span className="feat"><span className="ic" style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--orange-soft)', color: 'var(--orange)', display: 'grid', placeItems: 'center' }}><Icon name={k === 'express' ? 'bolt' : 'truck'} /></span></span><div><b>{n}</b><div className="tiny muted">{days} · {desc}</div></div></span>
                <span className={'chip c-' + (on ? 'active' : 'cancelled')}>{on ? 'Enabled' : 'Disabled'}</span></div>
              <AsyncBtn className={'btn btn-sm mt16 ' + (on ? 'btn-outline' : 'btn-orange')} onClick={async () => {
                const next = on ? [...dis, k] : dis.filter((x) => x !== k);
                await api('/me/prefs', { method: 'PUT', body: { disabled_services: next } }); toast(on ? 'Service disabled' : 'Service enabled'); reload();
              }}>{on ? 'Disable' : 'Enable'}</AsyncBtn>
            </div>
          );
        })}
      </div>
      <p className="small muted mt16">More courier partners (Blue Dart, DTDC, Xpressbees, Ekart…) will appear here as Vishwaship adds them.</p>
    </>
  );
}
