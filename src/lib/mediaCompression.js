import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegPromise = null;

function fileBaseName(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function replaceExtension(name, extension) {
  return `${fileBaseName(name)}.${extension}`;
}

async function loadFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }

  return ffmpegPromise;
}

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Não foi possível comprimir a imagem.'));
    }, 'image/jpeg', 0.78);
  });

  return new File(
    [blob],
    replaceExtension(file.name, 'jpg'),
    { type: 'image/jpeg', lastModified: Date.now() },
  );
}

export async function compressVideo(file, onProgress) {
  if (!file.type.startsWith('video/')) return file;

  const ffmpeg = await loadFFmpeg();
  const inputName = `input-${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
  const outputName = `output-${Date.now()}.mp4`;

  try {
    ffmpeg.on('progress', ({ progress }) => {
      if (typeof onProgress === 'function') {
        onProgress(Math.max(0, Math.min(1, progress)));
      }
    });

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale=w='min(1280,iw)':h=-2",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'video/mp4' });

    if (!blob.size || blob.size >= file.size) {
      return file;
    }

    return new File(
      [blob],
      replaceExtension(file.name, 'mp4'),
      { type: 'video/mp4', lastModified: Date.now() },
    );
  } finally {
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
  }
}

export async function compressMedia(file, onProgress) {
  if (file.type.startsWith('image/')) return compressImage(file);
  if (file.type.startsWith('video/')) return compressVideo(file, onProgress);
  return file;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
