'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export const LABEL_FORMATS = [['thermal', 'Thermal printer (4×6 in)'], ['a4-1', 'A4 · 1 label per sheet'], ['a4-2', 'A4 · 2 labels per sheet'], ['a4-4', 'A4 · 4 labels per sheet']];

/** "Label" button + adjacent download icon that opens print-format choices */
export default function LabelButton({ ids, small = true }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  const go = (fmt) => { setOpen(false); window.open(`/label/?id=${idStr}${fmt ? '&format=' + fmt : ''}`, '_blank'); };
  return (
    <span ref={ref} className="lblbtn" onClick={(e) => e.stopPropagation()}>
      <button className={'lb-main' + (small ? ' sm' : '')} onClick={() => go('')}>Label</button>
      <button className={'lb-dl' + (small ? ' sm' : '')} title="Download label — choose print format" onClick={() => setOpen(!open)}><Icon name="download" size={small ? 14 : 16} /></button>
      {open && (
        <span className="lb-menu">
          <span className="tiny muted" style={{ padding: '6px 12px', display: 'block' }}>Print format</span>
          {LABEL_FORMATS.map(([k, l]) => <button key={k} onClick={() => go(k)}><Icon name={k === 'thermal' ? 'print' : 'file'} size={14} />{l}</button>)}
        </span>
      )}
    </span>
  );
}
