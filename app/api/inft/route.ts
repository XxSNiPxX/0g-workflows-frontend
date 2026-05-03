import { NextRequest, NextResponse } from 'next/server';
import { getINFTContract } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json({ success: false, error: 'user param required' }, { status: 400 });
  try {
    const tokenId  = await getINFTContract().tokenIdOf(user);
    const id       = Number(tokenId);
    return NextResponse.json({ success: true, user, tokenId: id, hasMinted: id !== 0 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.shortMessage ?? e.message });
  }
}
