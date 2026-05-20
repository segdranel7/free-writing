import { useState } from 'react';
import type { EnglishConversion, Message, MessageReference } from '../types';
import { assembleEnglishText } from '../utils/englishConversion';

export type EnglishPickerSource = { type: 'message'; message: Message } | { type: 'draft'; imageFiles: File[] };

export type EnglishPickerStatus = 'loading' | 'ready' | 'creating' | 'replacing' | 'sending-draft' | 'error';

export type EnglishPickerState = {
  source: EnglishPickerSource;
  status: EnglishPickerStatus;
  conversion: EnglishConversion | null;
  selections: number[];
  error: string | null;
};

export type EnglishPickerAction = 'create' | 'replace' | 'draft';

type UseEnglishConversionPickerOptions = {
  draft: string;
  pendingReferences: MessageReference[];
  onConvertToEnglish: (text: string) => Promise<EnglishConversion>;
  onSubmitMessage: (textOverride?: string, imageFiles?: File[], references?: MessageReference[]) => void | Promise<void>;
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

function createLoadingState(source: EnglishPickerSource): EnglishPickerState {
  return {
    source,
    status: 'loading',
    conversion: null,
    selections: [],
    error: null
  };
}

function createReadyState(source: EnglishPickerSource, conversion: EnglishConversion): EnglishPickerState {
  return {
    source,
    status: 'ready',
    conversion,
    selections: conversion.segments.map(() => 0),
    error: null
  };
}

function createErrorState(source: EnglishPickerSource, error: unknown): EnglishPickerState {
  return {
    source,
    status: 'error',
    conversion: null,
    selections: [],
    error: getErrorMessage(error, 'Unable to convert this text to English.')
  };
}

export function useEnglishConversionPicker({
  draft,
  pendingReferences,
  onConvertToEnglish,
  onSubmitMessage,
  onCreateEnglishBlock,
  onReplaceWithEnglish,
  onDraftEnglishSent
}: UseEnglishConversionPickerOptions) {
  const [englishPicker, setEnglishPicker] = useState<EnglishPickerState | null>(null);
  const isSaving =
    englishPicker?.status === 'creating' ||
    englishPicker?.status === 'replacing' ||
    englishPicker?.status === 'sending-draft';

  async function openMessagePicker(message: Message) {
    const source: EnglishPickerSource = { type: 'message', message };
    setEnglishPicker(createLoadingState(source));

    try {
      const conversion = await onConvertToEnglish(message.text);
      setEnglishPicker(createReadyState(source, conversion));
    } catch (error) {
      setEnglishPicker(createErrorState(source, error));
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
    if (!englishText) return;

    setEnglishPicker({ ...englishPicker, status: getSavingStatus(action), error: null });
    try {
      if (action === 'draft') {
        const draftImageFiles = englishPicker.source.type === 'draft' ? englishPicker.source.imageFiles : [];
        await onSubmitMessage(englishText, draftImageFiles, pendingReferences);
        onDraftEnglishSent();
      } else if (englishPicker.source.type === 'message') {
        if (action === 'create') {
          await onCreateEnglishBlock(englishPicker.source.message, englishText);
        } else {
          await onReplaceWithEnglish(englishPicker.source.message, englishText);
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
    updateSelection,
    saveResult
  };
}
