import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function DELETE() {
  try {
    db.clearAllData();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear data:', error);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
