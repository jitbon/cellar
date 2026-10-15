import { useId, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  addTypedPlacement,
  cell,
  isGreyed,
  placeItem,
  suggestItems,
  type CellWeather,
  type ISODate,
  type Item,
  type TripState,
} from '@cellar/core';
import { CellSuggestions, optionId } from './CellSuggestions';
import { cellDropId, placementDragId } from './dndIds';
import { WeatherIcon } from '../weather/WeatherIcon';
import { PlacementCard, type Dispatch } from './PlacementCard';
import styles from './Cell.module.css';

interface Props {
  state: TripState;
  date: ISODate;
  blockId: string;
  blockName: string;
  dispatch: Dispatch;
  weather?: CellWeather | null;
}

export function Cell({ state, date, blockId, blockName, dispatch, weather = null }: Props) {
  const placements = cell(state, date, blockId);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const label = `Add event to ${blockName} on ${date}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellDropId(date, blockId) });
  const greyed = isGreyed(state, date, blockId);
  const suggestions = adding ? suggestItems(state, text) : [];

  function reset() {
    setText('');
    setError(null);
    setActiveIndex(-1);
    inputRef.current?.focus(); // ready for the next event in this cell
  }

  function submit() {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      choose(suggestions[activeIndex]);
      return;
    }
    if (text.trim() === '') return;
    const last = placements.at(-1);
    const result = dispatch(addTypedPlacement(date, blockId, text, last?.id));
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    reset();
  }

  function choose(item: Item) {
    const result = dispatch(placeItem(item.id, date, blockId));
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    reset();
  }

  function close() {
    setAdding(false);
    setText('');
    setError(null);
    setActiveIndex(-1);
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.cell} ${isOver ? styles.over : ''} ${greyed ? styles.greyed : ''}`}
    >
      {weather ? <WeatherIcon blockName={blockName} weather={weather} /> : null}
      {greyed ? (
        <span className={styles.travelNote} role="img" aria-label="Outside travel window">
          ✈ Outside travel window
        </span>
      ) : null}
      <SortableContext
        items={placements.map((p) => placementDragId(p.id))}
        strategy={verticalListSortingStrategy}
      >
        {placements.map((p) => (
          <PlacementCard key={p.id} state={state} placement={p} dispatch={dispatch} />
        ))}
      </SortableContext>
      {adding ? (
        <div>
          <input
            ref={inputRef}
            autoFocus
            className={styles.input}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={suggestions.length > 0 ? listId : undefined}
            aria-activedescendant={activeIndex >= 0 ? optionId(listId, activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label={label}
            value={text}
            placeholder="Type an event…"
            onChange={(e) => {
              setText(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                e.preventDefault();
                setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
              }
            }}
            onBlur={() => {
              if (text.trim() === '') close();
            }}
          />
          <CellSuggestions
            id={listId}
            items={suggestions}
            activeIndex={activeIndex}
            onChoose={choose}
          />
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className={styles.add}
          aria-label={label}
          onClick={() => setAdding(true)}
        >
          +
        </button>
      )}
    </div>
  );
}
