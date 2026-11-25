"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { isMockModeEnabled } from "@/shared/mock/mock-data";
import type { AttachedImage } from "./types";

const API_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_API_IMAGE_BYTES = 10 * 1024 * 1024;

export function useCreateAttachments() {
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const isMockMode = isMockModeEnabled();
  const maxImages = isMockMode ? 2 : 1;
  const attachedImagesRef = useRef<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      attachedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
      attachedImagesRef.current = [];
    };
  }, []);

  const clearAttachmentError = () => setAttachmentError(null);
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetAttachments = () => {
    attachedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    attachedImagesRef.current = [];
    setAttachedImages([]);
    clearAttachmentError();
    resetFileInput();
  };

  const addImages = (files: File[]) => {
    const availableSlots = maxImages - attachedImagesRef.current.length;
    const filesToAdd: File[] = [];
    let error: string | null = null;

    for (const file of files) {
      if (isMockMode) {
        if (!file.type.startsWith("image/")) continue;
      } else if (!API_IMAGE_TYPES.includes(file.type)) {
        error ??= "JPEG, PNG 또는 WebP 이미지만 첨부할 수 있어요.";
        continue;
      } else if (file.size > MAX_API_IMAGE_BYTES) {
        error ??= "이미지 크기는 최대 10 MiB까지 허용돼요.";
        continue;
      }

      if (filesToAdd.length >= availableSlots) {
        error ??= `사진은 최대 ${maxImages}장까지 첨부할 수 있어요.`;
        continue;
      }
      filesToAdd.push(file);
    }

    if (error !== null || filesToAdd.length > 0) {
      setAttachmentError(error);
    }
    if (filesToAdd.length === 0) return;

    const nextImages = filesToAdd.map((file) => ({
      file,
      id: crypto.randomUUID(),
      name: file.name || "붙여넣은 이미지",
      url: URL.createObjectURL(file),
    }));
    attachedImagesRef.current = [...attachedImagesRef.current, ...nextImages];
    setAttachedImages(attachedImagesRef.current);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.some((file) => file.type.startsWith("image/"))) {
      event.preventDefault();
    }
    addImages(files);
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    addImages(Array.from(event.dataTransfer.files));
  };

  const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleRemoveAttachment = (imageId: string) => {
    const imageToRemove = attachedImagesRef.current.find((image) => image.id === imageId);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.url);
    }

    attachedImagesRef.current = attachedImagesRef.current.filter((image) => image.id !== imageId);
    setAttachedImages(attachedImagesRef.current);
    clearAttachmentError();
    resetFileInput();
  };

  return {
    attachedImages,
    attachmentError,
    imageAccept: isMockMode ? "image/*" : API_IMAGE_TYPES.join(","),
    fileInputRef,
    handleFileChange,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleRemoveAttachment,
    resetAttachments,
    clearAttachmentError,
  };
}
