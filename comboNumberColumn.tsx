/**
 * Combo number column for MUI X Data Grid Premium v8.
 *
 * A cell that holds either a positive number the user types, or one of a fixed
 * list of strings picked from a dropdown.
 *
 * Behavior
 *  - View mode: value + an always-visible caret. Numbers and strings are left-aligned.
 *  - Single click: focuses the cell only. Double click: edit mode.
 *  - Typing a digit (or "." when allowDecimals) in view mode: edit mode, value replaced.
 *    Letters and other characters are ignored.
 *  - Caret click (or Alt+ArrowDown on a focused cell): edit mode with the list open.
 *  - In edit mode: typing edits the number only (list is not filtered).
 *    ArrowUp/ArrowDown move through options, Enter on a highlighted option or a
 *    mouse click on an option saves and exits. Enter with nothing highlighted
 *    saves the typed number. Escape reverts and exits. Tab saves and moves.
 *  - Backspace/Delete clears (numbers or selected strings).
 *
 * All changes commit through the grid's normal edit lifecycle, so
 * processRowUpdate / onProcessRowUpdateError fire exactly as they do for
 * the stock number columns.
 *
 * Wiring (once per grid):
 *   const apiRef = useGridApiRef();
 *   const { onCellKeyDown } = useComboNumberGridHandlers(apiRef);
 *   <DataGridPremium apiRef={apiRef} onCellKeyDown={onCellKeyDown} ... />
 * If the grid already has an onCellKeyDown, call handleComboCellKeyDown at the top of it
 * instead, and return when it returns true:
 *   if (handleComboCellKeyDown(apiRef, params, event)) return;
 */
import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import { createSvgIcon } from '@mui/material/utils';
import {
  GridCellModes,
  useGridApiContext,
  type GridApiPremium,
  type GridCellParams,
  type GridColDef,
  type GridRenderCellParams,
  type GridRenderEditCellParams,
  type GridRowId,
  type GridValidRowModel,
  type MuiEvent,
} from '@mui/x-data-grid-premium';

const ArrowDropDownIcon = createSvgIcon(<path d="M7 10l5 5 5-5z" />, 'ArrowDropDown');

// ---------------------------------------------------------------------------
// Types and config
// ---------------------------------------------------------------------------

export type ComboValue = number | string | null;

export interface ComboNumberConfig {
  /** Fixed dropdown options, same for every row. */
  options: readonly string[];
  /** Allow decimals in typed numbers. Off by default (positive integers only). */
  allowDecimals?: boolean;
}

type ComboColDef<R extends GridValidRowModel> = GridColDef<R, ComboValue> & {
  comboConfig: ComboNumberConfig;
};

const getConfig = (colDef: unknown): ComboNumberConfig | undefined =>
  (colDef as Partial<ComboColDef<GridValidRowModel>> | undefined)?.comboConfig;

const numberPattern = (config: ComboNumberConfig) =>
  config.allowDecimals ? /^\d*\.?\d*$/ : /^\d*$/;

const isOption = (config: ComboNumberConfig, text: unknown): text is string =>
  typeof text === 'string' && config.options.includes(text);

/** Keys that may start edit mode from view mode. Everything printable else is ignored. */
const isAllowedStartKey = (key: string, config: ComboNumberConfig) =>
  /^\d$/.test(key) || (!!config.allowDecimals && key === '.');

const isPrintableKey = (event: React.KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

/**
 * Turns raw input (typed text, pasted text, '' from a cleared cell) into the
 * stored value. Invalid input is returned unchanged so validation can flag it.
 */
export function parseComboValue(raw: unknown, config: ComboNumberConfig): ComboValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (text === '') return null;
  if (isOption(config, text)) return text;
  if (numberPattern(config).test(text) && text !== '.') return Number(text);
  return text; // invalid, caught by isValidComboValue
}

export function isValidComboValue(value: unknown, config: ComboNumberConfig): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && (!!config.allowDecimals || Number.isInteger(value));
  }
  return isOption(config, value);
}

const toInputString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

// ---------------------------------------------------------------------------
// "Open the list when the editor mounts" flag, scoped per grid instance
// ---------------------------------------------------------------------------

const pendingOpen = new WeakMap<object, Set<string>>();
const cellKey = (id: GridRowId, field: string) => `${String(id)}\u0000${field}`;

function markPendingOpen(api: object, id: GridRowId, field: string) {
  let set = pendingOpen.get(api);
  if (!set) {
    set = new Set();
    pendingOpen.set(api, set);
  }
  set.add(cellKey(id, field));
}
const hasPendingOpen = (api: object, id: GridRowId, field: string) =>
  !!pendingOpen.get(api)?.has(cellKey(id, field));
const clearPendingOpen = (api: object, id: GridRowId, field: string) =>
  pendingOpen.get(api)?.delete(cellKey(id, field));

type ApiLike = Pick<GridApiPremium, 'getCellMode' | 'startCellEditMode'>;

function startEditWithListOpen(api: ApiLike, id: GridRowId, field: string) {
  if (api.getCellMode(id, field) !== GridCellModes.View) return;
  markPendingOpen(api, id, field);
  api.startCellEditMode({ id, field });
}

// ---------------------------------------------------------------------------
// Grid-level handler (needed for "ignore letters" and Alt+ArrowDown)
// ---------------------------------------------------------------------------

/**
 * Plain function version, for calling inside an existing onCellKeyDown.
 * Returns true when it handled the key; the caller should then stop.
 */
export function handleComboCellKeyDown(
  apiRef: React.RefObject<GridApiPremium | null>,
  params: GridCellParams,
  event: React.KeyboardEvent,
): boolean {
  const config = getConfig(params.colDef);
  if (!config || params.cellMode !== GridCellModes.View || !params.isEditable) return false;
  const muiEvent = event as MuiEvent<React.KeyboardEvent>;

  // Alt+ArrowDown: open the list (like a native select)
  if (event.altKey && event.key === 'ArrowDown') {
    event.preventDefault();
    muiEvent.defaultMuiPrevented = true;
    if (apiRef.current) startEditWithListOpen(apiRef.current, params.id, params.field);
    return true;
  }

  // Printable keys that are not digits (or "." with decimals): do nothing.
  if (isPrintableKey(event) && !isAllowedStartKey(event.key, config)) {
    muiEvent.defaultMuiPrevented = true;
    return true;
  }
  return false;
}

/** Hook version, for grids with no onCellKeyDown of their own. */
export function useComboNumberGridHandlers(apiRef: React.RefObject<GridApiPremium | null>) {
  const onCellKeyDown = React.useCallback(
    (params: GridCellParams, event: MuiEvent<React.KeyboardEvent<HTMLElement>>) => {
      handleComboCellKeyDown(apiRef, params, event);
    },
    [apiRef],
  );
  return { onCellKeyDown };
}

// ---------------------------------------------------------------------------
// View cell
// ---------------------------------------------------------------------------

function ComboViewCell(props: GridRenderCellParams<GridValidRowModel, ComboValue>) {
  const { id, field, value, formattedValue, isEditable } = props;
  const apiRef = useGridApiContext();

  const handleCaretClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // no cellClick (row selection etc.)
    if (!isEditable) return;
    startEditWithListOpen(apiRef.current, id, field);
  };

  return (
    <Box
      data-testid="combo-view"
      sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', gap: 0.25 }}
    >
      <Box
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
      >
        {(formattedValue as React.ReactNode) ?? toInputString(value)}
      </Box>
      <IconButton
        size="small"
        tabIndex={-1}
        aria-label="Open options"
        disabled={!isEditable}
        onClick={handleCaretClick}
        onDoubleClick={(event) => event.stopPropagation()}
        sx={{ p: 0.25, flexShrink: 0 }}
      >
        <ArrowDropDownIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Edit cell
// ---------------------------------------------------------------------------

function ComboEditCell(props: GridRenderEditCellParams<GridValidRowModel, ComboValue>) {
  const { id, field, value, hasFocus, colDef } = props;
  const config = getConfig(colDef)!;
  const { options } = config;
  const apiRef = useGridApiContext();
  const pattern = numberPattern(config);
  const listId = React.useId();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = React.useState(() => toInputString(value));
  const [open, setOpen] = React.useState(() => hasPendingOpen(apiRef.current, id, field));
  const [highlighted, setHighlighted] = React.useState(() =>
    isOption(config, value) ? options.indexOf(value) : -1,
  );

  React.useEffect(() => {
    clearPendingOpen(apiRef.current, id, field);
  }, [apiRef, id, field]);

  // Focus synchronously so the keystroke that started editing lands in the input
  // (same approach as GridEditInputCell).
  React.useLayoutEffect(() => {
    const input = inputRef.current;
    if (hasFocus && input) {
      input.focus();
      if (isOption(config, input.value)) input.select(); // typing replaces the string
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocus]);

  const updateValue = (next: string) => {
    setInputValue(next);
    apiRef.current.setEditCellValue({ id, field, value: next });
  };

  const selectOption = async (option: string) => {
    setOpen(false);
    await apiRef.current.setEditCellValue({ id, field, value: option });
    apiRef.current.stopCellEditMode({ id, field });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    const native = event.nativeEvent as Partial<InputEvent>;
    let candidate = next;

    // Input currently shows a dropdown string: deleting clears it, typing a digit replaces it.
    if (isOption(config, inputValue) && next !== inputValue && !pattern.test(next)) {
      if (native.inputType?.startsWith('delete') || next.length < inputValue.length) {
        candidate = '';
      } else if (native.data && pattern.test(native.data)) {
        candidate = native.data;
      } else {
        return;
      }
    }

    if (!pattern.test(candidate) || candidate === inputValue) return; // ignore letters etc.
    setHighlighted(-1);
    updateValue(candidate);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key, altKey } = event;
    const swallow = () => {
      event.preventDefault();
      event.stopPropagation(); // keep the grid from acting on this key
    };

    if (!open) {
      if (key === 'ArrowDown') {
        swallow();
        setOpen(true);
        if (!altKey && highlighted < 0) setHighlighted(0);
      } else if (key === 'ArrowUp') {
        swallow();
      }
      return; // Enter / Tab / Escape fall through to the grid
    }

    switch (key) {
      case 'ArrowDown':
        swallow();
        if (altKey) return;
        setHighlighted((h) => (h + 1) % options.length);
        break;
      case 'ArrowUp':
        swallow();
        if (altKey) {
          setOpen(false);
          return;
        }
        setHighlighted((h) => (h <= 0 ? options.length - 1 : h - 1));
        break;
      case 'Enter':
        if (highlighted >= 0) {
          swallow();
          selectOption(options[highlighted]);
        } else {
          setOpen(false); // let the grid commit the typed number
        }
        break;
      default:
        break; // Escape reverts via the grid, Tab commits via the grid
    }
  };

  const toggleOpen = (event: React.MouseEvent) => {
    event.stopPropagation();
    setOpen((o) => !o);
    inputRef.current?.focus();
  };

  const activeId = open && highlighted >= 0 ? `${listId}-opt-${highlighted}` : undefined;

  return (
    <Box
      ref={setAnchor}
      data-testid="combo-edit"
      sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', gap: 0.25 }}
    >
      <InputBase
        fullWidth
        inputRef={inputRef}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        inputProps={{
          role: 'combobox',
          inputMode: config.allowDecimals ? 'decimal' : 'numeric',
          'aria-autocomplete': 'none',
          'aria-expanded': open,
          'aria-controls': open ? listId : undefined,
          'aria-activedescendant': activeId,
        }}
        sx={{
          fontSize: 'inherit',
          height: '100%',
          // 9px + the editing cell's 1px padding = the view cell's 10px, so text doesn't shift
          '& input': { p: '0 4px 0 9px', textAlign: 'left' },
        }}
      />
      <IconButton
        size="small"
        tabIndex={-1}
        aria-label={open ? 'Close options' : 'Open options'}
        onMouseDown={(event) => event.preventDefault()} // keep focus in the input
        onClick={toggleOpen}
        onDoubleClick={(event) => event.stopPropagation()}
        sx={{ p: 0.25, mr: 1, flexShrink: 0 }}
      >
        <ArrowDropDownIcon fontSize="small" />
      </IconButton>

      <Popper
        open={open && !!anchor}
        anchorEl={anchor}
        placement="bottom-start"
        sx={(theme) => ({ zIndex: theme.zIndex.modal })}
      >
        <Paper
          elevation={8}
          onMouseDown={(event) => event.preventDefault()}
          sx={{ minWidth: anchor?.offsetWidth, maxHeight: 280, overflowY: 'auto' }}
        >
          <List dense role="listbox" id={listId}>
            {options.map((option, index) => (
              <ListItemButton
                key={option}
                id={`${listId}-opt-${index}`}
                role="option"
                tabIndex={-1}
                selected={index === highlighted}
                aria-selected={index === highlighted}
                onMouseEnter={() => setHighlighted(index)}
                // mousedown, not click: commits before the grid's click-away (mouseup) logic runs
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
              >
                {option}
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Popper>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

export function createComboNumberColumn<R extends GridValidRowModel = GridValidRowModel>(
  colDef: Omit<GridColDef<R, ComboValue>, 'type' | 'renderCell' | 'renderEditCell'>,
  config: ComboNumberConfig,
): GridColDef<R, ComboValue> {
  const column: ComboColDef<R> = {
    editable: true,
    sortable: false,
    filterable: false,
    aggregable: false,
    groupable: false,
    valueFormatter: (value: unknown) =>
      (typeof value === 'number' ? value.toLocaleString() : (value ?? '')) as never,
    valueParser: (value) => parseComboValue(value, config),
    valueSetter: (value, row) => ({ ...row, [colDef.field]: parseComboValue(value, config) }),
    preProcessEditCellProps: (params) => ({
      ...params.props,
      error: !isValidComboValue(parseComboValue(params.props.value, config), config),
    }),
    ...colDef,
    renderCell: (params) => <ComboViewCell {...(params as GridRenderCellParams)} />,
    renderEditCell: (params) => <ComboEditCell {...(params as GridRenderEditCellParams)} />,
    comboConfig: config,
  };
  return column;
}
