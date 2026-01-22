import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function GET() {
  try {
    const sessions = db.getAllSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return NextResponse.json({ error: 'Failed to get sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await request.json();
    db.addSession(session);

    // Update best WPM if needed
    const currentBest = db.getBestWpm();
    if (session.wpm > currentBest) {
      db.updateBestWpm(session.wpm);
    }

    return NextResponse.json({
      success: true,
      bestWpm: Math.max(currentBest, session.wpm)
    });
  } catch (error) {
    console.error('Failed to add session:', error);
    return NextResponse.json({ error: 'Failed to add session' }, { status: 500 });
  }
}
