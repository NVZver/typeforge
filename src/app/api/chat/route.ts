import { NextResponse } from 'next/server';
import * as db from '@/lib/database';

export async function GET() {
  try {
    const messages = db.getChatMessages(50);
    // Reverse to get chronological order (oldest first)
    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return NextResponse.json({ error: 'Failed to get chat messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { role, content } = await request.json();

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }

    db.addChatMessage(role, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to add chat message:', error);
    return NextResponse.json({ error: 'Failed to add chat message' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    db.clearChatHistory();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear chat history:', error);
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}
