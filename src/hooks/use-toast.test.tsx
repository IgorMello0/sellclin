import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { toast, useToast } from './use-toast';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('honors custom duration and publishes standalone success notifications', () => {
  vi.useFakeTimers();
  const { result } = renderHook(useToast);
  act(() => result.current.dismiss());
  act(() => toast({ title: 'Saved', variant: 'success', duration: 8000 }));
  expect(result.current.toasts[0].variant).toBe('success');
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.toasts).toHaveLength(1);
  act(() => vi.advanceTimersByTime(3000));
  expect(result.current.toasts).toHaveLength(0);
});

it('deduplicates repeated notifications and removes them after the default duration', () => {
  vi.useFakeTimers();
  const { result } = renderHook(useToast);
  act(() => result.current.dismiss());
  act(() => { toast({ title: 'Error' }); toast({ title: 'Error' }); });
  expect(result.current.toasts).toHaveLength(1);
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.toasts).toHaveLength(0);
});
