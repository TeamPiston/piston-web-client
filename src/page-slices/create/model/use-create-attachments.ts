"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import type { AttachedImage } from "./types";

const MAX_ATTACHED_IMAGES = 2;

export function useCreateAttachments() {
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isLimitExceeded, setIsLimitExceeded] = useState(false);
  const attachedImagesRef = useRef<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      attachedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
      attachedImagesRef.current = [];
    };
  }, []);

  const clearLimitExceeded = () => setIsLimitExceeded(false);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetAttachments = () => {
    attachedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    attachedImagesRef.current = [];
    setAttachedImages([]);
    clearLimitExceeded();
    resetFileInput();
  };

  const addImages = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }

    const availableSlots = MAX_ATTACHED_IMAGES - attachedImagesRef.current.length;
    if (availableSlots <= 0) {
      setIsLimitExceeded(true);
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);
    const nextImages = filesToAdd.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name || "붙여넣은 이미지",
      url: URL.createObjectURL(file),
    }));

    attachedImagesRef.current = [...attachedImagesRef.current, ...nextImages];
    setAttachedImages(attachedImagesRef.current);
    setIsLimitExceeded(imageFiles.length > availableSlots);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length > 0) {
      event.preventDefault();
      addImages(imageFiles);
    }
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
    clearLimitExceeded();
    resetFileInput();
  };

  return {
    attachedImages,
    isLimitExceeded,
    fileInputRef,
    handleFileChange,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleRemoveAttachment,
    resetAttachments,
    clearLimitExceeded,
  };
}
