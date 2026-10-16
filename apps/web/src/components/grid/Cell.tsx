import { useId, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  addTypedPlacement,
  cell,
  isFoodPlace,
  greyedSide,
  placeItem,
  suggestItems,
  suggestNear,
  type CellWeather,
  type ISODate,
  type Item,
  type PlaceSuggestion,
  type TripState,
} from '@cellar/core';
import { CellSuggestions, optionId } from './CellSuggestions';
import { cellDropId, placementDragId, useDragOverId } from './dndIds';
import { WeatherIcon } from '../weather/WeatherIcon';
import { CellListPopover } from './CellListPopover';
import { PlacementChip, type Dispatch } from './PlacementChip';
import { PlaneLanding, PlaneTakeoff, Icon, Plus } from '../ui/Icon';
import { visibleChips } from '../../lib/cellOverflow';
import { usePlaceSuggestions } from '../../state/usePlaceSuggestions';
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
  const { shown, more } = visibleChips(placements.length);
  const [listOpen, setListOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const label = `Add event to ${blockName} on ${date}`;
  // Outside the travel window: nothing new goes in (events already here stay and can move out).
  const side = greyedSide(state, date, blockId);
  const greyed = side !== null;
  const { setNodeRef } = useDroppable({ id: cellDropId(date, blockId), disabled: greyed });
  const overId = useDragOverId();
  const overCell = overId === cellDropId(date, blockId);
  // Over the cell itself, or over one of its chips (the collision logic prefers chips).
  const isOver =
    overCell || (overId !== null && placements.some((p) => placementDragId(p.id) === overId));
  const suggestions = adding ? suggestItems(state, text) : [];
  const places = usePlaceSuggestions(adding ? text : '', suggestNear(state, date));
  const [pickFailed, setPickFailed] = useState(false);
  const placeStatus = pickFailed ? 'unavailable' : places.status;
  const optionCount = suggestions.length + places.suggestions.length;

  function reset() {
    setText('');
    setError(null);
    setActiveIndex(-1);
    setPickFailed(false);
    inputRef.current?.focus(); // ready for the next event in this cell
  }

  function submit() {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      choose(suggestions[activeIndex]);
      return;
    }
    const suggested = places.suggestions[activeIndex - suggestions.length];
    if (activeIndex >= 0 && suggested) {
      choosePlace(suggested);
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

  function choosePlace(suggestion: PlaceSuggestion) {
    places.pick(suggestion).then(
      (place) => {
        const last = placements.at(-1);
        const result = dispatch(
          addTypedPlacement(date, blockId, place.name, last?.id, {
            place,
            type: isFoodPlace(suggestion.types) ? 'food' : 'activity',
          }),
        );
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        reset();
      },
      // Keep the typed text so it can still be saved as a plain event.
      () => {
        setPickFailed(true);
        setActiveIndex(-1);
      },
    );
  }

  function close() {
    setAdding(false);
    setText('');
    setError(null);
    setActiveIndex(-1);
    setPickFailed(false);
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.cell} ${isOver ? styles.over : ''} ${greyed ? styles.greyed : ''}`}
      data-drop-target={isOver ? 'true' : undefined}
      data-testid={`cell:${date}:${blockName}`}
    >
      {weather ? (
        <span className={styles.weather}>
          <WeatherIcon blockName={blockName} weather={weather} />
        </span>
      ) : null}
      {greyed ? (
        <span
          className={styles.travelNote}
          role="img"
          aria-label={
            side === 'before-arrival'
              ? 'Outside travel window (before arrival)'
              : 'Outside travel window (after departure)'
          }
        >
          {/* Landing before the day's arrival, take-off after its departure (as in the day header). */}
          <Icon as={side === 'before-arrival' ? PlaneLanding : PlaneTakeoff} size="small" />
        </span>
      ) : null}
      <SortableContext
        items={placements.slice(0, shown).map((p) => placementDragId(p.id))}
        strategy={verticalListSortingStrategy}
      >
        {placements.slice(0, shown).map((p) => (
          <PlacementChip key={p.id} state={state} placement={p} dispatch={dispatch} />
        ))}
      </SortableContext>
      {more > 0 ? (
        <div ref={moreRef} className={styles.moreWrap}>
          <button
            type="button"
            className={styles.more}
            aria-label={`Show all ${placements.length} events in ${blockName} on ${date}`}
            aria-expanded={listOpen}
            onClick={() => setListOpen((o) => !o)}
          >
            +{more} more
          </button>
          {listOpen ? (
            <CellListPopover
              state={state}
              date={date}
              blockId={blockId}
              blockName={blockName}
              placements={placements}
              dispatch={dispatch}
              anchorRef={moreRef}
              onClose={() => setListOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
      {overCell && !adding ? <span className={styles.insertEnd} aria-hidden="true" /> : null}
      {adding && !greyed ? (
        <div>
          <input
            ref={inputRef}
            autoFocus
            className={styles.input}
            role="combobox"
            aria-expanded={optionCount > 0}
            aria-controls={optionCount > 0 ? listId : undefined}
            aria-activedescendant={activeIndex >= 0 ? optionId(listId, activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label={label}
            value={text}
            placeholder="Type an event…"
            onChange={(e) => {
              setText(e.target.value);
              setActiveIndex(-1);
              setPickFailed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              } else if (e.key === 'ArrowDown' && optionCount > 0) {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % optionCount);
              } else if (e.key === 'ArrowUp' && optionCount > 0) {
                e.preventDefault();
                setActiveIndex((i) => (i <= 0 ? optionCount - 1 : i - 1));
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
            places={places.suggestions}
            placeStatus={placeStatus}
            onChoosePlace={choosePlace}
          />
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>
      ) : greyed ? null : (
        <button
          type="button"
          className={`${styles.add} ${placements.length === 0 ? styles.addEmpty : styles.addCorner}`}
          aria-label={label}
          onClick={() => setAdding(true)}
        >
          <Icon as={Plus} size="small" />
          {placements.length === 0 ? <span>Add</span> : null}
        </button>
      )}
    </div>
  );
}
