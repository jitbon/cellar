import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PlaceSuggestion } from '@cellar/core';
import type { PlaceSuggestionStatus } from '../src/state/usePlaceSuggestions';
import { PlaceNotes, PlaceOptions } from '../src/components/places/PlaceOptions';
import { chelseaSuggestion } from './setup';

const piers: PlaceSuggestion = {
  placeId: 'test-piers',
  name: 'Chelsea Piers',
  address: 'Pier 62, New York, NY, USA',
  types: ['tourist_attraction'],
};

type Opts = Partial<React.ComponentProps<typeof PlaceOptions>> & {
  status?: PlaceSuggestionStatus;
};

function renderOptions({ status = 'ready', ...props }: Opts = {}) {
  const onChoose = vi.fn();
  const all = {
    id: 'places',
    suggestions: [chelseaSuggestion, piers],
    activeIndex: -1,
    onChoose,
    ...props,
  };
  // Hosts render the notes as a sibling after the listbox, never inside it.
  render(
    <div>
      <div role="listbox" aria-label="Suggestions">
        <PlaceOptions {...all} />
      </div>
      <PlaceNotes hasOptions={all.suggestions.length > 0} status={status} />
    </div>,
  );
  return { onChoose };
}

describe('PlaceOptions', () => {
  it('renders a Places group with an option per suggestion showing name and address', () => {
    renderOptions();
    const group = screen.getByRole('group', { name: 'Places' });
    const options = within(group).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Chelsea Market');
    expect(options[0]).toHaveTextContent('9th Avenue, New York, NY, USA');
    expect(options[1]).toHaveTextContent('Chelsea Piers');
  });

  it('marks the active option aria-selected, using the index offset', () => {
    renderOptions({ activeIndex: 3, offset: 2 });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('id', 'places-opt-3');
  });

  it('calls onChoose on mousedown', async () => {
    const { onChoose } = renderOptions();
    await userEvent.setup().pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('option', { name: /Chelsea Piers/ }),
    });
    expect(onChoose).toHaveBeenCalledWith(piers);
  });

  it('shows the Google attribution', () => {
    renderOptions();
    expect(screen.getByText('Powered by Google')).toBeInTheDocument();
  });

  it('keeps notes and attribution outside the listbox', () => {
    renderOptions({ suggestions: [], status: 'unavailable' });
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).queryByRole('status')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Place search unavailable');
    expect(listbox).toBeEmptyDOMElement();
  });

  it('keeps the attribution out of the listbox when there are options', () => {
    renderOptions();
    expect(within(screen.getByRole('listbox')).queryByText('Powered by Google')).toBeNull();
    expect(screen.getByText('Powered by Google')).toBeInTheDocument();
  });

  it('says "No places found" for an empty ready list', () => {
    renderOptions({ suggestions: [] });
    expect(screen.getByText('No places found')).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('says "Place search unavailable" when unavailable', () => {
    renderOptions({ suggestions: [], status: 'unavailable' });
    expect(screen.getByText('Place search unavailable')).toBeInTheDocument();
  });

  it('renders nothing while idle or loading with no results', () => {
    renderOptions({ suggestions: [], status: 'idle' });
    expect(screen.queryByText('Powered by Google')).toBeNull();
    expect(screen.queryByText('No places found')).toBeNull();
  });
});
