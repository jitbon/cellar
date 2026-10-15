import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, expect, it, vi } from 'vitest';
import { createTrip, setBlockMeal, type Command, type TripState } from '@cellar/core';
import { BlockLabel } from '../src/components/grid/BlockLabel';
import { TooltipProvider } from '../src/components/ui/Tooltip';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const base = created.state;

function setup(name: string, state: TripState = base) {
  const block = state.blocks.find((b) => b.name === name)!;
  const dispatch = vi.fn((command: Command) => command(state));
  render(
    <TooltipProvider>
      <DndContext>
        <SortableContext items={state.blocks.map((b) => b.id)}>
          <BlockLabel state={state} block={block} dispatch={dispatch} />
        </SortableContext>
      </DndContext>
    </TooltipProvider>,
  );
  return { block, dispatch, user: userEvent.setup() };
}

describe('BlockLabel meal rows', () => {
  it('marks a meal row with an icon and text label', () => {
    setup('Lunch');
    expect(screen.getByRole('img', { name: 'Meal row' })).toBeInTheDocument();
  });

  it('shows no meal marker on an activity row', () => {
    setup('Afternoon');
    expect(screen.queryByRole('img', { name: 'Meal row' })).not.toBeInTheDocument();
  });

  it('turns a meal row off from the menu', async () => {
    const { block, dispatch, user } = setup('Lunch');
    await user.click(screen.getByRole('button', { name: 'Options for Lunch' }));
    await user.click(screen.getByRole('menuitem', { name: 'Lunch is not a meal row' }));
    const result = dispatch.mock.results[0]!.value;
    expect(result.state.blocks.find((b: { id: string }) => b.id === block.id).isMeal).toBe(false);
  });

  it('turns an activity row into a meal row from the menu', async () => {
    const { block, dispatch, user } = setup('Afternoon');
    await user.click(screen.getByRole('button', { name: 'Options for Afternoon' }));
    await user.click(screen.getByRole('menuitem', { name: 'Make Afternoon a meal row' }));
    const result = dispatch.mock.results[0]!.value;
    expect(result.state.blocks.find((b: { id: string }) => b.id === block.id).isMeal).toBe(true);
  });

  it('follows an explicit setting over the name', () => {
    const lunch = base.blocks.find((b) => b.name === 'Lunch')!;
    const off = setBlockMeal(lunch.id, false)(base);
    if (!off.ok) throw new Error('fixture');
    setup('Lunch', off.state);
    expect(screen.queryByRole('img', { name: 'Meal row' })).not.toBeInTheDocument();
  });
});
