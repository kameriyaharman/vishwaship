'use client';
import { useEffect, useState, useCallback } from 'react';
import Icon from './Icon';
import { STATUS } from '@/lib/api';

export function Logo({ dark = false, size = 'md', brand }) {
  const fs = size === 'sm' ? 15 : size === 'lg' ? 22 : 18;
  const b = brand?.brand_name || 'vishwaship';
  const split = b.toLowerCase() === 'vishwaship' ? ['vishwa', 'ship'] : [b, ''];
  return (
    <span className="row" style={{ gap: 8 }}>
      <span style={{ width: fs + 8, height: fs + 8, borderRadius: 7, background: 'var(--orange)', display: 'grid', placeItems: 'center', color: '#fff' }}>
        <Icon name="box" size={fs - 2} sw={2.2} />
      </span>
      <span style={{ fontWeight: 700, fontSize: fs, letterSpacing: '-0.02em', color: dark ? 'var(--navy)' : '#fff' }}>
        {split[0]}<span style={{ color: 'var(--orange)' }}>{split[1]}</span>
        <span style={{ fontSize: fs * 0.62 }}>{brand?.brand_suffix ?? '.com'}</span>
      </span>
    </span>
  );
}

export function Chip({ s, label, cls }) {
  return <span className={'chip c-' + (cls || s)}>{label || STATUS[s] || (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '')}</span>;
}

export function Stat({ icon, title, value, sub, subCls, color, plain }) {
  return (
    <div className={'stat ' + (plain ? 'plain' : 'bl-' + (color || 'navy'))}>
      <div className="t">{icon && <Icon name={icon} size={14} />}{title}</div>
      <div className="v">{value}</div>
      {sub !== undefined && <div className={'s ' + (subCls || '')}>{sub}</div>}
    </div>
  );
}

export function Spinner() { return <div className="spinner" />; }

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <div className="row between mb12"><h3 style={{ margin: 0 }}>{title}</h3><button className="link-navy" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

// global toast
let pushToast = null;
export function toast(msg, err = false) { pushToast?.({ msg, err, id: Date.now() }); }
export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { pushToast = setT; return () => { pushToast = null; }; }, []);
  useEffect(() => { if (!t) return; const x = setTimeout(() => setT(null), 3200); return () => clearTimeout(x); }, [t]);
  return t ? <div className={'toast' + (t.err ? ' err' : '')}>{t.msg}</div> : null;
}

/** Fetch helper hook: const { data, err, loading, reload } = useLoad(fn, deps) */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, err: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try { const d = await fn(); setState({ data: d, err: null, loading: false }); }
    catch (e) { setState({ data: null, err: e.message, loading: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function Field({ label, children, hint }) {
  return <div className="field">{label && <label>{label}</label>}{children}{hint && <span className="tiny muted">{hint}</span>}</div>;
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="ph">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function Empty({ children }) { return <div className="empty">{children || 'Nothing here yet.'}</div>; }

export function ErrorBox({ err, onRetry }) {
  if (!err) return null;
  return <div className="err row between">{err}{onRetry && <button className="link" onClick={onRetry}>Retry</button>}</div>;
}

/** Async button: shows busy state and toasts errors */
export function AsyncBtn({ onClick, children, className = 'btn btn-orange', confirmText, ...rest }) {
  const [busy, setBusy] = useState(false);
  return (
    <button {...rest} className={className} disabled={busy || rest.disabled} onClick={async (e) => {
      if (confirmText && !window.confirm(confirmText)) return;
      setBusy(true);
      try { await onClick(e); } catch (er) { toast(er.message, true); } finally { setBusy(false); }
    }}>{busy ? 'Please wait…' : children}</button>
  );
}
