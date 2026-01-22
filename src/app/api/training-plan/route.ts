import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function GET() {
  try {
    const plan = db.getTrainingPlan();
    return NextResponse.json(plan);
  } catch (error) {
    console.error('Failed to get training plan:', error);
    return NextResponse.json({ error: 'Failed to get training plan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'increment') {
      const newCount = db.incrementSessionCount();
      return NextResponse.json({ sessionsSinceUpdate: newCount });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update training plan:', error);
    return NextResponse.json({ error: 'Failed to update training plan' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const updates = await request.json();
    db.updateTrainingPlan(updates);
    const plan = db.getTrainingPlan();
    return NextResponse.json(plan);
  } catch (error) {
    console.error('Failed to update training plan:', error);
    return NextResponse.json({ error: 'Failed to update training plan' }, { status: 500 });
  }
}
