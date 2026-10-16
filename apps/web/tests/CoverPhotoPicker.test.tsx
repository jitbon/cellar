import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoverPhotoPicker } from '../src/components/photos/CoverPhotoPicker';
import { cityPhoto, fakeCityPhotos, withServices } from './setup';

const seven = [...'ABCDEFG'].map((l) => cityPhoto(`Kyoto_${l}.jpg`, `Author ${l}`));

function setup(opts: { current?: string | null; fail?: boolean; photos?: typeof seven } = {}) {
  const cityPhotos = fakeCityPhotos({ photos: opts.photos ?? seven, fail: opts.fail });
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <CoverPhotoPicker
      cityName="Kyoto, Japan"
      current={opts.current ?? null}
      onPick={onPick}
      onClose={onClose}
    />,
    { wrapper: withServices({ cityPhotos }) },
  );
  return { cityPhotos, onPick, onClose, user: userEvent.setup() };
}

describe('CoverPhotoPicker', () => {
  it('lists up to 6 choices with images and credits', async () => {
    const { cityPhotos } = setup();
    expect(await screen.findByRole('dialog', { name: 'Change cover photo' })).toBeInTheDocument();
    const choices = await screen.findAllByRole('button', { name: /^Photo \d by / });
    expect(choices).toHaveLength(6);
    expect(cityPhotos.more).toHaveBeenCalledWith('Kyoto, Japan', 6);
    expect(choices[0]).toHaveAccessibleName('Photo 1 by Author A');
    expect(choices[0]!.querySelector('img')).toHaveAttribute(
      'src',
      'https://photos.test/city/Kyoto_A.jpg',
    );
    expect(screen.getByRole('link', { name: 'Photo: Author A · CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/wiki/File:Kyoto_A.jpg',
    );
  });

  it('marks the current photo selected', async () => {
    setup({ current: 'Kyoto_C.jpg' });
    const choices = await screen.findAllByRole('button', { name: /^Photo \d by / });
    expect(choices.map((c) => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('picking a photo calls onPick with its file name', async () => {
    const { onPick, user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Photo 2 by Author B' }));
    expect(onPick).toHaveBeenCalledWith('Kyoto_B.jpg');
  });

  it('"Use automatic photo" calls onPick(null)', async () => {
    const { onPick, user } = setup({ current: 'Kyoto_B.jpg' });
    await user.click(await screen.findByRole('button', { name: 'Use automatic photo' }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('says photos are unavailable when the service fails, and can still go automatic', async () => {
    const { onPick, user } = setup({ fail: true });
    expect(await screen.findByText('Photos unavailable right now')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /^Photo \d by / })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Use automatic photo' }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('says so when the city has no other photos', async () => {
    setup({ photos: [] });
    await waitFor(() => expect(screen.getByText('No photos found')).toBeInTheDocument());
  });
});
