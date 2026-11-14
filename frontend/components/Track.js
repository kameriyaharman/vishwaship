'use client';
import Icon from './Icon';
import { dTime } from '@/lib/api';

const STEPS = [['pickup_pending', 'Booked'], ['picked_up', 'Picked up'], ['in_transit', 'In transit'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered']];
const IDX = { pickup_pending: 0, picked_up: 1, in_transit: 2, ndr: 3, out_for_delivery: 3, delivered: 4, rto_in_transit: 2, rto_delivered: 2, cancelled: 0 };

export function ProgressBar({ status }) {
  const i = IDX[status] ?? 0;
  return (
    <div className="progress">
      {STEPS.map(([k, l], n) => <div key={k} className={(n <= i && status !== 'cancelled' ? 'on' : '') + (n === i ? ' cur' : '')}><i />{l}</div>)}
    </div>
  );
}

export function Timeline({ events }) {
  if (!events?.length) return <div className="muted small">No tracking updates yet.</div>;
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <div className="tl-item" key={e.id || i}>
          <span className={'tl-dot' + (i === 0 ? ' cur' : '')}><Icon name="check" size={11} sw={3} /></span>
          <div><b>{e.label}</b><span>{[e.location, dTime(e.event_time)].filter(Boolean).join(' · ')}</span>{e.remark && <div className="tiny muted">{e.remark}</div>}</div>
        </div>
      ))}
    </div>
  );
}
