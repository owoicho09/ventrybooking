import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify, isReservedSlug } from '@/lib/slug';

/**
 * Generates a unique event slug from a title: kebab-case, blocklist-checked,
 * with a -2/-3 suffix on collision (including a collision with a reserved
 * route name, which is treated the same as a taken slug). Event slugs and
 * organiser handles share one flat URL namespace (ventrybooking.com/wildout
 * vs ventrybooking.com/bryanmoore, both bare top-level paths), so a
 * candidate is only accepted once it's confirmed free in *both* tables.
 */
export async function generateEventSlug(db: SupabaseClient, title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;

  while (true) {
    if (!isReservedSlug(candidate)) {
      const [{ data: eventMatch }, { data: handleMatch }] = await Promise.all([
        db.from('events').select('id').eq('slug', candidate).maybeSingle(),
        db.from('users').select('id').eq('handle', candidate).maybeSingle(),
      ]);
      if (!eventMatch && !handleMatch) return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
