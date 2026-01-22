'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, TrainingPlan } from '@/lib/types';
import { chatService } from '@/lib/chat-service';
import { trainingPlanService } from '@/lib/training-plan-service';
import { aiCoach } from '@/lib/ai-coach';

interface ChatInterfaceProps {
  connected: boolean;
  onSystemPromptChange?: () => void;
  onGenerateText?: (text: string) => void;
}

export function ChatInterface({ connected, onSystemPromptChange, onGenerateText }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history and training plan
  useEffect(() => {
    const loadData = async () => {
      try {
        const [chatMessages, plan] = await Promise.all([
          chatService.loadMessages(),
          trainingPlanService.getTrainingPlan()
        ]);
        setMessages(chatMessages);
        setTrainingPlan(plan);
      } catch (error) {
        console.error('Failed to load chat data:', error);
      }
    };
    loadData();
  }, []);

  // Reload training plan when it might have changed
  const reloadTrainingPlan = useCallback(async () => {
    try {
      const plan = await trainingPlanService.getTrainingPlan();
      setTrainingPlan(plan);
    } catch (error) {
      console.error('Failed to reload training plan:', error);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
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

        // Add system message to chat
        const systemMsg: ChatMessage = {
          id: Date.now(),
          role: 'system',
          content: `System prompt updated: "${parsed.prompt.substring(0, 50)}..."`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, systemMsg]);
        await chatService.addMessage('assistant', systemMsg.content);

        if (!messageText) setInput('');
        onSystemPromptChange?.();
        return;
      } catch (error) {
        console.error('Failed to update system prompt:', error);
        return;
      }
    }

    // Check for /generate command - ask AI to generate next practice text
    if (text.toLowerCase().trim() === '/generate') {
      if (!messageText) setInput('');
      setIsLoading(true);

      try {
        const typingContext = await chatService.loadTypingContext(trainingPlan);
        const generatePrompt = `Based on my typing metrics above, generate the next practice text for me.

Requirements:
- If mode is 'quotes': Write ONE memorable, inspiring quote (40-60 words)
- If mode is 'words': Write 30-40 practice words separated by spaces
- Focus on my weak keys and bigrams
- Match the difficulty level in my training plan
- Output ONLY the practice text, nothing else - no explanations, no quotes around it`;

        const context = chatService.buildContext([], typingContext);
        context.push({ role: 'user', content: generatePrompt });

        const systemPrompt = trainingPlan.systemPrompt || 'You are an expert typing coach.';
        const response = await aiCoach.sendChatMessage(context, systemPrompt);

        if (response) {
          // Clean the response and use it as practice text
          const cleanedText = response
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/^(Here'?s?|Practice text:|Text:)/i, '') // Remove common prefixes
            .trim();

          if (cleanedText && onGenerateText) {
            onGenerateText(cleanedText);

            const confirmMsg: ChatMessage = {
              id: Date.now(),
              role: 'assistant',
              content: `New practice text generated and loaded.`,
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, confirmMsg]);
          }
        }
      } catch (error) {
        console.error('Failed to generate text:', error);
      } finally {
        setIsLoading(false);
      }
      return;
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
      // Save user message
      await chatService.addMessage('user', text);

      // Load typing context and build full context
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
        // Show error message
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
  }, [input, messages, isLoading, connected, trainingPlan, onSystemPromptChange, onGenerateText]);

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
    <div className="chat-interface">
      <div className="chat-header">
        <h3>AI Coach</h3>
        <div className="chat-actions">
          <span className="chat-hint">Type /system [prompt] to change AI behavior</span>
          <button onClick={handleClearHistory} className="clear-chat-btn" title="Clear chat history">
            Clear
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>Start a conversation with your AI typing coach!</p>
            <p className="chat-suggestions">
              Try: "How can I improve my typing speed?" or "What are my weakest keys?"
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              {msg.role === 'assistant' ? (
                <div className="chat-message-content markdown-content">
                  <ReactMarkdown skipHtml>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="chat-message-content">{msg.content}</div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-content chat-loading">
              <span className="loading-dot"></span>
              <span className="loading-dot"></span>
              <span className="loading-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? "Type a message..." : "Connect to LM Studio to chat"}
          disabled={!connected || isLoading}
          className="chat-input"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!connected || isLoading || !input.trim()}
          className="chat-send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}
