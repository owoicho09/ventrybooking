import type { PortableTextBlockLite } from '@/types';

const WORDS_PER_MINUTE = 200;

function getPlainText(blocks: PortableTextBlockLite[] | undefined, maxBlocks = Infinity): string {
  if (!blocks) return '';
  return blocks
    .filter((b) => b._type === 'block')
    .slice(0, maxBlocks)
    .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
    .join(' ')
    .trim();
}

export function getExcerpt(body: PortableTextBlockLite[] | undefined, maxLength = 160): string {
  const text = getPlainText(body, 3);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}

export function estimateReadTime(body: PortableTextBlockLite[] | undefined): number {
  const words = getPlainText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
