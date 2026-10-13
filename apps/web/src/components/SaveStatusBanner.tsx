import { useEffect, useState } from 'react';
import type { Outbox, OutboxStatus } from '../adapters/outbox';
import { Banner } from './ui/Banner';

export function SaveStatusBanner({ outbox }: { outbox: Outbox }) {
  const [status, setStatus] = useState<OutboxStatus>(outbox.status);
  const [discarded, setDiscarded] = useState(false);

  useEffect(
    () =>
      outbox.subscribe((e) => {
        if (e.type === 'status') setStatus(e.status);
        else setDiscarded(true);
      }),
    [outbox],
  );

  return (
    <>
      {status === 'retrying' ? <Banner tone="warning">Not saved — retrying</Banner> : null}
      {discarded ? (
        <Banner tone="error">
          A change couldn't be saved and was undone{' '}
          <button type="button" onClick={() => setDiscarded(false)}>
            Dismiss
          </button>
        </Banner>
      ) : null}
    </>
  );
}
