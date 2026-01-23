'use client';

import { useState, useEffect } from 'react';
import { Settings, TrainingPlan, DEFAULT_PROMPTS } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const showNotification = useAppStore((state) => state.showNotification);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsRes, planRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/training-plan')
        ]);

        if (settingsRes.ok) {
          setSettings(await settingsRes.json());
        }
        if (planRes.ok) {
          setTrainingPlan(await planRes.json());
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        showNotification('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [showNotification]);

  const handleSettingChange = (key: keyof Settings, value: string | number) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handlePromptChange = (key: keyof Pick<TrainingPlan, 'systemPrompt' | 'textGenQuotesPrompt' | 'textGenWordsPrompt' | 'analysisPrompt' | 'sessionSummaryPrompt'>, value: string) => {
    if (!trainingPlan) return;
    setTrainingPlan({ ...trainingPlan, [key]: value || null });
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save');
      showNotification('Settings saved', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePrompts = async () => {
    if (!trainingPlan) return;
    setSaving(true);
    try {
      const res = await fetch('/api/training-plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: trainingPlan.systemPrompt,
          textGenQuotesPrompt: trainingPlan.textGenQuotesPrompt,
          textGenWordsPrompt: trainingPlan.textGenWordsPrompt,
          analysisPrompt: trainingPlan.analysisPrompt,
          sessionSummaryPrompt: trainingPlan.sessionSummaryPrompt
        })
      });
      if (!res.ok) throw new Error('Failed to save');
      showNotification('Prompts saved', 'success');
    } catch (error) {
      console.error('Failed to save prompts:', error);
      showNotification('Failed to save prompts', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = (key: keyof typeof DEFAULT_PROMPTS) => {
    if (!trainingPlan) return;
    const defaultValue = DEFAULT_PROMPTS[key];
    setTrainingPlan({ ...trainingPlan, [key]: defaultValue });
  };

  if (loading) {
    return (
      <main className="settings-main">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading settings...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="settings-main">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Practice Settings</h2>
        <div className="settings-grid">
          <div className="setting-group">
            <label className="setting-label">Target WPM</label>
            <input
              type="number"
              className="setting-input"
              value={settings?.targetWpm ?? 85}
              onChange={(e) => handleSettingChange('targetWpm', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="setting-group">
            <label className="setting-label">Daily Goal (sessions)</label>
            <input
              type="number"
              className="setting-input"
              value={settings?.dailyGoal ?? 10}
              onChange={(e) => handleSettingChange('dailyGoal', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="setting-group">
            <label className="setting-label">Speed Duration (sec)</label>
            <input
              type="number"
              className="setting-input"
              value={settings?.speedDuration ?? 30}
              onChange={(e) => handleSettingChange('speedDuration', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="setting-group">
            <label className="setting-label">Endurance Duration (min)</label>
            <input
              type="number"
              className="setting-input"
              value={settings?.enduranceDuration ?? 3}
              onChange={(e) => handleSettingChange('enduranceDuration', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="setting-group">
            <label className="setting-label">Burst Words</label>
            <input
              type="number"
              className="setting-input"
              value={settings?.burstWords ?? 5}
              onChange={(e) => handleSettingChange('burstWords', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>AI Connection</h2>
        <div className="setting-group full-width">
          <label className="setting-label">LM Studio Endpoint</label>
          <input
            type="text"
            className="setting-input"
            value={settings?.aiEndpoint ?? 'http://localhost:1234/v1'}
            onChange={(e) => handleSettingChange('aiEndpoint', e.target.value)}
            placeholder="http://localhost:1234/v1"
          />
          <p className="setting-hint">Default: http://localhost:1234/v1</p>
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Endpoint'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>AI Prompts</h2>
        <p className="section-description">
          Customize the prompts used by the AI coach. Leave empty to use defaults.
        </p>

        <div className="prompt-group">
          <div className="prompt-header">
            <label className="setting-label">System Prompt</label>
            <button
              className="btn-reset"
              onClick={() => resetPrompt('systemPrompt')}
            >
              Reset to default
            </button>
          </div>
          <textarea
            className="prompt-input"
            value={trainingPlan?.systemPrompt || DEFAULT_PROMPTS.systemPrompt}
            onChange={(e) => handlePromptChange('systemPrompt', e.target.value)}
            rows={3}
          />
        </div>

        <div className="prompt-group">
          <div className="prompt-header">
            <label className="setting-label">Text Generation - Quotes</label>
            <button
              className="btn-reset"
              onClick={() => resetPrompt('textGenQuotesPrompt')}
            >
              Reset to default
            </button>
          </div>
          <textarea
            className="prompt-input"
            value={trainingPlan?.textGenQuotesPrompt || DEFAULT_PROMPTS.textGenQuotesPrompt}
            onChange={(e) => handlePromptChange('textGenQuotesPrompt', e.target.value)}
            rows={6}
          />
          <p className="setting-hint">
            Variables: {'{{theme}}'}, {'{{wordCount}}'}, {'{{weakKeys}}'}
          </p>
        </div>

        <div className="prompt-group">
          <div className="prompt-header">
            <label className="setting-label">Text Generation - Words</label>
            <button
              className="btn-reset"
              onClick={() => resetPrompt('textGenWordsPrompt')}
            >
              Reset to default
            </button>
          </div>
          <textarea
            className="prompt-input"
            value={trainingPlan?.textGenWordsPrompt || DEFAULT_PROMPTS.textGenWordsPrompt}
            onChange={(e) => handlePromptChange('textGenWordsPrompt', e.target.value)}
            rows={6}
          />
          <p className="setting-hint">
            Variables: {'{{wordCount}}'}, {'{{complexity}}'}, {'{{weakKeys}}'}, {'{{weakBigrams}}'}
          </p>
        </div>

        <div className="prompt-group">
          <div className="prompt-header">
            <label className="setting-label">Analysis Prompt</label>
            <button
              className="btn-reset"
              onClick={() => resetPrompt('analysisPrompt')}
            >
              Reset to default
            </button>
          </div>
          <textarea
            className="prompt-input"
            value={trainingPlan?.analysisPrompt || DEFAULT_PROMPTS.analysisPrompt}
            onChange={(e) => handlePromptChange('analysisPrompt', e.target.value)}
            rows={8}
          />
          <p className="setting-hint">
            Variables: {'{{avgWpm}}'}, {'{{bestWpm}}'}, {'{{avgAccuracy}}'}, {'{{totalSessions}}'}, {'{{wpmTrend}}'}, {'{{weakKeys}}'}, {'{{weakBigrams}}'}
          </p>
        </div>

        <div className="prompt-group">
          <div className="prompt-header">
            <label className="setting-label">Session Summary Prompt</label>
            <button
              className="btn-reset"
              onClick={() => resetPrompt('sessionSummaryPrompt')}
            >
              Reset to default
            </button>
          </div>
          <textarea
            className="prompt-input"
            value={trainingPlan?.sessionSummaryPrompt || DEFAULT_PROMPTS.sessionSummaryPrompt}
            onChange={(e) => handlePromptChange('sessionSummaryPrompt', e.target.value)}
            rows={8}
          />
          <p className="setting-hint">
            Variables: {'{{wpm}}'}, {'{{accuracy}}'}, {'{{errors}}'}, {'{{elapsed}}'}, {'{{personalBest}}'}, {'{{slowestKeys}}'}, {'{{fastestKeys}}'}
          </p>
        </div>

        <div className="settings-actions">
          <button className="btn btn-primary" onClick={savePrompts} disabled={saving}>
            {saving ? 'Saving...' : 'Save Prompts'}
          </button>
        </div>
      </section>
    </main>
  );
}
