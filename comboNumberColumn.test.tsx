import * as React from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComboNumberDemo from './ComboNumberDemo';
import { parseComboValue, isValidComboValue } from './comboNumberColumn';

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver = RO;

const cfg = { options: ['N/A', 'TBD', 'Unlimited'] };

function cell(rowId: number, field = 'hours') {
  return document.querySelector(`[data-id="${rowId}"] [data-field="${field}"]`) as HTMLElement;
}

function setup() {
  const commits: any[] = [];
  const user = userEvent.setup();
  render(<ComboNumberDemo onRowCommit={(r) => commits.push(r)} />);
  return { user, commits };
}

describe('parse/validate', () => {
  it('parses', () => {
    expect(parseComboValue('', cfg)).toBe(null);
    expect(parseComboValue('42', cfg)).toBe(42);
    expect(parseComboValue('TBD', cfg)).toBe('TBD');
    expect(parseComboValue('1.5', cfg)).toBe('1.5');
    expect(parseComboValue('1.5', { ...cfg, allowDecimals: true })).toBe(1.5);
    expect(isValidComboValue('abc', cfg)).toBe(false);
    expect(isValidComboValue(-1, cfg)).toBe(false);
    expect(isValidComboValue('N/A', cfg)).toBe(true);
  });
});

describe('combo cell interactions', () => {
  it('renders number right, string left, caret always visible', () => {
    setup();
    expect(cell(1).textContent).toContain('120');
    expect(cell(2).textContent).toContain('TBD');
    expect(within(cell(3)).getByLabelText('Open options')).toBeTruthy();
  });

  it('single click does not enter edit mode', async () => {
    const { user } = setup();
    await user.click(cell(1));
    expect(within(cell(1)).queryByTestId('combo-edit')).toBeNull();
  });

  it('double click enters edit mode with the current value', async () => {
    const { user } = setup();
    await user.dblClick(cell(1));
    const input = within(cell(1)).getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('120');
  });

  it('typing a digit in view mode replaces the value and Enter commits', async () => {
    const { user, commits } = setup();
    await user.click(cell(1));
    await user.keyboard('7');
    const input = within(cell(1)).getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('7');
    await user.keyboard('5{Enter}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe(75));
  });

  it('typing a letter in view mode is ignored', async () => {
    const { user, commits } = setup();
    await user.click(cell(1));
    await user.keyboard('x');
    expect(within(cell(1)).queryByTestId('combo-edit')).toBeNull();
    expect(cell(1).textContent).toContain('120');
    expect(commits).toHaveLength(0);
  });

  it('letters are ignored inside the editor', async () => {
    const { user } = setup();
    await user.dblClick(cell(1));
    await user.keyboard('a9');
    const input = within(cell(1)).getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('1209');
  });

  it('caret click enters edit mode and opens the list; picking commits', async () => {
    const { user, commits } = setup();
    await user.click(within(cell(1)).getByLabelText('Open options'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Unlimited'));
    await waitFor(() => expect(commits.at(-1)?.hours).toBe('Unlimited'));
    expect(within(cell(1)).queryByTestId('combo-edit')).toBeNull();
    expect(cell(1).textContent).toContain('Unlimited');
  });

  it('keyboard: ArrowDown opens, arrows move, Enter selects and commits', async () => {
    const { user, commits } = setup();
    await user.dblClick(cell(3));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe('TBD'));
  });

  it('Alt+ArrowDown on a focused view cell opens the list', async () => {
    const { user } = setup();
    await user.click(cell(3));
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(await screen.findByRole('listbox')).toBeTruthy();
  });

  it('typing with the list open edits the number; Enter commits the number', async () => {
    const { user, commits } = setup();
    await user.click(within(cell(3)).getByLabelText('Open options'));
    await screen.findByRole('listbox');
    await user.keyboard('42');
    expect(screen.getAllByRole('option')).toHaveLength(3); // not filtered
    await user.keyboard('{Enter}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe(42));
  });

  it('digit replaces a selected string', async () => {
    const { user, commits } = setup();
    await user.dblClick(cell(2));
    await user.keyboard('8{Enter}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe(8));
  });

  it('Backspace clears a selected string', async () => {
    const { user, commits } = setup();
    await user.dblClick(cell(2));
    await user.keyboard('{Backspace}{Enter}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe(null));
  });

  it('Delete in view mode clears the cell', async () => {
    const { user, commits } = setup();
    await user.click(cell(1));
    await user.keyboard('{Delete}{Enter}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe(null));
  });

  it('Escape reverts and exits, even with the list open', async () => {
    const { user, commits } = setup();
    await user.click(within(cell(1)).getByLabelText('Open options'));
    await screen.findByRole('listbox');
    await user.keyboard('99{Escape}');
    await waitFor(() => expect(within(cell(1)).queryByTestId('combo-edit')).toBeNull());
    expect(cell(1).textContent).toContain('120');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(commits).toHaveLength(0);
  });

  it('Tab commits the typed number', async () => {
    const { user, commits } = setup();
    await user.dblClick(cell(3));
    await user.keyboard('5{Tab}');
    await waitFor(() => expect(commits.at(-1)?.hours).toBe(5));
  });

  it('stock number column still behaves the same', async () => {
    const { user, commits } = setup();
    await user.click(cell(1, 'quantity'));
    await user.keyboard('9{Enter}');
    await waitFor(() => expect(commits.at(-1)?.quantity).toBe(9));
  });
});
