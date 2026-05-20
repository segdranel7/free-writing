import type { Message, MessageImageAttachment } from '../types';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTextAsClipboardHtml(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText) return '';

  return trimmedText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function getDataUrlBlob(dataUrl: string, fallbackType: string) {
  const [metadata = '', data = ''] = dataUrl.split(',');
  const contentType = metadata.match(/^data:([^;]+)/)?.[1] ?? fallbackType;
  const isBase64 = metadata.includes(';base64');
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function getClipboardHtml(message: Message) {
  const textHtml = renderTextAsClipboardHtml(message.text);
  const imageHtml = (message.attachments ?? [])
    .filter((attachment): attachment is MessageImageAttachment => attachment.type === 'image')
    .map(
      (attachment) =>
        `<p><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name || 'Attached image')}"></p>`
    )
    .join('');

  return `<!doctype html><html><body>${textHtml}${imageHtml}</body></html>`;
}

export async function copyMessageToClipboard(message: Message) {
  const attachments = message.attachments ?? [];

  if (attachments.length === 0 || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
    if (!message.text.trim()) throw new Error('This block has no text to copy.');
    await navigator.clipboard.writeText(message.text);
    return;
  }

  const clipboardParts: Record<string, Blob> = {
    'text/plain': new Blob([message.text], { type: 'text/plain' }),
    'text/html': new Blob([getClipboardHtml(message)], { type: 'text/html' })
  };
  const firstImage = attachments.find(
    (attachment): attachment is MessageImageAttachment => attachment.type === 'image' && attachment.url.startsWith('data:')
  );

  if (firstImage) {
    const imageBlob = getDataUrlBlob(firstImage.url, firstImage.contentType);
    clipboardParts[imageBlob.type || firstImage.contentType] = imageBlob;
  }

  try {
    await navigator.clipboard.write([new ClipboardItem(clipboardParts)]);
  } catch (error) {
    if (!message.text.trim()) throw error;
    await navigator.clipboard.writeText(message.text);
  }
}
