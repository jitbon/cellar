import { useMemo, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  cell,
  createTrip,
  placeFields,
  type Command,
  type PlaceSearch,
  type PlaceSuggestion,
  type TripState,
} from '@cellar/core';
import { Cell } from '../src/components/grid/Cell';
import { TooltipProvider } from '../src/components/ui/Tooltip';
import { chelseaPlace, chelseaSuggestion, fakePlaceSearch, withPlaces } from './setup';

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

const tacosSuggestion: PlaceSuggestion = {
  placeId: 'test-tacos',
  name: 'Los Tacos No. 1',
  address: '9th Avenue, New York, NY, USA',
  types: ['mexican_restaurant', 'restaurant', 'food'],
};

function PlacesHarness({
  places,
  onState,
}: {
  places: PlaceSearch;
  onState: (s: TripState) => void;
}) {
  const [state, setState] = useState<TripState>(initial);
  const dispatch = (command: Command) => {
    const r = command(state);
    if (r.ok) {
      setState(r.state);
      onState(r.state);
    }
    return r;
  };
  const Wrapper = useMemo(() => withPlaces(places), [places]);
  return (
    <Wrapper>
      <TooltipProvider>
        <Cell
          state={state}
          date={DATE}
          blockId={afternoon.id}
          blockName="Afternoon"
          dispatch={dispatch}
        />
      </TooltipProvider>
    </Wrapper>
  );
}

describe('Cell place suggestions', () => {
  async function typeInto(places: PlaceSearch, text: string) {
    let latest = initial;
    const user = userEvent.setup();
    render(<PlacesHarness places={places} onState={(s) => (latest = s)} />);
    await user.click(screen.getByRole('button', { name: /add event to afternoon/i }));
    const input = screen.getByRole('combobox', { name: /add event/i });
    await user.type(input, text);
    return { user, input, latest: () => latest };
  }

  it('shows a Places group and picking one creates a linked placement', async () => {
    const places = fakePlaceSearch({ suggestions: [chelseaSuggestion] });
    const { user, latest } = await typeInto(places, 'chel');
    expect(await screen.findByRole('option', { name: /Chelsea Market/ })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(latest().placements).toHaveLength(1));
    expect(latest().placements[0]).toMatchObject({
      name: 'Chelsea Market',
      type: 'activity',
      sourceItemId: null,
      ...placeFields(chelseaPlace),
    });
  });

  it('picking a food place yields type Food', async () => {
    const places = fakePlaceSearch({
      suggestions: [tacosSuggestion],
      place: { ...chelseaPlace, id: 'test-tacos', name: tacosSuggestion.name },
    });
    const { user, latest } = await typeInto(places, 'taco');
    await user.click(await screen.findByRole('option', { name: /Los Tacos/ }));
    await waitFor(() => expect(latest().placements).toHaveLength(1));
    expect(latest().placements[0]).toMatchObject({ name: 'Los Tacos No. 1', type: 'food' });
  });

  it('Enter without an active option saves plain text', async () => {
    const places = fakePlaceSearch({ suggestions: [chelseaSuggestion] });
    const { user, latest } = await typeInto(places, 'chel');
    await screen.findByRole('option', { name: /Chelsea Market/ });
    await user.keyboard('{Enter}');
    expect(latest().placements[0]).toMatchObject({ name: 'chel', ...placeFields(null) });
  });

  it('shows "Place search unavailable" and still saves plain text', async () => {
    const { user, latest } = await typeInto(fakePlaceSearch({ fail: true }), 'chel');
    expect(await screen.findByText('Place search unavailable')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(latest().placements[0]).toMatchObject({ name: 'chel', ...placeFields(null) });
  });
});

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
