'use client';
import { useState } from 'react';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { useShell } from '@/components/Shell';
import { api, dShort } from '@/lib/api';

const LABEL = { dashboard: 'Dashboard', customers: 'Customers', shipments: 'Shipments', disputes: 'Weight disputes', ndr: 'NDR / RTO', rates: 'Rates & markup', wallet: 'Wallet, COD & invoices', reports: 'Reports', delhivery: 'Delhivery API', staff: 'Staff & roles', content: 'Website content & settings', support: 'Support' };

export default function Staff() {
  const { me } = useShell();
  const { data: d, err, reload } = useLoad(() => api('/admin/staff'), []);
  const [edit, setEdit] = useState(null);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title="Staff & Roles" sub="Admins have full access. Staff see only the sections you tick."><button className="btn btn-orange" onClick={() => setEdit({ role: 'staff', permissions: ['dashboard', 'shipments', 'ndr', 'support'] })}>+ Add staff</button></PageHead>
      <div className="card p0 tbl-wrap">
        <table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th><th>Status</th><th>Last login</th><th></th></tr></thead>
          <tbody>{d.items.map((u) => (
            <tr key={u.id}><td className="b">{u.name}{u.id === me.id && <span className="tiny muted"> (you)</span>}</td><td>{u.email}</td><td>{u.staff_role || u.role}</td>
              <td className="small">{u.role === 'admin' ? 'Full access' : u.permissions.map((p) => LABEL[p]).join(', ') || '—'}</td>
              <td><Chip s={u.status} /></td><td>{dShort(u.last_login)}</td>
              <td className="right"><button className="link-navy small" onClick={() => setEdit(u)}>Edit</button>{u.id !== me.id && <> · <AsyncBtn className="link-navy small" confirmText={`Delete ${u.name}?`} onClick={async () => { await api('/admin/staff/' + u.id, { method: 'DELETE' }); reload(); }}>Delete</AsyncBtn></>}</td></tr>
          ))}</tbody></table>
      </div>
      <div className="card mt16">
        <div className="card-h"><h3>Demo data</h3></div>
        <p className="small muted">The portal was installed with sample customers and shipments so you can see every screen working. Remove them before going live.</p>
        <AsyncBtn className="btn btn-red" confirmText="Delete ALL demo customers, their shipments, wallet history and API logs? This cannot be undone." onClick={async () => { const r = await api('/admin/demo/clear', { method: 'POST' }); toast(`Removed ${r.removed} demo customers`); }}>Remove demo data</AsyncBtn>
      </div>
      {edit && <StaffForm u={edit} sections={d.sections} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function StaffForm({ u, sections, onClose, onDone }) {
  const isNew = !u.id;
  const [f, setF] = useState({ name: u.name || '', email: u.email || '', mobile: u.mobile || '', role: u.role || 'staff', staff_role: u.staff_role || '', permissions: u.permissions || [], password: '', status: u.status || 'active' });
  const toggle = (p) => setF({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] });
  return (
    <Modal title={isNew ? 'Add staff' : 'Edit ' + u.name} onClose={onClose}>
      <div className="col">
        <div className="grid2">
          <div className="field"><label>Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>Email</label><input className="input" value={f.email} disabled={!isNew} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label>Access</label><select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="staff">Staff (limited)</option><option value="admin">Admin (full)</option></select></div>
          <div className="field"><label>Title</label><input className="input" placeholder="Operations, Finance…" value={f.staff_role} onChange={(e) => setF({ ...f, staff_role: e.target.value })} /></div>
          <div className="field"><label>{isNew ? 'Password' : 'New password (optional)'}</label><input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          {!isNew && <div className="field"><label>Status</label><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>active</option><option>blocked</option></select></div>}
        </div>
        {f.role === 'staff' && <div><div className="lbl mb8">Sections this staff can access</div><div className="grid2">{sections.map((s) => <label key={s} className="check"><input type="checkbox" checked={f.permissions.includes(s)} onChange={() => toggle(s)} />{LABEL[s]}</label>)}</div></div>}
        <AsyncBtn onClick={async () => { const b = { ...f }; if (!b.password) delete b.password; await api(isNew ? '/admin/staff' : '/admin/staff/' + u.id, { method: isNew ? 'POST' : 'PUT', body: b }); toast('Saved'); onDone(); }}>Save</AsyncBtn>
      </div>
    </Modal>
  );
}
