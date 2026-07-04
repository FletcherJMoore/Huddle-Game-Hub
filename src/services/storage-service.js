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

// Resizes, uploads to avatars/{uid}/photo.jpg (fixed name so re-uploads
// overwrite), and returns a fresh download URL.
export async function uploadAvatar(storage, uid, file) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Image is too large (max 8MB)");

  const blob = await resizeImage(file);
  const avatarRef = ref(storage, `avatars/${uid}/photo.jpg`);
  await uploadBytes(avatarRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(avatarRef);
}
