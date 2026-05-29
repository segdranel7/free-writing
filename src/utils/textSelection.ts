export type TextToken = {
  text: string;
  startOffset: number;
  endOffset: number;
  isWord: boolean;
};

export type TextSelectionRange = {
  startOffset: number;
  endOffset: number;
};

export function getTextTokens(text: string) {
  const tokens: TextToken[] = [];
  const wordPattern = /\S+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = wordPattern.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        startOffset: lastIndex,
        endOffset: match.index,
        isWord: false
      });
    }

    tokens.push({
      text: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      isWord: true
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      startOffset: lastIndex,
      endOffset: text.length,
      isWord: false
    });
  }

  return tokens;
}

export function normalizeSelectionRanges(ranges: TextSelectionRange[]) {
  return ranges
    .filter((range) => range.endOffset > range.startOffset)
    .sort((first, second) => first.startOffset - second.startOffset)
    .reduce<TextSelectionRange[]>((normalizedRanges, range) => {
      const previousRange = normalizedRanges.at(-1);
      if (previousRange && range.startOffset <= previousRange.endOffset) {
        previousRange.endOffset = Math.max(previousRange.endOffset, range.endOffset);
      } else {
        normalizedRanges.push({ ...range });
      }
      return normalizedRanges;
    }, []);
}

export function getSelectionRangeChunks(text: string, ranges: TextSelectionRange[]) {
  const normalizedRanges = normalizeSelectionRanges(ranges);

  return normalizedRanges.reduce<TextSelectionRange[]>((currentChunks, range) => {
    const previousChunk = currentChunks.at(-1);
    const gap = previousChunk ? text.slice(previousChunk.endOffset, range.startOffset) : '';

    if (previousChunk && /^\s*$/.test(gap)) {
      previousChunk.endOffset = range.endOffset;
    } else {
      currentChunks.push({ ...range });
    }

    return currentChunks;
  }, []);
}

export function getSelectedTextFromRanges(text: string, ranges: TextSelectionRange[]) {
  const chunks = getSelectionRangeChunks(text, ranges);
  if (chunks.length === 0) return '';

  return chunks
    .map((chunk) => text.slice(chunk.startOffset, chunk.endOffset).trim())
    .filter(Boolean)
    .join('\n\n');
}

export function removeTextRanges(text: string, ranges: TextSelectionRange[]) {
  return [...normalizeSelectionRanges(ranges)]
    .reverse()
    .reduce<string>(
      (currentText, range) => `${currentText.slice(0, range.startOffset)} ${currentText.slice(range.endOffset)}`,
      text
    )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function replaceTextRanges(text: string, ranges: TextSelectionRange[], replacement: string) {
  const chunks = getSelectionRangeChunks(text, ranges);
  if (chunks.length === 0) return text;

  const replacementText = replacement.trim();
  const replacedText = [...chunks]
    .reverse()
    .reduce<string>((currentText, range, reversedIndex) => {
      const isFirstSelectedChunk = reversedIndex === chunks.length - 1;
      const insertedText = isFirstSelectedChunk ? replacementText : ' ';
      return `${currentText.slice(0, range.startOffset)}${insertedText}${currentText.slice(range.endOffset)}`;
    }, text);

  return replacedText
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
