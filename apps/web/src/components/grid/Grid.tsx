import { useEffect, useState, type CSSProperties } from 'react';
import { days, isMealBlock, orderedBlocks, tripToday, type TripState } from '@cellar/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '../ui/Button';
import { ChevronLeft, ChevronRight, Icon } from '../ui/Icon';
import { BlockLabel } from './BlockLabel';
import { Cell } from './Cell';
import { DayHeader } from './DayHeader';
import type { Forecasts } from '../../state/useForecasts';
import { blockDragId } from './dndIds';
import type { Dispatch } from './PlacementChip';
import styles from './Grid.module.css';

const NARROW = '(max-width: 639px)';

function useIsNarrow(): boolean {
  const query =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW) : null;
  const [narrow, setNarrow] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

interface Props {
  state: TripState;
  dispatch: Dispatch;
  forecasts: Forecasts;
}

export function Grid({ state, dispatch, forecasts }: Props) {
  const allDays = days(state.trip);
  const blocks = orderedBlocks(state);
  const today = tripToday(state, new Date());
  const narrow = useIsNarrow();
  const [dayIndex, setDayIndex] = useState(0);
  const index = Math.min(dayIndex, allDays.length - 1);
  const visible = narrow ? allDays.slice(index, index + 1) : allDays;

  return (
    <div className={styles.root}>
      {narrow ? (
        <div className={styles.dayNav}>
          <Button
            disabled={index === 0}
            onClick={() => setDayIndex(index - 1)}
            aria-label="Previous day"
          >
            <Icon as={ChevronLeft} />
          </Button>
          <span aria-live="polite">
            Day {index + 1} of {allDays.length}
          </span>
          <Button
            disabled={index === allDays.length - 1}
            onClick={() => setDayIndex(index + 1)}
            aria-label="Next day"
          >
            <Icon as={ChevronRight} />
          </Button>
        </div>
      ) : null}
      <div className={styles.scroller}>
        <div className={styles.grid} style={{ '--day-count': visible.length } as CSSProperties}>
          <div className={`${styles.corner} ${styles.headerCell}`} />
          {visible.map((d) => (
            <div
              key={d.date}
              className={`${styles.headerCell} ${d.date === today ? styles.today : ''}`}
            >
              <DayHeader
                isToday={d.date === today}
                state={state}
                date={d.date}
                weekday={d.weekday}
                dispatch={dispatch}
                forecastStatus={forecasts.dayStatus(d.date)}
              />
            </div>
          ))}
          <SortableContext
            items={blocks.map((b) => blockDragId(b.id))}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block) => (
              <div
                key={block.id}
                className={`${styles.row} ${isMealBlock(block) ? styles.meal : ''}`}
                data-meal-row={isMealBlock(block) ? 'true' : undefined}
              >
                <div className={styles.blockLabel}>
                  <BlockLabel state={state} block={block} dispatch={dispatch} />
                </div>
                {visible.map((d) => (
                  <div key={d.date} className={styles.cellWrap}>
                    <Cell
                      state={state}
                      date={d.date}
                      blockId={block.id}
                      blockName={block.name}
                      dispatch={dispatch}
                      weather={forecasts.cellWeather(d.date, block.id)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}
