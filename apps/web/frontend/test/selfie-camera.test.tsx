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
  const view = render(
    <SelfieCamera onVerify={() => {}} onRetake={() => {}} pending={false} error={undefined} />,
  );
  expect(view.container.querySelector('input[type="file"]')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Take a selfie' }));
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
  const view = render(
    <SelfieCamera onVerify={() => {}} onRetake={() => {}} pending={false} error={undefined} />,
  );
  await user.click(screen.getByRole('button', { name: 'Take a selfie' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  view.unmount();
  resolvePermission({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
});
