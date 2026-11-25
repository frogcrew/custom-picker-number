# Combo Number Cell: Requirements and Acceptance Criteria

Nov 25, 2026 · @Puerto Realty

## Summary

Add a reusable DataGridPremium column whose cell accepts either a typed positive number or a string picked from a fixed dropdown, and that edits like the existing number columns (for example `aircraft_quantity`).

**User story:** As a user editing the grid, I want to type a number into a cell or pick a predefined value from a dropdown, so that I can enter either a quantity or a standard value (such as "N/A" or "TBD") in the same field.

| Item | Value |
| --- | --- |
| Component | `createComboNumberColumn` + `useComboNumberGridHandlers` |
| Grid | MUI X DataGridPremium v8, cell edit mode |
| Reference behavior | Existing stock number columns (`type: 'number'`, `GridEditInputCell`, `min: 0`) |
| Save path | Existing `processRowUpdate` |

## Functional requirements

The cell holds one of three values: a positive number, one of the dropdown strings, or empty.

**Values**

1. Typed values are positive integers, 0 included. Decimals are off by default and can be enabled per column with `allowDecimals`.
2. Dropdown options are a fixed list of strings, the same for every row, set on the column definition.
3. Negative numbers, letters and other characters cannot be typed.

**View mode**

4. The cell shows its value and a caret button. The caret is always visible.
5. Numbers are right-aligned. Dropdown strings are left-aligned.

**Entering edit mode**

6. A single click focuses the cell and does not enter edit mode.
7. A double click enters edit mode with the current value in the input.
8. Typing a digit on a focused cell enters edit mode and replaces the value with that digit.
9. Typing a letter or other non-numeric key on a focused cell does nothing.
10. One click on the caret enters edit mode and opens the dropdown.
11. Alt+ArrowDown on a focused cell enters edit mode and opens the dropdown.

**Editing**

12. With the dropdown open, typing edits the number. The list is not filtered.
13. ArrowDown opens the list. ArrowUp and ArrowDown move through options.
14. When the input shows a dropdown string, typing a digit replaces it.

**Saving and cancelling**

15. Choosing an option (click or Enter on a highlighted option) saves and exits edit mode.
16. Enter with no option highlighted saves the typed number.
17. Tab saves and moves to the next cell.
18. Clicking outside the cell saves the typed value.
19. Escape reverts the change and exits edit mode, whether or not the list is open.
20. Every save goes through `processRowUpdate`, the same as the existing number columns.

**Clearing**

21. Backspace or Delete can clear a number or a selected string. An empty value saves as `null`.

## Acceptance criteria

All 18 criteria must pass in the real app; AC-1 to AC-16 are also covered by automated tests.

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-1 | A combo cell in view mode | The user single-clicks it | The cell is focused and stays in view mode |
| AC-2 | A combo cell in view mode | The user double-clicks it | Edit mode starts with the current value in the input |
| AC-3 | A focused combo cell | The user types `7` | Edit mode starts and the input shows `7` (old value replaced) |
| AC-4 | A focused combo cell | The user types `x` | Nothing happens; the value is unchanged |
| AC-5 | A combo cell in view mode | The user clicks the caret once | Edit mode starts and the dropdown opens |
| AC-6 | The dropdown is open | The user clicks an option | The option is saved, edit mode ends and the string shows left-aligned |
| AC-7 | The dropdown is open | The user types `42` and presses Enter | All options still show while typing; 42 is saved, right-aligned |
| AC-8 | Edit mode, list closed | The user presses ArrowDown | The list opens with the first option highlighted |
| AC-9 | The list is open | The user uses ArrowUp/ArrowDown then Enter | The highlighted option is saved |
| AC-10 | A focused combo cell | The user presses Alt+ArrowDown | Edit mode starts and the dropdown opens |
| AC-11 | Edit mode, list open or closed | The user presses Escape | The change is reverted and edit mode ends |
| AC-12 | Edit mode with a typed number | The user presses Tab | The number is saved and focus moves right |
| AC-13 | A cell showing a dropdown string | The user double-clicks and types `8` | The string is replaced by 8 |
| AC-14 | A cell showing a dropdown string | The user double-clicks, presses Backspace, then Enter | The cell is saved as empty |
| AC-15 | A focused cell with a number | The user presses Delete, then Enter | The cell is saved as empty |
| AC-16 | Edit mode | The user types a letter | The letter is ignored |
| AC-17 | The dropdown is open | The user clicks another cell | The typed value is saved and the list closes |
| AC-18 | The dropdown is open | The grid or page scrolls | The list stays attached to the cell |

Existing number columns must behave exactly as before (regression check).

## Out of scope

These are excluded from this ticket and can be follow-ups.

| Item | Current behavior | Follow-up |
| --- | --- | --- |
| Decimals | Off; only whole numbers can be typed | Confirm requirement, then set `allowDecimals: true` |
| Sorting | Disabled on the column | None planned |
| Filtering, aggregation, grouping | Disabled on the column | Revisit if needed |
| Grid clipboard paste | Not handled by the grid; custom paste logic exists elsewhere | Verify custom paste writes valid values (see Open questions) |
| Cross-grid sync | Not handled by the component; global state owns sync | None; column is reusable in any grid |
| Required-field validation | Not in the component; flagged by the backend | None |
| Options per row or from an API | Not supported; list is static | Revisit if needed |

## Technical notes

The column is built from a factory and needs one grid-level handler; everything else is self-contained in `comboNumberColumn.tsx`.

- **Column factory:** `createComboNumberColumn(colDef, { options, allowDecimals })` returns a `GridColDef` with custom `renderCell` and `renderEditCell`. Header, width and `renderHeader` are passed in as usual.
- **Grid handler (required):** `useComboNumberGridHandlers(apiRef)` returns `onCellKeyDown`. It blocks letter keys from starting edit mode and handles Alt+ArrowDown. If the grid already has an `onCellKeyDown`, call this one first inside it.
- **Value handling:** `valueParser` and `valueSetter` turn input into a number, an option string or `null`. `preProcessEditCellProps` flags anything else as an error.
- **Display:** `valueFormatter` formats numbers with `toLocaleString()`.
- **Dropdown:** rendered in a portaled MUI `Popper` so the grid doesn't clip it. Options are chosen on `mousedown` so the save runs before the grid's click-away logic.
- **Accessibility:** the input has `role="combobox"` with `aria-expanded` and `aria-activedescendant`; the list uses `role="listbox"` and `role="option"`.
- **Tested against:** `@mui/x-data-grid-premium` 8.29, `@mui/material` 7, React 18. 17 Vitest + Testing Library tests in `comboNumberColumn.test.tsx`.

## Open questions and risks

- [ ] Real dropdown option list (current values "N/A", "TBD", "Unlimited" are placeholders)
- [ ] Are decimals needed?
- [ ] Does the custom paste logic go through the column's `valueParser`, or write rows directly? If directly, invalid text could be saved.
- [ ] Should 0 be allowed? It currently is, matching `min: 0` on the number columns.

**Risk:** dropdown position while scrolling and layout have not been verified yet. The automated tests run in a simulated browser that can't check layout, so AC-17 and AC-18 need a manual test in the real app.

## Definition of done

- [ ] Column integrated in the target grid with the real options and header
- [ ] `onCellKeyDown` wired on that grid
- [ ] AC-1 to AC-18 pass in the real app
- [ ] Automated tests pass in CI
- [ ] Existing number columns show no regressions
- [ ] Code reviewed and merged
