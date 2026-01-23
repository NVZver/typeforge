'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, TrainingPlan } from '@/lib/types';
import { chatService } from '@/lib/chat-service';
import { trainingPlanService } from '@/lib/training-plan-service';
import { aiCoach } from '@/lib/ai-coach';
import { storage } from '@/lib/storage';

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [connected, setConnected] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState<{ sessions: number; avgWpm: number; bestWpm: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check connection status
  const checkConnection = useCallback(async () => {
    setChecking(true);
    const result = await aiCoach.testConnection();
    setConnected(result.success);
    setModelName(result.modelName || null);
    setChecking(false);
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [chatMessages, plan, data] = await Promise.all([
          chatService.loadMessages(),
          trainingPlanService.getTrainingPlan(),
          storage.load()
        ]);
        setMessages(chatMessages);
        setTrainingPlan(plan);

        // Calculate stats summary
        if (data.sessions.length > 0) {
          const recent = data.sessions.slice(-20);
          setStats({
            sessions: data.sessions.length,
            avgWpm: Math.round(recent.reduce((a, s) => a + s.wpm, 0) / recent.length),
            bestWpm: data.bestWpm
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    checkConnection();
    loadData();
  }, [checkConnection]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading || !connected || !trainingPlan) return;

    // Check for /system command
    const parsed = chatService.parseSystemCommand(text);
    if (parsed.isCommand && parsed.prompt) {
      try {
        await trainingPlanService.updateSystemPrompt(parsed.prompt);
        const updatedPlan = await trainingPlanService.getTrainingPlan();
        setTrainingPlan(updatedPlan);

        const systemMsg: ChatMessage = {
          id: Date.now(),
          role: 'system',
          content: `System prompt updated: "${parsed.prompt.substring(0, 50)}..."`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, systemMsg]);
        await chatService.addMessage('assistant', systemMsg.content);

        if (!messageText) setInput('');
        return;
      } catch (error) {
        console.error('Failed to update system prompt:', error);
        return;
      }
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput('');
    setIsLoading(true);

    try {
      await chatService.addMessage('user', text);

      const typingContext = await chatService.loadTypingContext(trainingPlan);
      const context = chatService.buildContext([...messages, userMessage], typingContext);
      const systemPrompt = trainingPlan.systemPrompt || 'You are an expert typing coach.';

      const response = await aiCoach.sendChatMessage(context, systemPrompt);

      if (response) {
        const assistantMessage: ChatMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMessage]);
        await chatService.addMessage('assistant', response);
      } else {
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Sorry, I could not process your message. Please check your LM Studio connection.',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, connected, trainingPlan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    try {
      await chatService.clearHistory();
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  return (
    <main className="coach-page">
      <div className="coach-header">
        <div className="coach-title">
          <h1>AI Coach</h1>
          <div className={`connection-badge ${connected ? 'connected' : ''}`}>
            <span className="connection-dot-small" />
            {checking ? 'Checking...' : connected ? modelName : 'Disconnected'}
          </div>
        </div>
        {stats && (
          <div className="coach-stats-summary">
            <span>{stats.sessions} sessions</span>
            <span className="divider">|</span>
            <span>{stats.avgWpm} avg WPM</span>
            <span className="divider">|</span>
            <span>{stats.bestWpm} best</span>
          </div>
        )}
      </div>

      {!connected && !checking && (
        <div className="coach-connection-warning">
          <p>Connect to LM Studio to chat with your AI coach.</p>
          <button onClick={checkConnection} className="btn btn-secondary">
            Retry Connection
          </button>
        </div>
      )}

      <div className="coach-chat">
        <div className="coach-messages">
          {messages.length === 0 ? (
            <div className="coach-empty">
              <h2>Welcome to your AI Typing Coach</h2>
              <p>I have access to your complete typing history and can help you improve.</p>
              <div className="coach-suggestions">
                <p>Try asking:</p>
                <ul>
                  <li>"How am I progressing?"</li>
                  <li>"What are my weakest keys?"</li>
                  <li>"Give me a practice plan for this week"</li>
                  <li>"Why is my accuracy dropping?"</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`coach-message coach-message-${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <div className="coach-message-content markdown-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="coach-message-content">{msg.content}</div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="coach-message coach-message-assistant">
              <div className="coach-message-content coach-loading">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="coach-input-area">
          <div className="coach-input-row">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? "Ask your coach anything..." : "Connect to LM Studio first"}
              disabled={!connected || isLoading}
              className="coach-input"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!connected || isLoading || !input.trim()}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
          <div className="coach-input-hints">
            <span>Press Enter to send</span>
            <button onClick={handleClearHistory} className="clear-link">
              Clear history
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
