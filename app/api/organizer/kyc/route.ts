import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadFile(
  db: ReturnType<typeof getServerSupabase>,
  file: File,
  userId: string,
  prefix: string
): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) return null;
  if (file.size > MAX_SIZE) return null;
  const ext = file.name.split('.').pop();
  const path = `${userId}/${prefix}-${uuidv4()}.${ext}`;
  const buffer = await file.arrayBuffer();
  const { error } = await db.storage.from('kyc-documents').upload(path, buffer, { contentType: file.type });
  if (error) return null;
  return path;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const step = Number(formData.get('step'));
    const db = getServerSupabase();

    if (step === 1) {
      const govIdFile = formData.get('governmentId') as File | null;
      const selfieFile = formData.get('selfie') as File | null;

      if (!govIdFile || !selfieFile) {
        return NextResponse.json({ error: 'Both government ID and selfie are required' }, { status: 400 });
      }

      const govIdPath = await uploadFile(db, govIdFile, user.sub, 'gov-id');
      const selfiePath = await uploadFile(db, selfieFile, user.sub, 'selfie');

      if (!govIdPath || !selfiePath) {
        return NextResponse.json({ error: 'Invalid file type or size (max 5MB, images/PDF only)' }, { status: 400 });
      }

      await db.from('users').update({
        kyc_gov_id_path: govIdPath,
        kyc_selfie_path: selfiePath,
        kyc_step: 1,
      }).eq('id', user.sub);

      return NextResponse.json({ success: true, data: { step: 1, nextStep: 2 } });
    }

    if (step === 2) {
      const phone = formData.get('phone') as string;
      if (!phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

      await db.from('users').update({
        phone,
        kyc_phone_verified: true,
        kyc_step: 2,
      }).eq('id', user.sub);

      return NextResponse.json({ success: true, data: { step: 2, nextStep: 3 } });
    }

    if (step === 3) {
      const twitter = formData.get('twitter') as string;
      const instagram = formData.get('instagram') as string;
      const facebook = formData.get('facebook') as string;

      await db.from('users').update({
        kyc_social_twitter: twitter || null,
        kyc_social_instagram: instagram || null,
        kyc_social_facebook: facebook || null,
        kyc_step: 3,
      }).eq('id', user.sub);

      return NextResponse.json({ success: true, data: { step: 3, nextStep: 4 } });
    }

    if (step === 4) {
      const venueProofFile = formData.get('venueProof') as File | null;
      if (!venueProofFile) {
        return NextResponse.json({ error: 'Venue proof document required' }, { status: 400 });
      }

      const venuePath = await uploadFile(db, venueProofFile, user.sub, 'venue-proof');
      if (!venuePath) {
        return NextResponse.json({ error: 'Invalid file type or size' }, { status: 400 });
      }

      await db.from('users').update({
        kyc_venue_proof_path: venuePath,
        kyc_step: 4,
      }).eq('id', user.sub);

      return NextResponse.json({ success: true, data: { step: 4, nextStep: 5 } });
    }

    if (step === 5) {
      // Final submission
      const { data: org } = await db.from('users').select('kyc_step').eq('id', user.sub).single();
      if (!org || (org.kyc_step as number) < 4) {
        return NextResponse.json({ error: 'Please complete all previous steps first' }, { status: 400 });
      }

      await db.from('users').update({
        kyc_status: 'pending',
        kyc_submitted_at: new Date().toISOString(),
        kyc_step: 5,
      }).eq('id', user.sub);

      return NextResponse.json({ success: true, data: { step: 5, message: 'KYC submitted for review. You will hear back within 2-4 business days.' } });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/organizer/kyc error', err);
    return NextResponse.json({ error: 'KYC submission failed' }, { status: 500 });
  }
}
