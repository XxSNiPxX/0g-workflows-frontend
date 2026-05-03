import { NextResponse } from 'next/server';
import { getProvider, CONTRACTS, GALILEO_CHAINID, RPC_URL } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const provider    = getProvider();
    const network     = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    return NextResponse.json({
      success: true, chainId: Number(network.chainId),
      expected: GALILEO_CHAINID, blockNumber, rpcUrl: RPC_URL, contracts: CONTRACTS,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.shortMessage ?? e.message });
  }
}
