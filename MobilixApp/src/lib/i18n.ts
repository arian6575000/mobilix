import { D } from './dict';

export type { Lang } from '../db/types';
import type { Lang } from '../db/types';

export function translate(key: string, lang: Lang): string {
  const e = D[key];
  if (!e) return key;
  return e[lang === 'ur' ? 1 : 0] || e[0];
}
export type TFn = (key: string, lang?: Lang) => string;
