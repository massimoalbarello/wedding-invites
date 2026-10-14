import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelfieCamera } from '../src/routes/-invitation/selfie-camera';

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
afterEach(() => {
  cleanup();
  mock.restore();
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  }
});
test('camera permission rejection offers a retry without a gallery picker', async () => {
  const user = userEvent.setup();
  const getUserMedia = mock(() =>
    Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
  );
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const view = render(<SelfieCamera name="Alex Morgan" onVerify={() => {}} pending={false} />);
  expect(view.container.querySelector('input[type="file"]')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Take a selfie & open' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Allow camera access'),
  );
  await user.click(screen.getByRole('button', { name: 'Try camera again' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
});
test('leaving the gate stops a camera stream even when permission resolves after unmount', async () => {
  const user = userEvent.setup();
  const stop = mock(() => {});
  let resolvePermission: (stream: MediaStream) => void = () => {};
  const permission = new Promise<MediaStream>((resolve) => {
    resolvePermission = resolve;
  });
  const getUserMedia = mock(() => permission);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const view = render(<SelfieCamera name="Alex Morgan" onVerify={() => {}} pending={false} />);
  await user.click(screen.getByRole('button', { name: 'Take a selfie & open' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  view.unmount();
  resolvePermission({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
});

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
function mockCameraCapture() {
  const stop = mock(() => {});
  const stream = new MediaStream();
  stream.getTracks = () => [{ stop } as unknown as MediaStreamTrack];
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve(stream) },
  });
  spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D);
  spyOn(URL, 'createObjectURL').mockReturnValue('blob:captured-selfie');
  spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const convert = spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['photo'], { type: 'image/jpeg' }));
  });
  return { stop, convert };
}

async function readyCamera() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Take a selfie & open' }));
  const video = screen.getByLabelText<HTMLVideoElement>('Live front camera preview');
  Object.defineProperties(video, {
    videoWidth: { value: VIDEO_WIDTH },
    videoHeight: { value: VIDEO_HEIGHT },
  });
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Capture & verify' }).disabled,
    ).toBe(false),
  );
  return user;
}

test('capturing sends one selfie immediately without a confirmation action', async () => {
  const { stop } = mockCameraCapture();
  const onVerify = mock((_photo: File) => {});
  const props = {
    name: 'Alex Morgan',
    onVerify,
    pending: false,
  };
  const view = render(<SelfieCamera {...props} />);
  const user = await readyCamera();
  expect(onVerify).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Capture & verify' }));
  await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(1));
  expect(onVerify.mock.calls[0]![0]).toBeInstanceOf(File);
  view.rerender(<SelfieCamera {...props} pending />);
  expect(screen.getByRole('img', { name: 'Your captured selfie' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Checking it’s you…');
  expect(screen.queryByRole('button', { name: 'Use this photo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Try another photo' })).toBeNull();
  expect(stop).toHaveBeenCalledTimes(1);
});

test('leaving during photo conversion prevents a late automatic upload', async () => {
  const { convert } = mockCameraCapture();
  let finish: BlobCallback = () => {};
  convert.mockImplementation((callback) => {
    finish = callback;
  });
  const onVerify = mock((_photo: File) => {});
  const view = render(<SelfieCamera name="Alex Morgan" onVerify={onVerify} pending={false} />);
  const user = await readyCamera();
  await user.click(screen.getByRole('button', { name: 'Capture & verify' }));
  view.unmount();
  finish(new Blob(['photo'], { type: 'image/jpeg' }));
  // Let the conversion finish, including all resulting microtasks.
  await Promise.resolve();
  await Promise.resolve();
  expect(onVerify).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
