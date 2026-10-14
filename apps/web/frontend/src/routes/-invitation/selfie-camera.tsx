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
  const [captureUrl, setCaptureUrl] = useState<string>();
  const [captureError, setCaptureError] = useState<string>();
  const [capturing, setCapturing] = useState(false);
  useEffect(
    () => () => {
      if (captureUrl) {
        URL.revokeObjectURL(captureUrl);
      }
    },
    [captureUrl],
  );
  const takePhoto = async () => {
    setCapturing(true);
    setCaptureError(undefined);
    try {
      const source = camera.video.current;
      const file = await captureFrame(source);
      if (camera.video.current !== source) {
        return;
      }
      setCaptureUrl(URL.createObjectURL(file));
      camera.stop();
      onVerify(file);
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
      {camera.active || captureUrl ? (
        <CameraPreview captureUrl={captureUrl} video={camera.video} />
      ) : (
        <PersonalInvitationCover name={name} />
      )}
      {!visibleError && (!camera.active || captureUrl) && (
        <p className="secret-details" role={pending ? 'status' : undefined}>
          {captureUrl ? 'Checking it’s you…' : 'A quick selfie confirms it’s you.'}
        </p>
      )}
      {visibleError && (
        <p role="alert" className="secret-error">
          {visibleError}
        </p>
      )}
      {captureUrl ? (
        !pending &&
        error && (
          <Button
            className="mt-5"
            size="lg"
            onClick={() => {
              setCaptureUrl(undefined);
              setCaptureError(undefined);
              onRetake();
              camera.start();
            }}
          >
            Try another photo
          </Button>
        )
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
          {camera.ready ? 'Capture & verify' : 'Opening camera…'}
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
      <h1 className="secret-camera-heading">{captureUrl ? 'Your photo' : 'A quick selfie'}</h1>
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
