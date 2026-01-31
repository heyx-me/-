import { describe, it, expect } from 'vitest';
import i18n from './i18n';

describe('i18n.js', () => {
  it('should initialize with default language en', () => {
    expect(i18n.language).toMatch(/^en/);
  });

  it('should translate a known key', () => {
    const translation = i18n.t('spendingTrend');
    expect(translation).toBe('Spending Trend');
  });

  it('should handle nested keys (categories)', () => {
    const translation = i18n.t('categories.Food & Dining');
    expect(translation).toBe('Food & Dining');
  });

  it('should switch language to he', async () => {
    await i18n.changeLanguage('he');
    expect(i18n.t('spendingTrend')).toBe('מגמת הוצאות');
    await i18n.changeLanguage('en'); // Reset
  });

  it('should return key for missing translations', () => {
    const missing = i18n.t('nonexistent.key');
    expect(missing).toBe('nonexistent.key');
  });
});
