import { WordEntry, WordProgress, wordKey } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PickOptions {
  library: string;
  count: number;
  knownCooldownDays: number;
  date?: Date;
}

export function pickDaily(
  entries: WordEntry[],
  progress: Record<string, WordProgress>,
  opts: PickOptions
): WordEntry[] {
  const date = opts.date ?? new Date();
  const now = date.getTime();
  const cooldownMs = opts.knownCooldownDays * DAY_MS;

  const pool = entries.filter(e => {
    const p = progress[wordKey(e.word)];
    if (!p) return true;
    if (p.status === 'known' && now - p.updatedAt < cooldownMs) return false;
    return true;
  });

  if (pool.length === 0) return [];

  const seed = hashString(`${opts.library}|${dateKey(date)}`);
  const rng = mulberry32(seed);

  const weighted = pool.map(e => {
    const p = progress[wordKey(e.word)];
    let w = 1.0;
    if (!p) w = 1.5;             // new words get a small boost
    else if (p.status === 'hard') w = 3.0; // hard words get strong priority
    else if (p.status === 'known') w = 0.3; // post-cooldown known: rare refresh
    return { entry: e, weight: w };
  });

  const picked: WordEntry[] = [];
  const remaining = [...weighted];
  const target = Math.min(opts.count, remaining.length);

  for (let i = 0; i < target; i++) {
    const total = remaining.reduce((s, w) => s + w.weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < remaining.length; idx++) {
      r -= remaining[idx].weight;
      if (r <= 0) break;
    }
    if (idx >= remaining.length) idx = remaining.length - 1;
    picked.push(remaining[idx].entry);
    remaining.splice(idx, 1);
  }

  return picked;
}

export function currentDateKey(): string {
  return dateKey(new Date());
}
