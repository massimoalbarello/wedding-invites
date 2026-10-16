import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import confetti from 'canvas-confetti';
import { ReplyCelebration } from '../src/reply-celebration';

afterEach(() => {
  cleanup();
  mock.restore();
});

test('the burst starts at the current reply button within the canvas and releases its renderer', async () => {
  const button = document.createElement('button');
  spyOn(button, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 340, y: 610, width: 160, height: 60 }),
  );
  spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 110, y: 40, width: 1000, height: 800 }),
  );
  const animation = Promise.withResolvers<null>();
  const launch = Object.assign(
    mock((_options?: confetti.Options) => animation.promise),
    {
      reset: mock(() => {}),
    },
  );
  spyOn(confetti, 'create').mockReturnValue(launch);
  const onEnd = mock(() => {});
  const view = render(<ReplyCelebration anchor={{ current: button }} onEnd={onEnd} />);
  expect(launch.mock.calls[0]?.[0]?.origin).toEqual({ x: 0.31, y: 0.75 });
  expect(onEnd).not.toHaveBeenCalled();
  animation.resolve(null);
  await animation.promise;
  expect(onEnd).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(launch.reset).toHaveBeenCalledTimes(1);
});
