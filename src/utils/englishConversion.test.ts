import { describe, expect, it } from 'vitest';
import { assembleEnglishText, getSelectedEnglishSegments } from './englishConversion';

describe('assembleEnglishText', () => {
  it('joins the selected option from each segment and defaults missing selections to the first option', () => {
    const text = assembleEnglishText(
      {
        segments: [
          {
            original: 'Primeiro',
            options: ['First default', 'First selected', 'First formal'],
            separatorAfter: 'space'
          },
          {
            original: 'Segundo',
            options: ['Second default', 'Second selected', 'Second formal']
          }
        ]
      },
      [1]
    );

    expect(text).toBe('First selected Second default');
  });

  it('preserves line and blank-line separators between selected segments', () => {
    const text = assembleEnglishText(
      {
        segments: [
          {
            original: '- Primeiro',
            options: ['- First default', '- First selected', '- First formal'],
            separatorAfter: 'line'
          },
          {
            original: '- Segundo',
            options: ['- Second default', '- Second selected', '- Second formal'],
            separatorAfter: 'blankLine'
          },
          {
            original: 'Fim',
            options: ['End default', 'End selected', 'End formal']
          }
        ]
      },
      [1, 1, 1]
    );

    expect(text).toBe('- First selected\n- Second selected\n\nEnd selected');
  });

  it('returns the selected option text for each segment', () => {
    const segments = getSelectedEnglishSegments(
      {
        segments: [
          {
            original: 'Primeiro',
            options: ['First default', 'First selected', 'First formal']
          },
          {
            original: 'Segundo',
            options: ['Second default', 'Second selected', 'Second formal']
          }
        ]
      },
      [1, 2]
    );

    expect(segments).toEqual(['First selected', 'Second formal']);
  });
});
