import { Button } from '@repo/ui/button';
import { type RefObject, useEffect, useState } from 'react';
import { captureFrame, useLiveCamera } from './camera';
import { PersonalInvitationCover, SecretPaper } from './secret-paper';

export function SelfieCamera({
  name,
  onVerify,
  onRetake,
  pending,
  error,
}: {
  name: string;
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
    <>
      {camera.active || capture ? (
        <CameraPreview captureUrl={capture?.url} video={camera.video} />
      ) : (
        <PersonalInvitationCover name={name} />
      )}
      <p className="secret-details" role={pending ? 'status' : undefined}>
        {capture
          ? pending
            ? 'Checking it’s you…'
            : 'Send this photo to open your invitation.'
          : camera.active
            ? 'Face the camera in good light.'
            : 'A quick selfie confirms it’s you.'}
      </p>
      {visibleError && (
        <p role="alert" className="secret-error">
          {visibleError}
        </p>
      )}
      {capture ? (
        <div className="secret-actions">
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
    </>
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
      <div className="secret-actions">
        <Button variant="outline" size="lg" disabled={capturing} onClick={camera.stop}>
          Back
        </Button>
        <Button size="lg" disabled={!camera.ready || capturing} onClick={takePhoto}>
          {camera.ready ? 'Capture photo' : 'Opening camera…'}
        </Button>
      </div>
    );
  }
  return (
    <Button className="mt-5" size="lg" onClick={camera.start}>
      {camera.error ? 'Try camera again' : 'Take a selfie & open'}
    </Button>
  );
}

function CameraPreview({
  captureUrl,
  video,
}: {
  captureUrl: string | undefined;
  video: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <SecretPaper className="secret-camera">
      <h1 className="secret-camera-heading">
        {captureUrl ? 'Review your photo' : 'A quick selfie'}
      </h1>
      <div className="secret-camera-frame">
        {captureUrl ? (
          <img src={captureUrl} alt="Your captured selfie" />
        ) : (
          <video ref={video} autoPlay playsInline muted aria-label="Live front camera preview" />
        )}
        {!captureUrl && <div className="secret-face-guide" aria-hidden="true" />}
      </div>
    </SecretPaper>
  );
}
