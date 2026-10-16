import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../src/components/ui/Dialog';

function setup(closeOnBackdrop?: boolean) {
  const onClose = vi.fn();
  render(
    <Dialog title="Edit item" onClose={onClose} closeOnBackdrop={closeOnBackdrop}>
      <input aria-label="Name" defaultValue="Museum" />
      <button type="button">Save</button>
    </Dialog>,
  );
  return { onClose, user: userEvent.setup() };
}

describe('Dialog', () => {
  it('has a close (X) button that closes it', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still focuses the first field, not the close button, when it opens', () => {
    setup();
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('still closes on Escape', async () => {
    const { onClose, user } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a click on the backdrop by default', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('with closeOnBackdrop', () => {
    it('closes when the backdrop itself is clicked', async () => {
      const { onClose, user } = setup(true);
      await user.click(screen.getByRole('dialog').parentElement!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close for a click inside the dialog', async () => {
      const { onClose, user } = setup(true);
      await user.click(screen.getByRole('dialog'));
      await user.click(screen.getByLabelText('Name'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
