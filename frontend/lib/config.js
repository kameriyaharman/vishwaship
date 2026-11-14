'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

let cache = null; let pending = null;
export function loadConfig(force) {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending || force) pending = api('/public/config').then((c) => { cache = c; return c; }).finally(() => { pending = null; });
  return pending;
}
export function useConfig() {
  const [c, setC] = useState(cache);
  useEffect(() => { loadConfig().then(setC).catch(() => {}); }, []);
  return c;
}
