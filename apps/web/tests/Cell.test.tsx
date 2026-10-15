import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cell, createTrip, type Command, type TripState } from '@cellar/core';
import { Cell } from '../src/components/grid/Cell';
import { TooltipProvider } from '../src/components/ui/Tooltip';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const initial = created.state;
const afternoon = initial.blocks.find((b) => b.name === 'Afternoon')!;
const DATE = '2027-04-02';

function Harness() {
  const [state, setState] = useState<TripState>(initial);
  const dispatch = (command: Command) => {
    const r = command(state);
    if (r.ok) setState(r.state);
    return r;
  };
  return (
    <TooltipProvider>
      <Cell
        state={state}
        date={DATE}
        blockId={afternoon.id}
        blockName="Afternoon"
        dispatch={dispatch}
      />
    </TooltipProvider>
  );
}

describe('Cell', () => {
  it('typing + Enter creates two placements in order', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event to afternoon/i }));
    await user.type(
      screen.getByRole('combobox', { name: /add event/i }),
      'Walk around Shibuya{Enter}',
    );
    await user.type(screen.getByRole('combobox', { name: /add event/i }), 'Coffee{Enter}');
    const names = screen.getAllByText(/Walk around Shibuya|Coffee/).map((n) => n.textContent);
    expect(names).toEqual(['Walk around Shibuya', 'Coffee']);
  });

  it('Escape cancels without creating anything', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event/i }));
    await user.type(screen.getByRole('combobox', { name: /add event/i }), 'Nope{Escape}');
    expect(screen.queryByText('Nope')).toBeNull();
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument();
  });

  it('type switches from the chip menu', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event/i }));
    await user.type(screen.getByRole('combobox', { name: /add event/i }), 'Coffee{Enter}');
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    expect(screen.getByRole('menuitem', { name: 'Switch Coffee to Food place' })).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: 'Switch Coffee to Food place' }));
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    expect(screen.getByRole('menuitem', { name: 'Switch Coffee to Activity' })).toBeVisible();
    expect(cell).toBeDefined();
  });

  it('collapses 4+ events to two chips and a "+N more" button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event/i }));
    const box = screen.getByRole('combobox', { name: /add event/i });
    for (const n of ['A1', 'B2', 'C3', 'D4', 'E5']) await user.type(box, `${n}{Enter}`);
    expect(
      screen.getByRole('button', { name: /show all 5 events in afternoon/i }),
    ).toHaveTextContent('+3 more');
    expect(screen.queryByText('E5')).toBeNull();
  });
});
