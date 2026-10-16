import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhotoCredit } from '../src/components/photos/PhotoCredit';

describe('PhotoCredit', () => {
  it('shows author and license as a link to the source that opens in a new tab', () => {
    render(<PhotoCredit credit="Jane Doe" license="CC BY-SA 4.0" href="https://commons.test/x" />);
    const link = screen.getByRole('link', { name: 'Photo: Jane Doe · CC BY-SA 4.0' });
    expect(link).toHaveAttribute('href', 'https://commons.test/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows just the author when there is no license', () => {
    render(<PhotoCredit credit="Ann Lee" href="https://maps.test/1" />);
    expect(screen.getByRole('link', { name: 'Photo: Ann Lee' })).toBeInTheDocument();
  });

  it('is plain text when there is no link', () => {
    render(<PhotoCredit credit="Ann Lee" href={null} />);
    expect(screen.getByText('Photo: Ann Lee')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders nothing without a credit', () => {
    const { container } = render(<PhotoCredit credit="" href={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has a variant for light text over photos', () => {
    render(<PhotoCredit credit="Jane Doe" href="https://x.test" variant="onPhoto" />);
    expect(screen.getByRole('link')).toHaveAttribute('data-variant', 'onPhoto');
  });
});
