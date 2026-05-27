import type { EnglishConversion } from '../types';

function getSegmentSeparator(separatorAfter: EnglishConversion['segments'][number]['separatorAfter']) {
  if (separatorAfter === 'line') return '\n';
  if (separatorAfter === 'blankLine') return '\n\n';
  return ' ';
}

export function assembleEnglishText(conversion: EnglishConversion, selections: number[]) {
  return conversion.segments.reduce((text, segment, segmentIndex) => {
    const selectedOption = segment.options[selections[segmentIndex] ?? 0] ?? segment.options[0];
    const separator = segmentIndex === conversion.segments.length - 1
      ? ''
      : getSegmentSeparator(segment.separatorAfter);

    return `${text}${selectedOption}${separator}`;
  }, '').trim();
}
