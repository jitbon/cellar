import { useEffect, useState, type CSSProperties } from 'react';
import { days, orderedBlocks, type TripState } from '@cellar/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '../ui/Button';
import { BlockLabel } from './BlockLabel';
import { Cell } from './Cell';
import { DayHeader } from './DayHeader';
import { blockDragId } from './dndIds';
import type { Dispatch } from './PlacementCard';
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
}

export function Grid({ state, dispatch }: Props) {
  const allDays = days(state.trip);
  const blocks = orderedBlocks(state);
  const narrow = useIsNarrow();
  const [dayIndex, setDayIndex] = useState(0);
  const index = Math.min(dayIndex, allDays.length - 1);
  const visible = narrow ? allDays.slice(index, index + 1) : allDays;

  return (
    <div>
      {narrow ? (
        <div className={styles.dayNav}>
          <Button
            disabled={index === 0}
            onClick={() => setDayIndex(index - 1)}
            aria-label="Previous day"
          >
            ‹
          </Button>
          <span aria-live="polite">
            Day {index + 1} of {allDays.length}
          </span>
          <Button
            disabled={index === allDays.length - 1}
            onClick={() => setDayIndex(index + 1)}
            aria-label="Next day"
          >
            ›
          </Button>
        </div>
      ) : null}
      <div className={styles.scroller}>
        <div
          className={styles.grid}

          style={{ '--day-count': visible.length } as CSSProperties}
        >
          <div className={`${styles.corner} ${styles.headerCell}`}>Time block</div>
          {visible.map((d) => (
            <div key={d.date} className={styles.headerCell}>
              <DayHeader state={state} date={d.date} weekday={d.weekday} dispatch={dispatch} />
            </div>
          ))}
          <SortableContext
            items={blocks.map((b) => blockDragId(b.id))}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block) => (
              <div key={block.id} className={styles.row}>
                <div className={styles.blockLabel}>
                  <BlockLabel state={state} block={block} dispatch={dispatch} />
                </div>
                {visible.map((d) => (
                  <div key={d.date}>
                    <Cell
                      state={state}
                      date={d.date}
                      blockId={block.id}
                      blockName={block.name}
                      dispatch={dispatch}
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
