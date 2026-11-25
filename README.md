# Combo number column (MUI X Data Grid Premium v8)

Built and tested against `@mui/x-data-grid-premium` 8.29, `@mui/material` 7, React 18.

## Files
- `comboNumberColumn.tsx`: the column factory, view cell, edit cell and grid handler
- `ComboNumberDemo.tsx`: example grid with your stock number column beside the combo column
- `comboNumberColumn.test.tsx`: 17 interaction tests (Vitest + Testing Library)

## Integration
```tsx
const apiRef = useGridApiRef();
const { onCellKeyDown } = useComboNumberGridHandlers(apiRef);

const columns = [
  createComboNumberColumn<Row>(
    { field: 'hours', headerName: 'Hours', width: 160,
      renderHeader: (params) => <MyHeader label={params.colDef.headerName} /> },
    { options: ['N/A', 'TBD', 'Unlimited'] /* , allowDecimals: true */ },
  ),
];

<DataGridPremium apiRef={apiRef} columns={columns} onCellKeyDown={onCellKeyDown} ... />
```
- `onCellKeyDown` is required for "letters are ignored" and Alt+ArrowDown. If the grid already
  has an `onCellKeyDown`, call ours first inside it.
- Anything you pass in the first argument (header, width, renderHeader, valueSetter, etc.)
  overrides the defaults. `renderCell` / `renderEditCell` are owned by the factory.
- Commits go through `processRowUpdate` like the stock number columns.
- Defaults: sorting, filtering, aggregation and grouping off.

## Manual test checklist (real browser)
| # | Action | Expected |
|---|---|---|
| 1 | Single click a cell | Cell focuses, no edit mode |
| 2 | Double click | Edit mode, current value in input |
| 3 | Click cell, type `7` | Edit mode, value replaced with `7` |
| 4 | Click cell, type `x` | Nothing happens |
| 5 | Click caret (view mode) | Edit mode + list open in one click |
| 6 | Click an option | Saves, exits edit mode, string shows left-aligned |
| 7 | List open, type `42`, Enter | Saves 42 (list not filtered), right-aligned |
| 8 | Edit mode, ArrowDown | List opens, first option highlighted |
| 9 | Arrows + Enter | Highlighted option saved |
| 10 | Focused view cell, Alt+ArrowDown | Edit mode + list open |
| 11 | Escape (list open or closed) | Reverts and exits |
| 12 | Tab | Saves typed number, moves right |
| 13 | String selected, double click, type `8` | String replaced by 8 |
| 14 | String selected, double click, Backspace, Enter | Cleared |
| 15 | Number cell, Delete key in view mode, Enter | Cleared |
| 16 | List open, click another cell | Saves typed value, list closes |
| 17 | Scroll grid with list open | Check list position (see notes) |
| 18 | Your custom paste into this column | Number or exact option string lands; anything else flagged |

## Notes / known edges to check in your app
- **Popper and scrolling (#17):** the list is portaled so it isn't clipped by the grid. If the
  grid scrolls while it's open it follows the anchor; verify inside your page layout.
- **Paste (#18):** the column's `valueParser` accepts numbers or exact option strings. If your
  custom paste writes rows directly instead of going through the grid, it skips the parser.
- **Zero:** allowed (matches `min: 0` on your number columns). Negative numbers can't be typed.
- **Decimals:** set `allowDecimals: true` in the config.
