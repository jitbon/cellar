import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../src/components/ui/Toast';

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the default "Got it" button and 8 s timeout', () => {
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Trip created</Toast>);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(7900));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100)); // 8 s: starts fading
    act(() => vi.advanceTimersByTime(300));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fades out before dismissing after a custom duration', () => {
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss} durationMs={4000}>
        Added
      </Toast>,
    );
    const toast = screen.getByRole('status');
    act(() => vi.advanceTimersByTime(4000));
    expect(toast.className).toMatch(/leaving/);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('runs a custom action instead of dismissing', async () => {
    vi.useRealTimers();
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    render(
      <Toast onDismiss={onDismiss} actionLabel="View list" onAction={onAction}>
        Added
      </Toast>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'View list' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
