import * as React from 'react';
import {
  DataGridPremium,
  GridEditInputCell,
  useGridApiRef,
  type GridColDef,
} from '@mui/x-data-grid-premium';
import { createComboNumberColumn, useComboNumberGridHandlers, type ComboValue } from './comboNumberColumn';

type Row = { id: number; name: string; aircraft_quantity: number | null; flight_hours: ComboValue };

// Placeholder options: swap for the real list.
const FLIGHT_HOURS_OPTIONS = ['N/A', 'TBD', 'Unlimited'] as const;

const initialRows: Row[] = [
  { id: 1, name: 'Campaign A', aircraft_quantity: 3, flight_hours: 120 },
  { id: 2, name: 'Campaign B', aircraft_quantity: 1, flight_hours: 'TBD' },
  { id: 3, name: 'Campaign C', aircraft_quantity: null, flight_hours: null },
];

const columns: GridColDef<Row>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  {
    // Existing stock number column, for side-by-side comparison
    field: 'aircraft_quantity',
    headerName: 'Aircraft qty',
    width: 140,
    editable: true,
    type: 'number',
    align: 'right',
    renderEditCell: (params) => <GridEditInputCell {...params} inputProps={{ min: 0 }} />,
  },
  createComboNumberColumn<Row>(
    { field: 'flight_hours', headerName: 'Flight hours', width: 160 },
    { options: FLIGHT_HOURS_OPTIONS /* , allowDecimals: true */ },
  ),
];

export interface ComboNumberDemoProps {
  onRowCommit?: (row: Row) => void;
}

export default function ComboNumberDemo({ onRowCommit }: ComboNumberDemoProps) {
  const apiRef = useGridApiRef();
  const { onCellKeyDown } = useComboNumberGridHandlers(apiRef);
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
