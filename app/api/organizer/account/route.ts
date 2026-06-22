import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { password } = await req.json() as { password?: string };
    if (!password) {
      return NextResponse.json({ error: 'Password is required to confirm deletion' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data: userData } = await db
      .from('users')
      .select('password_hash')
      .eq('id', user.sub)
      .single();

    if (!userData || !verifyPassword(password, userData.password_hash)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
    }

    // Block deletion if they have live or pending events
    const { data: activeEvents } = await db
      .from('events')
      .select('id')
      .eq('organizer_id', user.sub)
      .in('status', ['approved', 'under_review'])
      .limit(1);

    if (activeEvents && activeEvents.length > 0) {
      return NextResponse.json({
        error: 'You have active or pending events. Cancel or complete them before deleting your account.',
      }, { status: 400 });
    }

    // Fetch all event IDs belonging to this organizer
    const { data: orgEvents } = await db
      .from('events')
      .select('id')
      .eq('organizer_id', user.sub);

    const eventIds = (orgEvents ?? []).map(e => e.id as string);

    if (eventIds.length > 0) {
      // Fetch ticket IDs so we can delete complaints that reference them
      const { data: orgTickets } = await db
        .from('tickets')
        .select('id')
        .in('event_id', eventIds);

      const ticketIds = (orgTickets ?? []).map(t => t.id as string);

      // complaints -> tickets (FK with no cascade)
      if (ticketIds.length > 0) {
        const { error } = await db.from('complaints').delete().in('ticket_id', ticketIds);
        if (error) return NextResponse.json({ error: 'Failed to remove complaint records' }, { status: 500 });
      }

      // scan_logs -> events and scan_logs -> staff_ids (both covered by event_id)
      const { error: scanErr } = await db.from('scan_logs').delete().in('event_id', eventIds);
      if (scanErr) return NextResponse.json({ error: 'Failed to remove scan records' }, { status: 500 });

      // pending_orders -> events (nullable FK, clean up anyway)
      const { error: orderErr } = await db.from('pending_orders').delete().in('event_id', eventIds);
      if (orderErr) return NextResponse.json({ error: 'Failed to remove pending orders' }, { status: 500 });

      // tickets -> events (FK with no cascade)
      const { error: ticketErr } = await db.from('tickets').delete().in('event_id', eventIds);
      if (ticketErr) return NextResponse.json({ error: 'Failed to remove ticket records' }, { status: 500 });

      // payouts -> events (FK with no cascade)
      const { error: payoutErr } = await db.from('payouts').delete().in('event_id', eventIds);
      if (payoutErr) return NextResponse.json({ error: 'Failed to remove payout records' }, { status: 500 });

      // staff_ids -> events and staff_ids -> users (both covered by organizer_id)
      const { error: staffErr } = await db.from('staff_ids').delete().eq('organizer_id', user.sub);
      if (staffErr) return NextResponse.json({ error: 'Failed to remove staff IDs' }, { status: 500 });

      // events -- ticket_tiers cascade from here automatically
      const { error: eventErr } = await db.from('events').delete().eq('organizer_id', user.sub);
      if (eventErr) return NextResponse.json({ error: 'Failed to remove event records' }, { status: 500 });
    } else {
      // No events -- clean up any orphaned staff_ids
      await db.from('staff_ids').delete().eq('organizer_id', user.sub);
    }

    // Delete user -- notifications cascade automatically via ON DELETE CASCADE
    const { error: userErr } = await db.from('users').delete().eq('id', user.sub);
    if (userErr) {
      console.error('User delete failed:', userErr);
      return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 });
    }

    // Clear auth cookie
    const res = NextResponse.json({ success: true });
    res.cookies.set({
      name: 'ventry_token',
      value: '',
      httpOnly: true,
      maxAge: 0,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('DELETE /api/organizer/account error', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
