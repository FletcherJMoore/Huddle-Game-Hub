import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

// Downscales an image file to fit within MAX_DIMENSION and re-encodes it as a
// JPEG so avatar uploads stay small regardless of the source photo's size.
async function resizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

// Resizes and uploads to a fixed path (so re-uploads overwrite, no orphaned
// files), returning a fresh download URL.
async function uploadImage(storage, path, file) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Image is too large (max 8MB)");

  const blob = await resizeImage(file);
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(imageRef);
}

export function uploadAvatar(storage, uid, file) {
  return uploadImage(storage, `avatars/${uid}/photo.jpg`, file);
}

export function uploadBoardIcon(storage, boardId, file) {
  return uploadImage(storage, `boards/${boardId}/icon.jpg`, file);
}
