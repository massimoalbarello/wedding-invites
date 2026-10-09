import { Button } from '@repo/ui/button';
import { useEffect, useState } from 'react';
import { captureFrame, useLiveCamera } from './camera';

export function SelfieCamera({
  onVerify,
  onRetake,
  pending,
  error,
}: {
  onVerify: (photo: File) => void;
  onRetake: () => void;
  pending: boolean;
  error: string | undefined;
}) {
  const camera = useLiveCamera();
  const [capture, setCapture] = useState<{ file: File; url: string }>();
  const [captureError, setCaptureError] = useState<string>();
  const [capturing, setCapturing] = useState(false);
  useEffect(
    () => () => {
      if (capture) {
        URL.revokeObjectURL(capture.url);
      }
    },
    [capture],
  );
  const takePhoto = async () => {
    setCapturing(true);
    setCaptureError(undefined);
    try {
      const file = await captureFrame(camera.video.current);
      setCapture({ file, url: URL.createObjectURL(file) });
      camera.stop();
    } catch (cause) {
      setCaptureError(
        cause instanceof Error ? cause.message : 'Please try taking your photo again.',
      );
    } finally {
      setCapturing(false);
    }
  };
  const visibleError = captureError || camera.error || error;
  return (
    <div className="space-y-5">
      {(camera.active || capture) && (
        <div className="mx-auto aspect-[3/4] max-h-[55dvh] overflow-hidden rounded-2xl bg-muted">
          {capture ? (
            <img
              src={capture.url}
              alt="Your captured selfie"
              className="size-full -scale-x-100 object-cover"
            />
          ) : (
            <video
              ref={camera.video}
              autoPlay
              playsInline
              muted
              aria-label="Live front camera preview"
              className="size-full -scale-x-100 object-cover"
            />
          )}
        </div>
      )}
      {visibleError && (
        <p role="alert" className="text-destructive text-sm">
          {visibleError}
        </p>
      )}
      {capture ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => {
              setCapture(undefined);
              setCaptureError(undefined);
              onRetake();
              camera.start();
            }}
          >
            Retake photo
          </Button>
          <Button size="lg" disabled={pending} onClick={() => onVerify(capture.file)}>
            {pending ? 'Checking it’s you…' : 'Use this photo'}
          </Button>
        </div>
      ) : (
        <CaptureAction camera={camera} capturing={capturing} takePhoto={takePhoto} />
      )}
      {camera.active && (
        <p className="text-muted-foreground text-xs">
          Face the camera with your face clearly in view.
        </p>
      )}
    </div>
  );
}
function CaptureAction({
  camera,
  capturing,
  takePhoto,
}: {
  camera: ReturnType<typeof useLiveCamera>;
  capturing: boolean;
  takePhoto: () => Promise<void>;
}) {
  if (camera.active) {
    return (
      <Button size="lg" disabled={!camera.ready || capturing} onClick={takePhoto}>
        {camera.ready ? 'Capture photo' : 'Opening camera…'}
      </Button>
    );
  }
  return (
    <Button size="lg" onClick={camera.start}>
      {camera.error ? 'Try camera again' : 'Take a selfie'}
    </Button>
  );
}
