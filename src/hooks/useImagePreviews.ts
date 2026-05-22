import { useCallback, useEffect, useRef, useState } from 'react';
import { createPreviewId } from '../utils/imageFiles';

export type ImagePreview = {
  id: string;
  file: File;
  url: string;
};

export function useImagePreviews() {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const imagePreviewsRef = useRef<ImagePreview[]>([]);

  useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, []);

  const getImageFiles = useCallback(() => imagePreviewsRef.current.map((preview) => preview.file), []);

  const addImageFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const nextPreviews = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: createPreviewId(),
        file,
        url: URL.createObjectURL(file)
      }));
    setImagePreviews((current) => {
      const nextImagePreviews = [...current, ...nextPreviews];
      imagePreviewsRef.current = nextImagePreviews;
      return nextImagePreviews;
    });
  }, []);

  const removeImage = useCallback((previewId: string) => {
    setImagePreviews((current) => {
      const preview = current.find((item) => item.id === previewId);
      if (preview) URL.revokeObjectURL(preview.url);
      const nextImagePreviews = current.filter((item) => item.id !== previewId);
      imagePreviewsRef.current = nextImagePreviews;
      return nextImagePreviews;
    });
  }, []);

  const clearImagePreviews = useCallback(() => {
    setImagePreviews((current) => {
      current.forEach((preview) => URL.revokeObjectURL(preview.url));
      imagePreviewsRef.current = [];
      return [];
    });
  }, []);

  return {
    imagePreviews,
    getImageFiles,
    addImageFiles,
    removeImage,
    clearImagePreviews
  };
}
