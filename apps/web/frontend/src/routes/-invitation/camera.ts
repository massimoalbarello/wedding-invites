import { useEffect, useRef, useState } from 'react';

const JPEG_QUALITY = 0.92;
function stopStream(stream: MediaStream | undefined) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
}
function cameraError(cause: unknown) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Camera access is unavailable. Open this link in your phone’s browser.';
  }
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
    return 'Allow camera access in your browser, then try again.';
  }
  return 'We couldn’t open your camera. Close any other app using it, then try again.';
}
export function useLiveCamera() {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const player = video.current;
    if (!active || !player) {
      return;
    }
    let cancelled = false;
    let stream: MediaStream | undefined;
    setReady(false);
    setError(undefined);
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        player.srcObject = stream;
        await player.play();
        if (!cancelled) {
          setReady(true);
        }
      } catch (cause) {
        if (cancelled) {
          return;
        }
        setError(cameraError(cause));
        setActive(false);
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopStream(stream);
      player.srcObject = null;
    };
  }, [active]);
  return {
    video,
    active,
    ready,
    error,
    start: () => setActive(true),
    stop: () => setActive(false),
  };
}
export async function captureFrame(source: HTMLVideoElement | null) {
  if (!source?.videoWidth || !source.videoHeight) {
    throw new Error('The camera is still getting ready. Try again in a moment.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = source.videoWidth;
  canvas.height = source.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('We couldn’t capture the photo. Please try again.');
  }
  context.drawImage(source, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) {
    throw new Error('We couldn’t capture the photo. Please try again.');
  }
  return new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
}
