import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function GET() {
  try {
    const sessions = db.getAllSessions();
    const keyStats = db.getKeyStats();
    const bigramStats = db.getBigramStats();
    const settings = db.getSettings();
    const bestWpm = db.getBestWpm();

    return NextResponse.json({
      sessions,
      keyStats,
      bigramStats,
      bestWpm,
      dailyGoal: settings.dailyGoal,
      settings
    });
  } catch (error) {
    console.error('Failed to get data:', error);
    return NextResponse.json({ error: 'Failed to get data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = db.importData(data);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to import data:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
