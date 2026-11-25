import * as React from 'react';
import {
  DataGridPremium,
  GridEditInputCell,
  useGridApiRef,
  type GridCellParams,
  type GridColDef,
} from '@mui/x-data-grid-premium';
import { createComboNumberColumn, handleComboCellKeyDown, type ComboValue } from './comboNumberColumn';

type Row = { id: number; name: string; quantity: number | null; hours: ComboValue };

// Placeholder options: swap for the real list.
const HOURS_OPTIONS = ['N/A', 'TBD', 'Unlimited'] as const;

const initialRows: Row[] = [
  { id: 1, name: 'Item A', quantity: 3, hours: 120 },
  { id: 2, name: 'Item B', quantity: 1, hours: 'TBD' },
  { id: 3, name: 'Item C', quantity: null, hours: null },
];

const columns: GridColDef<Row>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  {
    // Existing stock number column, for side-by-side comparison
    field: 'quantity',
    headerName: 'Quantity',
    width: 140,
    editable: true,
    type: 'number',
    align: 'right',
    renderEditCell: (params) => <GridEditInputCell {...params} inputProps={{ min: 0 }} />,
  },
  createComboNumberColumn<Row>(
    { field: 'hours', headerName: 'Hours', width: 160 },
    { options: HOURS_OPTIONS /* , allowDecimals: true */ },
  ),
];

export interface ComboNumberDemoProps {
  onRowCommit?: (row: Row) => void;
}

export default function ComboNumberDemo({ onRowCommit }: ComboNumberDemoProps) {
  const apiRef = useGridApiRef();
  // Same shape as an existing grid-level handler: the combo call goes first.
  const onCellKeyDown = React.useMemo(
    () => (params: GridCellParams, event: React.KeyboardEvent<HTMLElement>) => {
      if (handleComboCellKeyDown(apiRef, params, event)) return;
      // ...existing onCellKeyDown logic would continue here
    },
    [apiRef],
  );
  const [rows] = React.useState(initialRows);

  return (
    <div style={{ height: 320, width: '100%' }}>
      <DataGridPremium
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        onCellKeyDown={onCellKeyDown}
        processRowUpdate={(newRow: Row) => {
          onRowCommit?.(newRow);
          return newRow;
        }}
        onProcessRowUpdateError={(error) => console.error(error)}
        disableVirtualization
      />
    </div>
  );
}
