import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addTypedPlacement, createTrip, updatePlacement } from '@cellar/core';
import { chelseaPlace, katzPopular } from './setup';
import { DragLayer } from '../src/components/grid/DragLayer';
import { placementDragId, popularDragId } from '../src/components/grid/dndIds';

// DragOverlay only renders its children during a real drag; render them directly here.
vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const afternoon = created.state.blocks.find((b) => b.name === 'Afternoon')!;
const added = addTypedPlacement('2027-04-02', afternoon.id, 'Coffee')(created.state);
if (!added.ok) throw new Error('fixture');
const plain = added.state;
const linked = updatePlacement(plain.placements[0]!.id, { place: chelseaPlace })(plain);
if (!linked.ok) throw new Error('fixture');

describe('DragLayer', () => {
  it('shows the linked-place pin on a linked placement being dragged', () => {
    const id = placementDragId(linked.state.placements[0]!.id);
    render(<DragLayer state={linked.state} activeId={id} />);
    expect(screen.getByLabelText('Linked place')).toBeInTheDocument();
  });

  it('shows the name, type and pin of a popular card being dragged', () => {
    const popular = { place: katzPopular, type: 'food' as const };
    render(<DragLayer state={plain} activeId={popularDragId('test-katz')} popular={popular} />);
    expect(screen.getByText("Katz's Delicatessen")).toBeInTheDocument();
    expect(screen.getByLabelText('Linked place')).toBeInTheDocument();
    expect(document.querySelector('[data-drag-overlay]')?.className).toMatch(/food/);
  });

  it('shows no pin for an unlinked placement', () => {
    const id = placementDragId(plain.placements[0]!.id);
    render(<DragLayer state={plain} activeId={id} />);
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.queryByLabelText('Linked place')).toBeNull();
  });
});
