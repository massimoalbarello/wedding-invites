import { useEffect, useState } from 'react';
import { SecretPaper, SecretStamp } from './secret-paper';

const COUNTDOWN_SECONDS = 3;
const SECOND_MS = 1000;
const BURST_MS = 800;

export function SelfDestruct() {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [blank, setBlank] = useState(false);
  useEffect(() => {
    const deadline = Date.now() + COUNTDOWN_SECONDS * SECOND_MS;
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / SECOND_MS)));
    }, SECOND_MS);
    const burst = setTimeout(() => {
      clearInterval(interval);
      setSeconds(0);
    }, COUNTDOWN_SECONDS * SECOND_MS);
    const finish = setTimeout(() => setBlank(true), COUNTDOWN_SECONDS * SECOND_MS + BURST_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(burst);
      clearTimeout(finish);
    };
  }, []);

  if (blank) {
    return (
      <span className="sr-only" role="status">
        Message destroyed.
      </span>
    );
  }
  return (
    <div className="secret-rejection" data-burst={seconds === 0}>
      <div className="secret-burst" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <SecretPaper>
        <SecretStamp>
          ACCESS
          <br />
          DENIED
        </SecretStamp>
        <h1 className="secret-result">Sorry, this message isn’t for you.</h1>
        <p className="secret-countdown" role="status" aria-live="polite">
          {seconds > 0 ? `Self-destructing in ${seconds}…` : 'Destroying message…'}
        </p>
      </SecretPaper>
    </div>
  );
}
