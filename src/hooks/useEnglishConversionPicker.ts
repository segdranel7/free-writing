import { useState } from 'react';
import type { EnglishConversion, EnglishConversionRequest, Message, MessageReference } from '../types';
import { assembleEnglishText, getSelectedEnglishSegments } from '../utils/englishConversion';
import {
  getSelectedTextFromRanges,
  getSelectionRangeChunks,
  replaceTextRanges,
  type TextSelectionRange
} from '../utils/textSelection';

export type EnglishPickerSource = { type: 'message'; message: Message } | { type: 'draft'; imageFiles: File[] };

export type EnglishPickerStatus =
  | 'selecting'
  | 'loading'
  | 'ready'
  | 'formatting-create'
  | 'formatting-replace'
  | 'formatting-draft'
  | 'creating'
  | 'replacing'
  | 'sending-draft'
  | 'error';

export type EnglishPickerState = {
  source: EnglishPickerSource;
  status: EnglishPickerStatus;
  conversion: EnglishConversion | null;
  selections: number[];
  error: string | null;
  sourceRanges: TextSelectionRange[];
};

export type EnglishPickerAction = 'create' | 'replace' | 'draft';

type UseEnglishConversionPickerOptions = {
  draft: string;
  pendingReferences: MessageReference[];
  draftScheduledAt: Date | null;
  onConvertToEnglish: (request: string | EnglishConversionRequest) => Promise<EnglishConversion>;
  onFormatEnglishText: (text: string, selectedSegments?: string[]) => Promise<string>;
  onSubmitMessage: (
    textOverride?: string,
    imageFiles?: File[],
    references?: MessageReference[],
    scheduledAt?: Date | null
  ) => void | Promise<void>;
  onCreateEnglishBlock: (message: Message, text: string) => Promise<void>;
  onReplaceWithEnglish: (message: Message, text: string) => Promise<void>;
  onDraftEnglishSent: () => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSavingStatus(action: EnglishPickerAction): EnglishPickerStatus {
  if (action === 'create') return 'creating';
  if (action === 'replace') return 'replacing';
  return 'sending-draft';
}

function getFormattingStatus(action: EnglishPickerAction): EnglishPickerStatus {
  if (action === 'create') return 'formatting-create';
  if (action === 'replace') return 'formatting-replace';
  return 'formatting-draft';
}

function createLoadingState(source: EnglishPickerSource): EnglishPickerState {
  return {
    source,
    status: source.type === 'message' ? 'selecting' : 'loading',
    conversion: null,
    selections: [],
    error: null,
    sourceRanges: []
  };
}

function createLoadingConversionState(source: EnglishPickerSource, sourceRanges: TextSelectionRange[] = []): EnglishPickerState {
  return {
    source,
    status: 'loading',
    conversion: null,
    selections: [],
    error: null,
    sourceRanges
  };
}

function createReadyState(
  source: EnglishPickerSource,
  conversion: EnglishConversion,
  sourceRanges: TextSelectionRange[] = []
): EnglishPickerState {
  return {
    source,
    status: 'ready',
    conversion,
    selections: conversion.segments.map(() => 0),
    error: null,
    sourceRanges
  };
}

function createErrorState(
  source: EnglishPickerSource,
  error: unknown,
  sourceRanges: TextSelectionRange[] = []
): EnglishPickerState {
  return {
    source,
    status: 'error',
    conversion: null,
    selections: [],
    error: getErrorMessage(error, 'Unable to convert this text to English.'),
    sourceRanges
  };
}

function createMessageConversionRequest(message: Message, ranges: TextSelectionRange[]) {
  const chunks = getSelectionRangeChunks(message.text, ranges);
  if (chunks.length === 0) {
    return {
      request: message.text,
      sourceRanges: []
    };
  }

  const selectedText = getSelectedTextFromRanges(message.text, chunks);
  const firstChunk = chunks[0];
  const lastChunk = chunks[chunks.length - 1];

  return {
    request: {
      text: selectedText,
      contextBefore: message.text.slice(0, firstChunk.startOffset).trim(),
      contextAfter: message.text.slice(lastChunk.endOffset).trim()
    },
    sourceRanges: chunks
  };
}

export function useEnglishConversionPicker({
  draft,
  pendingReferences,
  draftScheduledAt,
  onConvertToEnglish,
  onFormatEnglishText,
  onSubmitMessage,
  onCreateEnglishBlock,
  onReplaceWithEnglish,
  onDraftEnglishSent
}: UseEnglishConversionPickerOptions) {
  const [englishPicker, setEnglishPicker] = useState<EnglishPickerState | null>(null);
  const isSaving =
    englishPicker?.status === 'formatting-create' ||
    englishPicker?.status === 'formatting-replace' ||
    englishPicker?.status === 'formatting-draft' ||
    englishPicker?.status === 'creating' ||
    englishPicker?.status === 'replacing' ||
    englishPicker?.status === 'sending-draft';

  async function openMessagePicker(message: Message) {
    const source: EnglishPickerSource = { type: 'message', message };
    setEnglishPicker(createLoadingState(source));
  }

  async function convertMessageSelection(ranges: TextSelectionRange[]) {
    if (!englishPicker || englishPicker.source.type !== 'message') return;
    const source = englishPicker.source;
    const { request, sourceRanges } = createMessageConversionRequest(source.message, ranges);
    setEnglishPicker(createLoadingConversionState(source, sourceRanges));

    try {
      const conversion = await onConvertToEnglish(request);
      setEnglishPicker(createReadyState(source, conversion, sourceRanges));
    } catch (error) {
      setEnglishPicker(createErrorState(source, error, sourceRanges));
    }
  }

  async function openDraftPicker(imageFiles: File[] = []) {
    if (!draft.trim()) return;
    const source: EnglishPickerSource = { type: 'draft', imageFiles: [...imageFiles] };
    setEnglishPicker(createLoadingState(source));

    try {
      const conversion = await onConvertToEnglish(draft);
      setEnglishPicker(createReadyState(source, conversion));
    } catch (error) {
      setEnglishPicker(createErrorState(source, error));
    }
  }

  function updateSelection(segmentIndex: number, optionIndex: number) {
    setEnglishPicker((current) => {
      if (!current) return current;
      const selections = [...current.selections];
      selections[segmentIndex] = optionIndex;
      return { ...current, selections };
    });
  }

  async function saveResult(action: EnglishPickerAction) {
    if (!englishPicker?.conversion) return;
    const englishText = assembleEnglishText(englishPicker.conversion, englishPicker.selections);
    const selectedSegments = getSelectedEnglishSegments(englishPicker.conversion, englishPicker.selections);
    if (!englishText) return;

    setEnglishPicker({ ...englishPicker, status: getFormattingStatus(action), error: null });
    try {
      const formattedEnglishText = await onFormatEnglishText(englishText, selectedSegments);
      const textToSave = formattedEnglishText.trim() || englishText;
      setEnglishPicker({ ...englishPicker, status: getSavingStatus(action), error: null });

      if (action === 'draft') {
        const draftImageFiles = englishPicker.source.type === 'draft' ? englishPicker.source.imageFiles : [];
        await onSubmitMessage(textToSave, draftImageFiles, pendingReferences, draftScheduledAt);
        onDraftEnglishSent();
      } else if (englishPicker.source.type === 'message') {
        if (action === 'create') {
          await onCreateEnglishBlock(englishPicker.source.message, textToSave);
        } else {
          const replacementText = englishPicker.sourceRanges.length > 0
            ? replaceTextRanges(englishPicker.source.message.text, englishPicker.sourceRanges, textToSave)
            : textToSave;
          await onReplaceWithEnglish(englishPicker.source.message, replacementText);
        }
      }
      setEnglishPicker(null);
    } catch (error) {
      setEnglishPicker({
        ...englishPicker,
        status: 'error',
        error: getErrorMessage(error, 'Unable to save the English text.')
      });
    }
  }

  return {
    englishPicker,
    isSaving,
    closePicker: () => setEnglishPicker(null),
    openMessagePicker,
    openDraftPicker,
    convertMessageSelection,
    updateSelection,
    saveResult
  };
}
