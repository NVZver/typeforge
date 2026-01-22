import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function GET() {
  try {
    const keyStats = db.getKeyStats();
    return NextResponse.json(keyStats);
  } catch (error) {
    console.error('Failed to get key stats:', error);
    return NextResponse.json({ error: 'Failed to get key stats' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const keyTimes = await request.json();
    db.addKeyStats(keyTimes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update key stats:', error);
    return NextResponse.json({ error: 'Failed to update key stats' }, { status: 500 });
  }
}
