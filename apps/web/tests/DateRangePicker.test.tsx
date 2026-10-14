import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DateRangePicker } from '../src/components/ui/DateRangePicker';

function Harness({ start = '', end = '' }: { start?: string; end?: string }) {
  const [range, setRange] = useState({ start, end });
  return (
    <DateRangePicker
      start={range.start}
      end={range.end}
      onChange={(s, e) => setRange({ start: s, end: e })}
    />
  );
}

const day = (label: RegExp) => screen.getByRole('button', { name: label });

describe('DateRangePicker', () => {
  it('picks a start then an end day from the calendar', async () => {
    const user = userEvent.setup();
    render(<Harness start="2027-04-10" end="2027-04-12" />);
    await user.click(day(/April 3, 2027/));
    expect(screen.getByLabelText('Start date')).toHaveValue('2027-04-03');
    expect(screen.getByLabelText('End date')).toHaveValue('');
    expect(screen.getByText('Now pick your last day')).toBeInTheDocument();

    await user.click(day(/May 2, 2027/));
    expect(screen.getByLabelText('End date')).toHaveValue('2027-05-02');
    expect(day(/April 3, 2027/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/30 days/)).toBeInTheDocument();
  });

  it('restarts the range when the second click is before the start', async () => {
    const user = userEvent.setup();
    render(<Harness start="2027-04-10" />);
    await user.click(day(/April 5, 2027/));
    expect(screen.getByLabelText('Start date')).toHaveValue('2027-04-05');
    expect(screen.getByLabelText('End date')).toHaveValue('');
  });

  it('arrow keys move focus across days and into the next month', async () => {
    const user = userEvent.setup();
    render(<Harness start="2027-05-28" end="2027-05-30" />);
    day(/May 28, 2027/).focus();
    await user.keyboard('{ArrowDown}');
    expect(day(/June 4, 2027/)).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(day(/July 2, 2027/)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Start date')).toHaveValue('2027-07-02');
  });
});
