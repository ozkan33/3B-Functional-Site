'use client';

import React, { useState } from 'react';
import { DataGrid, Column, RenderEditCellProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

interface Row {
  id: number;
  name: string;
  notes: string;
  [key: string]: string | number;
}

const columns: Column<Row>[] = [
  { key: 'id', name: 'ID' },
  { 
    key: 'name', 
    name: 'Name', 
    editable: true,
    renderEditCell: ({ row, column, onRowChange }: RenderEditCellProps<Row>) => {
      return (
        <input
          defaultValue={String(row[column.key])}
          onChange={e => {
            onRowChange({ ...row, [column.key]: e.target.value });
          }}
          className="w-full h-full px-2 py-1"
          autoFocus
        />
      );
    }
  },
  { 
    key: 'notes', 
    name: 'Notes', 
    editable: true,
    renderEditCell: ({ row, column, onRowChange }: RenderEditCellProps<Row>) => {
      return (
        <input
          defaultValue={String(row[column.key])}
          onChange={e => {
            onRowChange({ ...row, [column.key]: e.target.value });
          }}
          className="w-full h-full px-2 py-1"
          autoFocus
        />
      );
    }
  }
];

const initialRows: Row[] = [
  { id: 1, name: 'Test 1', notes: 'Note 1' },
  { id: 2, name: 'Test 2', notes: 'Note 2' }
];

export default function TestGrid() {
  const [rows, setRows] = useState<Row[]>(initialRows);

  function onRowsChange(newRows: Row[]) {
    console.log('onRowsChange called with:', newRows);
    setRows([...newRows]);
  }

  return (
    <div style={{ height: 400 }}>
      <h2>Test Grid</h2>
      <DataGrid
        columns={columns}
        rows={rows}
        onRowsChange={onRowsChange}
        className="fill-grid"
        enableVirtualization={false}
      />
      {/* Debug output */}
      <div className="mt-4 p-4 bg-gray-100">
        <h3>Current Rows:</h3>
        <pre>{JSON.stringify(rows, null, 2)}</pre>
      </div>
    </div>
  );
} 