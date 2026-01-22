'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TextDisplay } from '@/components/typing/TextDisplay';
import { TypingInput } from '@/components/typing/TypingInput';
import { LiveStats } from '@/components/typing/LiveStats';
import { Timer } from '@/components/typing/Timer';
import { ConnectionStatusBanner } from '@/components/ai/ConnectionStatusBanner';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { TypingEngine } from '@/lib/typing-engine';
import { storage } from '@/lib/storage';
import { textGenerator } from '@/lib/text-generator';
import { aiCoach } from '@/lib/ai-coach';
import { trainingPlanService } from '@/lib/training-plan-service';
import { useAppStore } from '@/store/app-store';
import { TypingStats, Session, TrainingPlan } from '@/lib/types';

export default function TypingPage() {
  const engineRef = useRef(new TypingEngine());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [stats, setStats] = useState<TypingStats>({
    wpm: 0,
    accuracy: 100,
    errors: 0,
    characters: 0,
    elapsed: 0,
    complete: false
  });
  const [hasError, setHasError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bestWpm, setBestWpm] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);

  const showNotification = useAppStore((state) => state.showNotification);

  // Time limit fixed at 60 seconds
  const timeLimit = 60;

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, plan] = await Promise.all([
          storage.load(),
          trainingPlanService.getTrainingPlan()
        ]);
        setBestWpm(data.bestWpm);
        setTrainingPlan(plan);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const generateText = useCallback(async () => {
    if (!connected) {
      showNotification('Connect to LM Studio to start typing', '');
      return;
    }

    stopTimer();
    engineRef.current.reset();
    setIsLoading(true);

    let plan = trainingPlan;
    if (!plan) {
      try {
        plan = await trainingPlanService.getTrainingPlan();
        setTrainingPlan(plan);
      } catch (error) {
        console.error('Failed to load training plan:', error);
        setIsLoading(false);
        return;
      }
    }

    let newText: string | null = null;

    // Try AI generation first
    try {
      newText = await aiCoach.generatePracticeTextWithPlan(plan);
    } catch (error) {
      console.error('AI generation failed:', error);
    }

    // Fallback to local generation if AI fails
    if (!newText) {
      if (plan.practiceMode === 'quotes') {
        newText = textGenerator.getQuote();
      } else {
        newText = textGenerator.getWeaknessText(
          plan.weakKeys,
          plan.weakBigrams,
          30
        );
      }
      showNotification('Using local text (AI unavailable)', '');
    }

    engineRef.current.setText(newText);
    setStats({ wpm: 0, accuracy: 100, errors: 0, characters: 0, elapsed: 0, complete: false });
    setRefreshKey(k => k + 1);
    setIsLoading(false);
  }, [connected, trainingPlan, stopTimer, showNotification]);

  // Generate text when connected and have training plan
  useEffect(() => {
    if (connected && trainingPlan && !engineRef.current.getText()) {
      generateText();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, trainingPlan]);

  const completeSession = useCallback(async () => {
    stopTimer();
    const currentStats = engineRef.current.getStats();

    if (currentStats.characters < 5) return;

    const session: Session = {
      wpm: currentStats.wpm,
      accuracy: currentStats.accuracy,
      errors: currentStats.errors,
      characters: currentStats.characters,
      mode: trainingPlan?.practiceMode || 'words',
      textType: trainingPlan?.practiceMode || 'words',
      timestamp: Date.now()
    };

    try {
      const data = await storage.addSession(session);
      await storage.updateKeyStats(engineRef.current.getKeyTimes());
      await storage.updateBigramStats(engineRef.current.getBigramTimes());

      setBestWpm(data.bestWpm);

      // Increment session count and check if we need to update training plan
      const newCount = await trainingPlanService.incrementSessionCount();

      if (trainingPlanService.shouldUpdatePlan(newCount)) {
        // Generate new training plan every 5 sessions
        const newPlan = await trainingPlanService.generateNewPlan();
        setTrainingPlan(newPlan);
        showNotification('Training plan updated! New practice text coming...', 'success');
      }

      if (currentStats.wpm >= data.bestWpm) {
        showNotification(`New personal best! ${currentStats.wpm} WPM!`, 'success');
      } else {
        showNotification(`Session complete! ${currentStats.wpm} WPM, ${currentStats.accuracy}% accuracy`, 'success');
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }

    setRefreshKey(k => k + 1);
  }, [trainingPlan, stopTimer, showNotification]);

  const processInput = useCallback((char: string) => {
    if (!connected) return;

    const result = engineRef.current.processInput(char);

    if (!result.correct) {
      setHasError(true);
      setTimeout(() => setHasError(false), 150);
    }

    // Start timer on first keystroke
    if (engineRef.current.hasStarted() && !timerRef.current) {
      setIsRunning(true);
      timerRef.current = setInterval(() => {
        const currentStats = engineRef.current.getStats();
        setStats(currentStats);

        // Check time limit
        if (timeLimit > 0 && currentStats.elapsed >= timeLimit) {
          completeSession();
        }
      }, 100);
    }

    const currentStats = engineRef.current.getStats();
    setStats(currentStats);
    setRefreshKey(k => k + 1);

    if (result.complete) {
      completeSession();
    }
  }, [connected, timeLimit, completeSession]);

  const handleDelete = useCallback(() => {
    if (engineRef.current.deleteChar()) {
      setStats(engineRef.current.getStats());
      setRefreshKey(k => k + 1);
    }
  }, []);

  const handleDeleteWord = useCallback(() => {
    if (engineRef.current.deleteWord() > 0) {
      setStats(engineRef.current.getStats());
      setRefreshKey(k => k + 1);
    }
  }, []);

  const handleConnectionChange = useCallback((isConnected: boolean) => {
    setConnected(isConnected);
  }, []);

  const handleGenerateText = useCallback((text: string) => {
    stopTimer();
    engineRef.current.reset();
    engineRef.current.setText(text);
    setStats({ wpm: 0, accuracy: 100, errors: 0, characters: 0, elapsed: 0, complete: false });
    setRefreshKey(k => k + 1);
  }, [stopTimer]);

  const handleModeChange = useCallback(async (mode: 'words' | 'quotes') => {
    if (!trainingPlan || trainingPlan.practiceMode === mode) return;

    try {
      await trainingPlanService.updatePracticeMode(mode);
      setTrainingPlan(prev => prev ? { ...prev, practiceMode: mode } : null);
      generateText();
    } catch (error) {
      console.error('Failed to change mode:', error);
    }
  }, [trainingPlan, generateText]);

  // Training progress indicator
  const sessionsUntilUpdate = trainingPlan
    ? 5 - trainingPlan.sessionsSinceUpdate
    : 5;

  return (
    <main className="ai-coach-main">
      <ConnectionStatusBanner onConnectionChange={handleConnectionChange} />

      {!connected && (
        <div className="connection-blocker">
          <div className="blocker-content">
            <h2>Connect to LM Studio</h2>
            <p>Start LM Studio and load a model to begin your AI-powered typing practice.</p>
            <p className="blocker-hint">Default endpoint: http://localhost:1234/v1</p>
          </div>
        </div>
      )}

      <div className={`typing-section ${!connected ? 'disabled' : ''}`}>
        <div className="typing-header-row">
          <div className="practice-mode-indicator">
            <button
              className={`mode-badge ${trainingPlan?.practiceMode === 'words' ? 'active' : ''}`}
              onClick={() => handleModeChange('words')}
            >
              Words
            </button>
            <button
              className={`mode-badge ${trainingPlan?.practiceMode === 'quotes' ? 'active' : ''}`}
              onClick={() => handleModeChange('quotes')}
            >
              Quotes
            </button>
          </div>
          <LiveStats stats={stats} bestWpm={bestWpm} />
        </div>

        <div className="typing-container">
          <div className="typing-header">
            <div className="training-progress">
              <span className="progress-text">
                {sessionsUntilUpdate} session{sessionsUntilUpdate !== 1 ? 's' : ''} until new training text
              </span>
            </div>
            <Timer elapsed={stats.elapsed} timeLimit={timeLimit} isRunning={isRunning} />
          </div>

          {isLoading ? (
            <div className="text-display">
              <span className="char upcoming">Generating AI practice text...</span>
            </div>
          ) : !engineRef.current.getText() ? (
            <div className="text-display">
              <span className="char upcoming">Connect to LM Studio to start...</span>
            </div>
          ) : (
            <TextDisplay engine={engineRef.current} refreshKey={refreshKey} />
          )}

          <TypingInput
            onInput={processInput}
            onNewText={generateText}
            onDelete={handleDelete}
            onDeleteWord={handleDeleteWord}
            hasError={hasError}
            disabled={isLoading || !connected}
            isComplete={stats.complete}
          />

          {stats.complete && (
            <div className="completion-hint">
              Press <kbd>Tab</kbd> for new text
            </div>
          )}
        </div>
      </div>

      <ChatInterface
        connected={connected}
        onGenerateText={handleGenerateText}
      />
    </main>
  );
}
