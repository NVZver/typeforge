import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function GET() {
  try {
    const bigramStats = db.getBigramStats();
    return NextResponse.json(bigramStats);
  } catch (error) {
    console.error('Failed to get bigram stats:', error);
    return NextResponse.json({ error: 'Failed to get bigram stats' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const bigramTimes = await request.json();
    db.addBigramStats(bigramTimes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update bigram stats:', error);
    return NextResponse.json({ error: 'Failed to update bigram stats' }, { status: 500 });
  }
}
