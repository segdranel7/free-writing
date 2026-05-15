import type { MessageImageAttachment } from '../types';

const maxInlineImageBytes = 700_000;
const maxTotalInlineBytes = 850_000;
const imageDimensions = [1400, 1000, 750];
const imageQualities = [0.82, 0.68, 0.54, 0.42];

function createAttachmentId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Unable to read this image.')));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to prepare this image.'));
    });
    image.src = url;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to compress this image.'));
          return;
        }
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(String(reader.result)));
        reader.addEventListener('error', () => reject(reader.error ?? new Error('Unable to prepare this image.')));
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

function getInlineByteSize(value: string) {
  return new Blob([value]).size;
}

async function compressImage(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (getInlineByteSize(originalDataUrl) <= maxInlineImageBytes) return originalDataUrl;

  const image = await loadImage(file);
  for (const maxDimension of imageDimensions) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare this image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of imageQualities) {
      const dataUrl = await canvasToDataUrl(canvas, quality);
      if (getInlineByteSize(dataUrl) <= maxInlineImageBytes) return dataUrl;
    }
  }

  throw new Error('This image is too large for the free storage mode. Try a smaller image or screenshot.');
}

export async function uploadMessageImages(
  _userId: string,
  _conversationId: string,
  files: File[]
): Promise<MessageImageAttachment[]> {
  let totalBytes = 0;
  const attachments: MessageImageAttachment[] = [];

  for (const file of files) {
    const url = await compressImage(file);
    totalBytes += getInlineByteSize(url);
    if (totalBytes > maxTotalInlineBytes) {
      throw new Error('These images are too large to send together in free storage mode. Send fewer images at a time.');
    }

    attachments.push({
      id: createAttachmentId(),
      type: 'image',
      url,
      name: file.name,
      contentType: 'image/jpeg',
      size: file.size
    });
  }

  return attachments;
}
