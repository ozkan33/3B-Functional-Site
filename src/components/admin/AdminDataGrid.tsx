import React, { useState, useEffect, useRef } from 'react';
import { DataGrid, type Column, type RowsChangeData, type SortColumn, type RenderEditCellProps } from 'react-data-grid';
import { FaLock, FaLockOpen, FaSort, FaSortUp, FaSortDown, FaRegListAlt, FaPlus, FaTrash, FaEdit, FaRegCommentDots, FaInfoCircle, FaChevronDown, FaChevronRight, FaPlusSquare, FaColumns, FaRegStickyNote } from 'react-icons/fa';
import 'react-data-grid/lib/styles.css';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import ReactDOM from 'react-dom';
import Select, { components, StylesConfig, OptionProps, SingleValueProps, SingleValue, MultiValue } from 'react-select';

interface Row {
  id: number | string;
  name?: string;
  email?: string;
  role?: string;
  storeName?: string;
  notes?: string;
  address?: string;
  isAddRow?: boolean;
  isSubRow?: boolean;
  parentId?: number | string;
  [key: string]: any;
}

type MyColumn = Column<Row> & { locked?: boolean, isDefault?: boolean };

interface ScoreCard {
  id: string;
  name: string;
  columns: MyColumn[];
  rows: Row[];
  createdAt: Date;
}

interface AdminDataGridProps {
  userRole: string;
}

export default function AdminDataGrid({ userRole }: AdminDataGridProps) {
  const router = useRouter();

  // Remove/hide Retailers from dataCategories
  const dataCategories: string[] = [];

  // Remove/hide Retailers from dataSets
  const dataSets: Record<string, { section: string; columns: MyColumn[]; rows: Row[] }> = {};

  // All logic for columns, rows, advanced commenting, and drawer should now be used only for ScoreCards
  // When creating a new ScoreCard, use the previous retailersColumns as the template for columns
  // All grid, row/column management, and advanced commenting drawer logic should be available only for ScoreCards

  // ContactCardModalButton and handleContactCardSave will be defined after all state and helpers

  // Now define the Retailers columns so the above are in scope
  const defaultColumnKeys = ['name', 'retail_price', 'buyer', 'store_count', 'hq_location', 'cmg', 'brand_lead'];
  const retailersColumns: MyColumn[] = [
    { key: 'name', name: 'Retailer Name', editable: true, sortable: true, isDefault: true },
    // Product columns will be added dynamically after this (do NOT set isDefault)
    { key: 'retail_price', name: 'Retail Price', editable: true, sortable: true, isDefault: true, renderEditCell: ({ row, column, onRowChange }) => (
      <input
        type="number"
        step="0.01"
        min="0"
        defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
        onChange={e => {
          const value = e.target.value;
          // Allow decimal values for retail price
          if (/^\d*\.?\d*$/.test(value)) {
            onRowChange({ ...row, [column.key]: value === '' ? '' : parseFloat(value) });
          }
        }}
        className="w-full h-full px-2 py-1"
        autoFocus
        placeholder="Enter retail price"
      />
    ) },
    { key: 'buyer', name: 'Buyer', editable: true, sortable: true, isDefault: true, renderEditCell: ({ row, column, onRowChange }) => (
      <input
        type="text"
        defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
        onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
        className="w-full h-full px-2 py-1"
        autoFocus
        placeholder="Enter buyer name"
      />
    ) },
    { key: 'store_count', name: 'Store Count', editable: true, sortable: true, isDefault: true, renderEditCell: ({ row, column, onRowChange }) => (
      <input
        type="number"
        step="1"
        min="0"
        defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
        onChange={e => {
          const value = e.target.value;
          if (/^\d*$/.test(value)) {
            onRowChange({ ...row, [column.key]: value === '' ? '' : parseInt(value, 10) });
          }
        }}
        className="w-full h-full px-2 py-1"
        autoFocus
        placeholder="Enter store count (integer)"
      />
    ) },
    { key: 'hq_location', name: 'HQ Location', editable: true, sortable: true, isDefault: true, renderEditCell: ({ row, column, onRowChange }) => (
      <div className="flex items-center gap-2 w-full">
        <span style={{ color: '#2563eb', fontSize: 18 }}>&#128205;</span>
        <input
          type="text"
          value={row[column.key] || ''}
          onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
          className="w-full h-full px-2 py-1"
          autoFocus
          placeholder="Enter address..."
        />
      </div>
    ) },
    { key: 'cmg', name: 'CMG', editable: false, sortable: false, isDefault: true, renderCell: ({ row }: { row: Row }) => (
      <button type="button" className="text-blue-600 underline" onClick={() => handleOpenContactModal(typeof row.id === 'number' ? row.id : 0, 'cmg', row.cmg)}>
        {row.cmg && typeof row.cmg === 'object' ? row.cmg.name : row.cmg || 'Add CMG'}
      </button>
    ) },
    { key: 'brand_lead', name: 'Brand Lead', editable: false, sortable: false, isDefault: true, renderCell: ({ row }: { row: Row }) => (
      <button type="button" className="text-blue-600 underline" onClick={() => handleOpenContactModal(typeof row.id === 'number' ? row.id : 0, 'brand_lead', row.brand_lead)}>
        {row.brand_lead && typeof row.brand_lead === 'object' ? row.brand_lead.name : row.brand_lead || 'Add Brand Lead'}
      </button>
    ) },
  ];

  // Add RouteToMarket and Priority columns after Buyer
  const routeToMarketColumn: MyColumn = {
    key: 'route_to_market',
    name: 'RouteToMarket',
    editable: true,
    sortable: true,
    renderEditCell: ({ row, column, onRowChange }) => (
      <input
        type="text"
        defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
        onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
        className="w-full h-full px-2 py-1"
        autoFocus
        placeholder="Enter route to market"
      />
    )
  };

  // Log the react-data-grid version for debugging
  // @ts-ignore
  console.log('react-data-grid version:', DataGrid.version);

  // ScoreCard state
  const [scorecards, setScorecards] = useState<ScoreCard[]>(() => loadScoreCardsFromStorage());
  const [showCreateScoreCardModal, setShowCreateScoreCardModal] = useState(false);
  const [newScoreCardName, setNewScoreCardName] = useState('');
  const [editingScoreCard, setEditingScoreCard] = useState<ScoreCard | null>(null);

  // Store both columns and rows per category
  const [categoryData, setCategoryData] = useState(() => {
    const initial: Record<string, { columns: MyColumn[]; rows: Row[] }> = {};
    for (const cat of dataCategories) {
      let rows = [...dataSets[cat].rows];
      if (cat === 'Retailers') {
        const stored = loadRetailersFromStorage();
        if (stored) rows = stored;
      }
      initial[cat] = {
        columns: dataSets[cat].columns.map(col => ({
          ...col,
          renderEditCell: col.renderEditCell || (col.editable ? ({ row, column, onRowChange }: RenderEditCellProps<Row>) => (
            <input
              defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
              onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
              className="w-full h-full px-2 py-1"
              autoFocus
            />
          ) : undefined)
        })),
        rows
      };
    }
    console.log('Initial categoryData:', initial);
    return initial;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>(dataCategories[0]);
  const [editColumns, setEditColumns] = useState(false);
  const [rowEditEnabled, setRowEditEnabled] = useState(true);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [showAddColModal, setShowAddColModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [colError, setColError] = useState('');

  // Comment modal state (now for ScoreCards only)
  const [openCommentRowId, setOpenCommentRowId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [user, setUser] = useState<any>(null);
  // Comments are now keyed by scorecardId and rowId
  const [comments, setComments] = useState<Record<string, Record<number, {text: string, timestamp: string, username: string}[]>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('scorecardComments') || '{}');
    } catch {
      return {};
    }
  });

  // Add state and modal for the advanced retailer drawer if not present
  const [openRetailerDrawer, setOpenRetailerDrawer] = useState<number | null>(null);

  // Added for comment editing
  const [editCommentIdx, setEditCommentIdx] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Add state for contact card modal
  const [openContactModal, setOpenContactModal] = useState<{ rowId: number; key: string; value: string } | null>(null);

  // Add a ref for DataGrid
  const gridRef = useRef<any>(null);

  // Add state for the open status picker
  const [statusPicker, setStatusPicker] = useState<{ rowIdx: number; colIdx: number; top: number; left: number; width: number; value: string; columnKey: string } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Add this to the main component state
  const [contactModalData, setContactModalData] = useState<{ name: string; telephone: string; address: string; notes: string }>({ name: '', telephone: '', address: '', notes: '' });

  // Add state to track expanded rows
  const [expandedRows, setExpandedRows] = useState<Record<number|string, boolean>>({});

  // Replace subGrids state with expanded/recursive structure
  const [subGrids, setSubGrids] = useState<{ [parentId: string]: { columns: MyColumn[]; rows: Row[]; expanded: boolean } }>({});

  // Helper to initialize a subgrid if it doesn't exist
  function ensureSubGrid(parentId: string | number | undefined) {
    if (parentId === undefined) return;
    if (!subGrids[parentId]) {
      setSubGrids(prev => ({
        ...prev,
        [parentId]: {
          columns: [
            { key: 'task', name: 'Task', editable: true, sortable: true }
          ],
          rows: [],
          expanded: true
        }
      }));
    }
  }

  function handleToggleSubGrid(parentId: string | number | undefined) {
    if (parentId === undefined) return;
    setSubGrids(prev => ({
      ...prev,
      [parentId]: prev[parentId] ? { ...prev[parentId], expanded: !prev[parentId].expanded } : prev[parentId]
    }));
  }

  function handleDeleteSubGrid(parentId: string | number | undefined) {
    if (parentId === undefined) return;
    setSubGrids(prev => {
      const newGrids = { ...prev };
      delete newGrids[parentId];
      return newGrids;
    });
  }

  function handleAddSubGrid(parentId: string | number) {
    setSubGrids(prev => ({
      ...prev,
      [parentId]: {
        expanded: true,
        columns: [{ key: 'note', name: 'Note', editable: true, sortable: true }],
        rows: []
      }
    }));
  }

  // Subgrid column/row handlers (same as before, but now recursive)
  function handleSubGridAddColumn(parentId: string | number | undefined) {
    if (parentId === undefined) return;
    const colKey = `col_${Date.now()}`;
    setSubGrids(prev => {
      const grid = prev[parentId] || { columns: [], rows: [], expanded: true };
      return {
        ...prev,
        [parentId]: {
          ...grid,
          columns: [
            ...grid.columns,
            { key: colKey, name: 'New Column', editable: true, sortable: true }
          ],
          rows: grid.rows.map((row: Row) => ({ ...row, [colKey]: '' }))
        }
      };
    });
  }
  function handleSubGridAddRow(parentId: string | number | undefined) {
    if (parentId === undefined) return;
    setSubGrids(prev => {
      const grid = prev[parentId] || { columns: [], rows: [], expanded: true };
      const newId = grid.rows.length > 0 ? Math.max(...grid.rows.map((r: Row) => typeof r.id === 'number' ? r.id : 0)) + 1 : 1;
      const newRow: Row = { id: newId };
      grid.columns.forEach((col: MyColumn) => { newRow[col.key] = ''; });
      return {
        ...prev,
        [parentId]: {
          ...grid,
          rows: [...grid.rows, newRow]
        }
      };
    });
  }
  function handleSubGridRowsChange(parentId: string | number | undefined, newRows: Row[]) {
    if (parentId === undefined) return;
    setSubGrids(prev => ({
      ...prev,
      [parentId]: {
        ...prev[parentId],
        rows: newRows.filter((r: Row) => !r.isAddRow)
      }
    }));
  }
  function handleSubGridColumnNameChange(parentId: string | number | undefined, idx: number, newName: string) {
    if (parentId === undefined) return;
    setSubGrids(prev => {
      const grid = prev[parentId];
      if (!grid) return prev;
      const updatedColumns = grid.columns.map((col: MyColumn, i: number) => i === idx ? { ...col, name: newName } : col);
      return {
        ...prev,
        [parentId]: {
          ...grid,
          columns: updatedColumns
        }
      };
    });
  }
  function handleSubGridDeleteRow(parentId: string | number | undefined, rowId: number | string | undefined) {
    if (parentId === undefined || rowId === undefined) return;
    setSubGrids(prev => {
      const grid = prev[parentId];
      if (!grid) return prev;
      return {
        ...prev,
        [parentId]: {
          ...grid,
          rows: grid.rows.filter((row: Row) => row.id !== rowId)
        }
      };
    });
  }
  function handleSubGridDeleteColumn(parentId: string | number | undefined, colKey: string) {
    if (parentId === undefined) return;
    setSubGrids(prev => {
      const grid = prev[parentId];
      if (!grid) return prev;
      return {
        ...prev,
        [parentId]: {
          ...grid,
          columns: grid.columns.filter((col: MyColumn) => col.key !== colKey),
          rows: grid.rows.map((row: Row) => {
            const newRow = { ...row };
            delete newRow[colKey];
            return newRow;
          })
        }
      };
    });
  }

  function loadScorecardComments() {
    try {
      return JSON.parse(localStorage.getItem('scorecardComments') || '{}');
    } catch {
      return {};
    }
  }
  function saveScorecardComments(newComments: Record<string, Record<number, {text: string, timestamp: string, username: string}[]>>) {
    localStorage.setItem('scorecardComments', JSON.stringify(newComments));
  }

  function handleOpenCommentModal(rowId: number) {
    setOpenCommentRowId(rowId);
    setCommentInput('');
  }
  function handleCloseCommentModal() {
    setOpenCommentRowId(null);
    setCommentInput('');
  }
  function handleAddComment() {
    if (!commentInput.trim() || openCommentRowId == null || !selectedCategory.startsWith('scorecard_')) return;
    const newComment = {
      text: commentInput.trim(),
      timestamp: new Date().toLocaleString(),
      username: user?.name || user?.username || 'Anonymous',
    };
    setComments(prev => {
      const updated = {
        ...prev,
        [selectedCategory]: {
          ...(prev[selectedCategory] || {}),
          ...(typeof openCommentRowId === 'number' ? { [openCommentRowId]: [...((prev[selectedCategory] || {})[openCommentRowId] || []), newComment] } : {}),
        }
      };
      saveScorecardComments(updated);
      return updated;
    });
    setCommentInput('');
  }

  // Save scorecards to localStorage whenever they change
  useEffect(() => {
    saveScoreCardsToStorage(scorecards);
  }, [scorecards]);

  // ScoreCard functions
  function createScoreCard() {
    if (!newScoreCardName.trim()) return;
    // Use the current Retailers columns as the initial columns for the new ScoreCard
    const retailersCols = categoryData['Retailers']?.columns || retailersColumns;
    const newScoreCard: ScoreCard = {
      id: `scorecard_${Date.now()}`,
      name: newScoreCardName.trim(),
      columns: retailersCols.map(col => ({ ...col })),
      rows: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
      createdAt: new Date()
    };
    setScorecards(prev => [...prev, newScoreCard]);
    setNewScoreCardName('');
    setShowCreateScoreCardModal(false);
  }

  function deleteScoreCard(scorecardId: string) {
    setScorecards(prev => prev.filter(sc => sc.id !== scorecardId));
    if (selectedCategory === scorecardId) {
      setSelectedCategory(dataCategories[0]);
    }
  }

  function updateScoreCard(scorecardId: string, updates: Partial<ScoreCard>) {
    setScorecards(prev => prev.map(sc =>
      sc.id === scorecardId
        ? { ...sc, ...updates, rows: updates.rows ? [...updates.rows] : sc.rows }
        : sc
    ));
  }

  // Get current data based on selected category
  function getCurrentData() {
    if (!selectedCategory) return null;
    if (selectedCategory.startsWith('scorecard_')) {
      const scorecard = scorecards.find(sc => sc.id === selectedCategory);
      return scorecard ? { columns: scorecard.columns, rows: scorecard.rows } : null;
    }
    return null;
  }

  // Update current data
  function updateCurrentData(updates: { columns?: MyColumn[]; rows?: Row[] }) {
    if (updates.columns) {
      updates.columns = updates.columns.map(col =>
        col.key === 'comments' ? { ...col, name: '', renderHeaderCell: () => null } : col
      );
    }
    if (selectedCategory.startsWith('scorecard_')) {
      updateScoreCard(selectedCategory, updates);
    } else {
      setCategoryData(prev => ({
        ...prev,
        [selectedCategory]: {
          ...prev[selectedCategory],
          ...updates
        }
      }));
    }
  }

  // Get all available categories including scorecards
  function getAllCategories() {
    const scorecardCategories = scorecards.map(sc => ({
      id: sc.id,
      name: sc.name,
      type: 'scorecard' as const
    }));
    
    const regularCategories = dataCategories.map(cat => ({
      id: cat,
      name: cat,
      type: 'regular' as const
    }));
    
    return [...regularCategories, ...scorecardCategories];
  }

  useEffect(() => {
    console.log('categoryData:', categoryData);
    console.log('selectedCategory:', selectedCategory);
    console.log('columns:', getCurrentData()?.columns);
    console.log('rows:', getCurrentData()?.rows);
    console.log('First row:', getCurrentData()?.rows?.[0]);
    console.log('Column keys:', getCurrentData()?.columns?.map(col => col.key));
  }, [categoryData, selectedCategory, scorecards]);

  useEffect(() => {
    const currentData = getCurrentData();
    if (!currentData) return;
    
    const updatedColumns = currentData.columns.map(col => {
      const editable = userRole === 'ADMIN' && col.key !== 'id' && col.key !== 'delete';
      console.log(`Column ${col.key} editable state:`, {
        userRole,
        isId: col.key === 'id',
        isDelete: col.key === 'delete',
        finalEditable: editable
      });
      return {
        ...col,
        editable,
        renderEditCell: col.renderEditCell || (editable ? ({ row, column, onRowChange }: RenderEditCellProps<Row>) => {
          return (
            <input
              defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
              onChange={e => {
                onRowChange({ ...row, [column.key]: e.target.value });
              }}
              className="w-full h-full px-2 py-1"
              autoFocus
            />
          );
        } : undefined)
      };
    });
    console.log('Updated columns after useEffect:', updatedColumns);
    updateCurrentData({ columns: updatedColumns });
  }, [userRole, selectedCategory]);

  // Handle category switch
  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setSortColumns([]);
    console.log('Switching to', category, 'categoryData:', categoryData);
  }

  function onRowsChange(newRows: Row[]) {
    updateCurrentData({ rows: [...newRows] });
    
    // Save to appropriate storage
    if (selectedCategory === 'Retailers') {
      saveRetailersToStorage(newRows);
    }
  }

  // Handle column name change for both Retailers and ScoreCards
  function handleColumnNameChange(idx: number, newName: string) {
    const currentData = getCurrentData();
    if (!currentData) return;
    const updatedColumns = currentData.columns.map((col, i) =>
      i === idx ? { ...col, name: newName } : col
    );
    updateCurrentData({ columns: updatedColumns });
  }

  function handleAddRow() {
    const currentData = getCurrentData();
    if (!currentData) return;
    
    const newId = currentData.rows.length > 0 ? Math.max(...currentData.rows.map(r => typeof r.id === 'number' ? r.id : 0)) + 1 : 1;
    const newRow: Row = { id: newId, name: '' };
    currentData.columns.forEach(col => {
      if (col.key !== 'id' && col.key !== 'delete' && !(col.key in newRow)) newRow[col.key] = '';
    });
    
    const updatedRows = [...currentData.rows, newRow];
    updateCurrentData({ rows: updatedRows });
    
    // Save to appropriate storage
    if (selectedCategory === 'Retailers') {
      saveRetailersToStorage(updatedRows);
    }
  }

  function handleDeleteRow(rowId: number) {
    const currentData = getCurrentData();
    if (!currentData) return;
    
    const updatedRows = currentData.rows.filter(row => row.id !== rowId);
    updateCurrentData({ rows: updatedRows });
    
    // Save to appropriate storage
    if (selectedCategory === 'Retailers') {
      saveRetailersToStorage(updatedRows);
    }
  }

  function openAddColModal() {
    setNewColName('');
    setShowAddColModal(true);
  }

  function handleAddColumnConfirm() {
    if (!newColName.trim()) {
      setColError('Column name is required.');
      return;
    }
    // Auto-generate key from name
    const key = newColName.trim().toLowerCase().replace(/\s+/g, '_');
    const currentData = getCurrentData();
    if (!currentData) return;
    if (currentData.columns.some(col => col.key === key)) {
      setColError('Column name must be unique.');
      return;
    }
    const newColumn = {
      key,
      name: newColName, // Ensure name is always set
      editable: userRole === 'ADMIN',
      sortable: true,
      renderHeaderCell: undefined // Let columnsWithDelete logic handle header rendering
    };
    // Find the index of "Retail Price" column to insert before it
    const retailPriceIndex = currentData.columns.findIndex(col => col.key === 'retail_price');
    const insertIndex = retailPriceIndex !== -1 ? retailPriceIndex : currentData.columns.length;
    // Insert the new column at the specified position
    let updatedColumns = [
      ...currentData.columns.slice(0, insertIndex),
      newColumn,
      ...currentData.columns.slice(insertIndex)
    ];
    // Ensure comments column always has blank name and header
    updatedColumns = updatedColumns.map(col =>
      col.key === 'comments' ? { ...col, name: '', renderHeaderCell: () => null } : col
    );
    const updatedRows = currentData.rows.map(row => ({ ...row, [key]: '' }));
    updateCurrentData({ columns: updatedColumns, rows: updatedRows });
    setShowAddColModal(false);
    setNewColName('');
    setColError('');
  }

  // Sorting icon logic
  function getSortIcon(columnKey: string) {
    const sort = sortColumns.find(sc => sc.columnKey === columnKey);
    if (!sort) return <FaSort style={{ marginLeft: 4, color: '#888' }} />;
    if (sort.direction === 'ASC') return <FaSortUp style={{ marginLeft: 4, color: '#2563eb' }} />;
    if (sort.direction === 'DESC') return <FaSortDown style={{ marginLeft: 4, color: '#2563eb' }} />;
    return <FaSort style={{ marginLeft: 4, color: '#888' }} />;
  }

  function handleSortClick(columnKey: string) {
    setSortColumns(prev => {
      const existing = prev.find(sc => sc.columnKey === columnKey);
      if (!existing) return [{ columnKey, direction: 'ASC' }];
      if (existing.direction === 'ASC') return [{ columnKey, direction: 'DESC' }];
      return [];
    });
  }

  // --- Product Status Dropdown: always clickable, accessible, improved colors ---
  const productStatusOptions = [
    { value: 'Authorized', label: 'Authorized', bg: '#e6f4ea', color: '#14532d' }, // soft green
    { value: 'In Process', label: 'In Process', bg: '#e0e7ff', color: '#1e3a8a' }, // soft blue
    { value: 'In/Out', label: 'In/Out', bg: '#fef9c3', color: '#92400e' }, // soft yellow
    { value: 'Buyer Passed', label: 'Buyer Passed', bg: '#fee2e2', color: '#991b1b' }, // soft red
    { value: 'Presented', label: 'Presented', bg: '#ede9fe', color: '#6d28d9' }, // soft purple
    { value: 'Discontinued', label: 'Discontinued', bg: '#f3f4f6', color: '#374151' }, // soft gray
    { value: 'Meeting Secured', label: 'Meeting Secured', bg: '#fff7ed', color: '#b45309' }, // soft orange
    { value: 'On Hold', label: 'On Hold', bg: '#fdf2f8', color: '#be185d' }, // soft pink
    { value: 'Category Review', label: 'Category Review', bg: '#f0fdfa', color: '#0f766e' }, // soft teal
    { value: 'Open Review', label: 'Open Review', bg: '#e0f2fe', color: '#0369a1' }, // soft sky
  ];

  // Add icon mapping for statuses
  const statusIcons: Record<string, React.ReactNode> = {
    'Authorized': <span style={{fontWeight:700}}>&#10003;</span>, // checkmark
    'In Process': <span style={{fontWeight:700}}>&#9203;</span>, // clock
    'In/Out': <span style={{fontWeight:700}}>&#8596;</span>, // arrows
    'Buyer Passed': <span style={{fontWeight:700}}>&#10060;</span>, // cross
    'Presented': <span style={{fontWeight:700}}>&#128196;</span>, // document
    'Discontinued': <span style={{fontWeight:700}}>&#9940;</span>, // stop
    'Meeting Secured': <span style={{fontWeight:700}}>&#128197;</span>, // calendar
    'On Hold': <span style={{fontWeight:700, color:'#2563eb'}}>&#9208;</span>, // blue pause
    'Category Review': <span style={{fontWeight:700}}>&#128196;</span>, // document
    'Open Review': <span style={{fontWeight:700}}>&#128065;</span>, // eye
  };

  // Render colored label for product status
  function ProductStatusLabel({ value }: { value: string }) {
    const selected = productStatusOptions.find(opt => opt.value === value);
    return (
      <div
        className="min-w-[140px] h-10 w-full flex items-center justify-center rounded font-medium text-base box-border border-none p-0 m-0"
        style={{ background: selected ? selected.bg : '#f3f4f6', color: selected ? selected.color : '#6b7280', gap: 8 }}
      >
        {/* Status icon */}
        {selected && <span style={{fontSize:18, width:22, display:'flex', justifyContent:'center'}}>{statusIcons[selected.value] || ''}</span>}
        {/* Colored dot */}
        {selected && <span style={{ width: 10, height: 10, borderRadius: '50%', background: selected.bg, border: `2px solid ${selected.color}`, display: 'inline-block' }}></span>}
        {/* Label */}
        <span style={{ color: selected?.color }}>{selected ? selected.label : <span className="text-gray-400">Select status</span>}</span>
      </div>
    );
  }

  // Helper to get custom styles for each option
  function getOptionStyle(option: { value: string }) {
    const found = productStatusOptions.find(opt => opt.value === option.value);
    return found
      ? { backgroundColor: found.bg, color: found.color, fontWeight: 500 }
      : {};
  }

  // Custom Option with icon, colored dot, and highlight
  const ModernOption = (props: any) => {
    const { data, isSelected, isFocused, innerProps } = props;
    const found = productStatusOptions.find(opt => opt.value === data.value);
    return (
      <components.Option {...props} innerProps={innerProps}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          background: isSelected ? (found?.bg || '#f3f4f6') : isFocused ? '#f3f4f6' : 'transparent',
          fontWeight: isSelected ? 700 : 400,
          color: found?.color,
          boxShadow: isSelected ? '0 2px 8px #0001' : undefined,
          transition: 'background 0.15s',
        }}>
          {/* Status icon */}
          <span style={{fontSize:18, width:22, display:'flex', justifyContent:'center'}}>{statusIcons[data.value] || ''}</span>
          {/* Colored dot */}
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: found?.bg, border: `2px solid ${found?.color}`, display: 'inline-block' }}></span>
          {/* Label */}
          <span style={{ color: found?.color, fontWeight: isSelected ? 700 : 500 }}>{data.label}</span>
          {/* Checkmark if selected */}
          {isSelected && <span style={{ marginLeft: 'auto', color: found?.color, fontSize: 20 }}>&#10003;</span>}
        </div>
      </components.Option>
    );
  };

  // Custom SingleValue with icon and colored dot
  const ModernSingleValue = (props: any) => {
    const { data } = props;
    const found = productStatusOptions.find(opt => opt.value === data.value);
    return (
      <components.SingleValue {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <span style={{fontSize:16, width:18, display:'flex', justifyContent:'center'}}>{statusIcons[data.value] || ''}</span>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: found?.bg, border: `2px solid ${found?.color}`, display: 'inline-block' }}></span>
          <span style={{ color: found?.color }}>{data.label}</span>
        </div>
      </components.SingleValue>
    );
  };

  // Hide the search box
  const NoInput = () => null;

  function ProductStatusDropdownEditCell({ row, column, onRowChange }: RenderEditCellProps<Row>) {
    const value = row[column.key] || '';
    const options = productStatusOptions.map(opt => ({ value: opt.value, label: opt.label }));
    return (
      <Select
        autoFocus
        tabIndex={0}
        menuIsOpen={true}
        openMenuOnFocus={true}
        menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
        styles={{
          menuPortal: base => ({ ...base, zIndex: 99999 }),
          menu: base => ({ ...base, zIndex: 99999, minWidth: 180, fontSize: 14, padding: 0 }),
          option: base => ({ ...base, padding: '2px 8px' }),
          control: base => ({ ...base, minHeight: 32, height: 32, fontSize: 14 }),
          valueContainer: base => ({ ...base, padding: '0 8px' }),
          indicatorsContainer: base => ({ ...base, height: 32 }),
          dropdownIndicator: base => ({ ...base, padding: 4 }),
          input: base => ({ ...base, margin: 0, padding: 0 }),
        }}
        value={options.find(opt => opt.value === value) || null}
        onChange={newValue => {
          onRowChange({ ...row, [column.key]: newValue ? newValue.value : '' });
        }}
        options={options}
        components={{ Option: ModernOption, SingleValue: ModernSingleValue, Input: NoInput }}
        isSearchable={false}
      />
    );
  }

  // Build editableColumns for both Retailers and ScoreCards
  const currentData = getCurrentData();
  // Find the index of 'Retailer Name' and 'Retail Price' columns (declare once for reuse)
  const retailerNameIdx = currentData?.columns.findIndex(col => col.key === 'name') ?? -1;
  const retailPriceIdx = currentData?.columns.findIndex(col => col.key === 'retail_price') ?? -1;

  const editableColumns = currentData?.columns.map((col, idx) => {
    let renderHeaderCell;
    if (editColumns) {
      renderHeaderCell = () => (
        <input
          value={col.name as string}
          onChange={e => handleColumnNameChange(idx, e.target.value)}
          className="border px-1 py-0.5 rounded text-xs w-24"
        />
      );
    } else if (col.locked) {
      renderHeaderCell = () => (
        <span className="flex items-center gap-1 font-semibold" title={userRole === 'ADMIN' ? 'Unlocked for Admin' : 'Restricted Permission'}>
          {col.name} {userRole === 'ADMIN' ? <FaLockOpen style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.25rem' }} /> : <FaLock style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.25rem' }} />}
        </span>
      );
    }
    // --- COMMENTS COLUMN: always blank name and header ---
    if (col.key === 'comments') {
      return {
        ...col,
        name: '',
        renderHeaderCell: () => null,
        editable: false,
        renderCell: col.renderCell,
      };
    }
    const isEditable = userRole === 'ADMIN' && col.key !== 'id' && col.key !== 'delete';
    const isProductColumn =
      retailerNameIdx !== -1 && retailPriceIdx !== -1 &&
      idx > retailerNameIdx && idx < retailPriceIdx;
    let renderCell = col.renderCell;
    let cellClass = col.cellClass;
    
    // --- RETAIL PRICE FORMATTING ---
    if (col.key === 'retail_price') {
      renderCell = ({ row }: { row: Row }) => (
        row.retail_price && !isNaN(Number(row.retail_price)) && row.retail_price !== ''
          ? <span>{`$${parseFloat(row.retail_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
          : <span className="text-gray-400"></span>
      );
      return {
        ...col,
        name: typeof col.name === 'string' ? col.name : '',
        editable: isEditable,
        ...(renderHeaderCell ? { renderHeaderCell } : {}),
        renderCell,
        ...(cellClass ? { cellClass } : {}),
      };
    }
    // --- DEFAULT: only set renderEditCell if not already defined ---
    return {
      ...col,
      name: typeof col.name === 'string' ? col.name : '',
      editable: isEditable,
      ...(renderHeaderCell ? { renderHeaderCell } : {}),
      renderCell,
      renderEditCell: col.renderEditCell || (isEditable
        ? ({ row, column, onRowChange }: RenderEditCellProps<Row>) => (
            <input
              defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
              onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
              className="w-full h-full px-2 py-1"
              autoFocus
            />
          )
        : undefined),
      ...(cellClass ? { cellClass } : {}),
    };
  }) || [];

  // Insert a new first column for comments
  const commentColumn: MyColumn = {
    key: 'comments',
    name: '',
    width: 48,
    frozen: false,
    renderHeaderCell: () => null,
    renderCell: ({ row }) => {
      if (row.isAddRow) return null;
      const commentCount = typeof row.id === 'number' ? (comments[selectedCategory]?.[row.id]?.length ?? 0) : 0;
      return (
        <button
          onClick={e => {
            e.stopPropagation();
            setOpenRetailerDrawer(typeof row.id === 'number' ? row.id : null);
          }}
          title="View/Add Comments"
          style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
        >
          <FaRegCommentDots />
          <span style={{ marginLeft: 2, fontSize: '0.85em', color: '#2563eb', fontWeight: 600 }}>
            {commentCount}
          </span>
        </button>
      );
    }
  };

  // Insert the Comments column after the Retailer Name column
  let columnsWithDelete: MyColumn[] = [...editableColumns];
  const nameIdx = columnsWithDelete.findIndex(col => col.key === 'name');
  if (nameIdx !== -1) {
    columnsWithDelete = [
      ...columnsWithDelete.slice(0, nameIdx + 1),
      commentColumn,
      ...columnsWithDelete.slice(nameIdx + 1)
    ];
  }

  // Build columnsWithDelete with details column for Retailers
  if (selectedCategory === 'Retailers') {
    columnsWithDelete = [
      ...columnsWithDelete,
      {
        key: 'delete',
        name: '',
        width: 50,
        frozen: false,
        renderHeaderCell: () => null,
        renderCell: ({ row }) => (
          <button
            onClick={() => handleDeleteRow(typeof row.id === 'number' ? row.id : 0)}
            className="text-red-500 hover:text-red-700 text-lg"
          >
            🗑️
          </button>
        ),
      }
    ];
  } else {
    columnsWithDelete = [
      ...columnsWithDelete,
      {
        key: 'delete',
        name: '',
        width: 50,
        frozen: false,
        renderHeaderCell: () => null,
        renderCell: ({ row }) => (
          <button
            onClick={() => handleDeleteRow(typeof row.id === 'number' ? row.id : 0)}
            className="text-red-500 hover:text-red-700 text-lg"
          >
            🗑️
          </button>
        ),
      }
    ];
  }

  // Debug: log columnsWithDelete to check editable property
  console.log('Final columnsWithDelete:', columnsWithDelete.map(col => ({
    key: col.key,
    name: col.name,
    editable: col.editable
  })));

  // Sorting logic
  function getSortedRows(): Row[] {
    if (sortColumns.length === 0) return getCurrentData()?.rows || [];
    const [{ columnKey, direction }] = sortColumns;
    const sortedRows = [...(getCurrentData()?.rows || [])].sort((a, b) => {
      const aValue = a[columnKey as keyof Row];
      const bValue = b[columnKey as keyof Row];
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (aValue === bValue) return 0;
      return (aValue > bValue ? 1 : -1) * (direction === 'ASC' ? 1 : -1);
    });
    return sortedRows;
  }

  function handleImportExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Read as 2D array
      const rows2D: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (rows2D.length === 0) return;

      // --- Vertical format detection ---
      // If first column has many unique, non-empty values and other columns are mostly empty
      const firstCol = rows2D.map(row => row[0]).filter(cell => cell && String(cell).trim() !== '');
      const uniqueFirstCol = new Set(firstCol);
      const nonEmptySecondCol = rows2D.map(row => row[1]).filter(cell => cell && String(cell).trim() !== '');
      const mostlyEmptyRest = rows2D.every(row => row.slice(2).every(cell => !cell || String(cell).trim() === ''));
      const isVertical = uniqueFirstCol.size > 3 && mostlyEmptyRest;

      if (isVertical) {
        // Group into blocks separated by empty first column or repeated field names
        const blocks: any[][] = [];
        let currentBlock: any[][] = [];
        let seenFields = new Set();
        for (const row of rows2D) {
          const key = row[0];
          if (!key || seenFields.has(key)) {
            if (currentBlock.length > 0) blocks.push(currentBlock);
            currentBlock = [];
            seenFields = new Set();
          }
          if (key) {
            currentBlock.push(row);
            seenFields.add(key);
          }
        }
        if (currentBlock.length > 0) blocks.push(currentBlock);
        // Each block becomes a row, keys are columns
        const allKeys = Array.from(new Set(blocks.flatMap(block => block.map(row => row[0]))));
        const importedColumns = allKeys.map((key, i) => ({
          key,
          name: (key || `__EMPTY_${i}`).charAt(0).toUpperCase() + (key || `__EMPTY_${i}`).slice(1),
          editable: true,
          renderEditCell: ({ row, column, onRowChange }: RenderEditCellProps<Row>) => (
            <input
              defaultValue={String(row[column.key])}
              onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
              className="w-full h-full px-2 py-1"
              autoFocus
            />
          )
        }));
        const formattedRows = blocks
          .map((block, idx) => {
            const obj: any = {};
            block.forEach(row => {
              obj[row[0]] = row[1] ?? '';
            });
            allKeys.forEach(key => {
              if (!(key in obj)) obj[key] = '';
            });
            obj._rowIndex = idx;
            return obj;
          })
          .filter(row => Object.values(row).some(v => v && String(v).trim() !== ''));
        updateCurrentData({ columns: importedColumns, rows: formattedRows });
        return;
      }

      // --- Horizontal (default) format ---
      // Scan first 10 rows to find the header row
      let headerRowIndex = 0;
      let maxScore = -1;
      for (let i = 0; i < Math.min(10, rows2D.length); i++) {
        const row = rows2D[i];
        // Score: number of non-empty, unique values
        const nonEmpty = row.filter(cell => cell && String(cell).trim() !== '');
        const unique = new Set(nonEmpty);
        const score = unique.size;
        if (score > maxScore) {
          maxScore = score;
          headerRowIndex = i;
        }
      }
      const headers = rows2D[headerRowIndex];
      const dataRows = rows2D.slice(headerRowIndex + 1).filter(row => row.some(cell => cell && String(cell).trim() !== ''));
      if (!headers) return;
      // Normalize header keys
      const normalizeKey = (key: string) => (key || '').trim().toLowerCase().replace(/\s+/g, '_');

      // For horizontal format:
      const normHeaders = headers.map(normalizeKey);
      const formattedRows = dataRows
        .map((row: any[], idx: number) => {
          const obj: any = {};
          normHeaders.forEach((header: string, i: number) => {
            obj[header] = row[i] ?? '';
          });
          obj._rowIndex = idx;
          return obj;
        })
        .filter(row => Object.values(row).some(v => v && String(v).trim() !== ''));
      const importedColumns = normHeaders.map((key: string, i: number) => ({
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        editable: true,
        renderEditCell: ({ row, column, onRowChange }: RenderEditCellProps<Row>) => (
          <input
            defaultValue={String(row[column.key])}
            onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
            className="w-full h-full px-2 py-1"
            autoFocus
          />
        )
      }));
      updateCurrentData({ columns: importedColumns, rows: formattedRows });
      return;
    };
    reader.readAsArrayBuffer(file);
  }

  // Sync editAddress/editNotes with retailer when modal opens or retailer changes
  useEffect(() => {
    if (openCommentRowId !== null) {
      const retailer = getCurrentData()?.rows.find(r => r.id === openCommentRowId);
      setCommentInput('');
    }
  }, [openCommentRowId]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  // ScoreCard management functions
  function loadScoreCardsFromStorage(): ScoreCard[] {
    try {
      const stored = localStorage.getItem('scorecards');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  function saveScoreCardsToStorage(scorecards: ScoreCard[]) {
    localStorage.setItem('scorecards', JSON.stringify(scorecards));
  }
  // Utility for loading/saving retailers
  function loadRetailersFromStorage() {
    return JSON.parse(localStorage.getItem('retailers') || 'null');
  }
  function saveRetailersToStorage(rows: any[]) {
    localStorage.setItem('retailers', JSON.stringify(rows));
  }

  // Helper to get cell position
  function getCellPosition(rowIdx: number, colIdx: number) {
    if (!gridContainerRef.current) return { top: 0, left: 0, width: 200 };
    const cell = gridContainerRef.current.querySelector(
      `.rdg-row[aria-rowindex='${rowIdx + 2}'] > .rdg-cell[aria-colindex='${colIdx + 1}']`
    );
    if (!cell) return { top: 0, left: 0, width: 200 };
    const rect = (cell as HTMLElement).getBoundingClientRect();
    return { top: rect.bottom, left: rect.left, width: rect.width };
  }

  // Card-style status picker component
  function StatusPickerCard({
    rowIdx, colIdx, value, onSelect, onClose, columnKey
  }: { rowIdx: number; colIdx: number; value: string; onSelect: (v: string) => void; onClose: () => void; columnKey: string }) {
    const [focusedIdx, setFocusedIdx] = useState(() => productStatusOptions.findIndex(opt => opt.value === value));
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function handleKeyDown(e: KeyboardEvent) {
        if (!cardRef.current) return;
        if (e.key === 'ArrowDown') {
          setFocusedIdx(idx => (idx + 1) % productStatusOptions.length);
          e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          setFocusedIdx(idx => (idx - 1 + productStatusOptions.length) % productStatusOptions.length);
          e.preventDefault();
        } else if (e.key === 'Enter') {
          onSelect(productStatusOptions[focusedIdx].value);
        } else if (e.key === 'Escape') {
          onClose();
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedIdx, onSelect, onClose]);

    useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          onClose();
        }
      }
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return ReactDOM.createPortal(
      <div
        ref={cardRef}
        style={{
          position: 'fixed',
          top: getCellPosition(rowIdx, colIdx).top + 4,
          left: getCellPosition(rowIdx, colIdx).left,
          minWidth: getCellPosition(rowIdx, colIdx).width,
          background: '#fff',
          zIndex: 99999,
          boxShadow: '0 4px 24px #0002',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 4,
          marginTop: 2
        }}
        tabIndex={-1}
      >
        {productStatusOptions.map((opt, idx) => {
          const isSelected = value === opt.value;
          const isFocused = idx === focusedIdx;
          return (
            <div
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              onMouseEnter={() => setFocusedIdx(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                background: isSelected ? (opt.bg || '#f3f4f6') : isFocused ? '#f3f4f6' : 'transparent',
                fontWeight: isSelected ? 700 : 400,
                color: opt.color,
                boxShadow: isSelected ? '0 2px 8px #0001' : undefined,
                marginBottom: 2,
                transition: 'background 0.15s',
              }}
            >
              {/* Status icon */}
              <span style={{fontSize:18, width:22, display:'flex', justifyContent:'center'}}>{statusIcons[opt.value] || ''}</span>
              {/* Colored dot */}
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: opt.bg, border: `2px solid ${opt.color}`, display: 'inline-block' }}></span>
              {/* Label */}
              <span style={{ color: opt.color, fontWeight: isSelected ? 700 : 500 }}>{opt.label}</span>
              {/* Checkmark if selected */}
              {isSelected && <span style={{ marginLeft: 'auto', color: opt.color, fontSize: 20 }}>&#10003;</span>}
            </div>
          );
        })}
      </div>,
      document.body
    );
  }

  // Update the openContactModal logic to initialize contactModalData
  function handleOpenContactModal(rowId: number, key: string, value: any) {
    let contact = { name: '', telephone: '', address: '', notes: '' };
    if (value && typeof value === 'object') contact = value;
    setContactModalData(contact);
    setOpenContactModal({ rowId, key, value });
  }

  // Place this before the return statement in the component
  let contactCardModal: React.ReactNode = null;
  if (openContactModal) {
    const currentData = getCurrentData();
    const rowIdx = currentData?.rows.findIndex(r => r.id === openContactModal.rowId);
    const key = openContactModal.key;
    contactCardModal = (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-96">
          <h3 className="text-lg font-bold mb-4">Edit {key === 'cmg' ? 'CMG' : 'Brand Lead'} Contact</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={contactModalData.name} onChange={e => setContactModalData(c => ({ ...c, name: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Telephone</label>
              <input type="tel" value={contactModalData.telephone} onChange={e => setContactModalData(c => ({ ...c, telephone: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Telephone" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input type="text" value={contactModalData.address} onChange={e => setContactModalData(c => ({ ...c, address: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Address" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea value={contactModalData.notes} onChange={e => setContactModalData(c => ({ ...c, notes: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Notes" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpenContactModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={() => {
                if (!currentData || rowIdx === undefined || rowIdx === -1) return;
                const updatedRows = currentData.rows.map((r, i) => i === rowIdx ? { ...r, [key]: { ...contactModalData } } : r);
                updateCurrentData({ rows: updatedRows });
                setOpenContactModal(null);
              }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Remove subrow objects from getRowsWithSubRows, just return the main rows plus add-row
  function getRowsWithSubRows() {
    const rows = getSortedRows();
    return [...rows, { isAddRow: true, id: 'add-row' }];
  }

  // Recursive subgrid renderer
  function SubGridRenderer({ parentId }: { parentId: string | number | undefined }) {
    if (parentId === undefined) return <></>;
    const grid = subGrids[parentId];
    if (!grid || !grid.expanded) return <></>;
    // Only render real rows and the add-row (remove dummy row)
    let subgridRows = [
      ...grid.rows,
      { isAddRow: true, id: 'add-row' }
    ];
    // DEBUG: Log the rows
    console.log('Subgrid rows for', parentId, subgridRows);

    const subEditableColumns = grid.columns.map((col: MyColumn, idx: number) => ({
      ...col,
      renderHeaderCell: () => (
        <div className="flex items-center gap-1">
          <input
            value={col.name as string}
            onChange={e => handleSubGridColumnNameChange(parentId, idx, e.target.value)}
            className="border px-1 py-0.5 rounded text-xs w-24"
          />
          <button
            onClick={e => { e.stopPropagation(); handleSubGridDeleteColumn(parentId, col.key); }}
            className="ml-1 text-gray-400 hover:text-red-600"
            title="Delete Column"
            style={{ fontSize: 14 }}
          >
            🗑️
          </button>
        </div>
      ),
      renderCell: (props: { row: Row }) => {
        if (props.row.isDummy) {
          return null;
        }
        if (props.row.isAddRow) {
          if (idx === 0) {
            return (
              <button
                onClick={() => handleSubGridAddRow(parentId)}
                className="w-full h-full flex items-center justify-start text-blue-600 hover:text-blue-800 font-medium pl-2"
                style={{ minHeight: 32 }}
              >
                ➕ Add Row
              </button>
            );
          } else {
            return null;
          }
        }
        return <>{props.row[col.key]}</>;
      },
      renderEditCell: ({ row, column, onRowChange }: RenderEditCellProps<Row>) => (
        <input
          defaultValue={row[column.key] !== undefined ? String(row[column.key]) : ''}
          onChange={e => onRowChange({ ...row, [column.key]: e.target.value })}
          className="w-full h-full px-2 py-1"
          autoFocus
        />
      )
    }));
    // Add delete column button
    subEditableColumns.push({
      key: 'delete',
      name: '',
      width: 50,
      frozen: false,
      renderHeaderCell: () => <></>,
      renderCell: ({ row }: { row: Row }) => (
        <button
          onClick={() => handleSubGridDeleteRow(parentId, row.id)}
          className="text-red-500 hover:text-red-700 text-lg"
        >
          🗑️
        </button>
      ),
      renderEditCell: () => <></>,
    });
    return (
      <div style={{ paddingLeft: 32, width: '100%', marginTop: 8, marginBottom: 8, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => handleSubGridAddColumn(parentId)}
            className="px-2 py-1 rounded text-xs font-medium border bg-green-600 text-white hover:bg-green-700"
          >
            ➕ Add Column
          </button>
          <button
            onClick={() => handleDeleteSubGrid(parentId)}
            className="px-2 py-1 rounded text-xs font-medium border bg-red-600 text-white hover:bg-red-700 ml-auto"
          >
            🗑️ Delete Subgrid
          </button>
        </div>
        {/* Remove minWidth and extra div around DataGrid */}
        <DataGrid
          key={parentId + '-' + grid.rows.length + '-' + grid.columns.length}
          columns={subEditableColumns}
          rows={subgridRows}
          onRowsChange={newRows => handleSubGridRowsChange(parentId, newRows)}
          className="fill-grid"
          enableVirtualization={false}
        />
      </div>
    );
  }

  // Add handleDeleteColumn for main grid
  function handleDeleteColumn(colKey: string) {
    const currentData = getCurrentData();
    if (!currentData) return;
    const updatedColumns = currentData.columns.filter(col => col.key !== colKey);
    const updatedRows = currentData.rows.map(row => {
      const newRow = { ...row };
      delete newRow[colKey];
      return newRow;
    });
    updateCurrentData({ columns: updatedColumns, rows: updatedRows });
  }

  // In main grid columnsWithDelete, add delete button for product columns only (between Retailer Name and Retail Price)
  columnsWithDelete = columnsWithDelete
    .filter(col => col.key !== 'delete')
    .map((col, idx) => {
      if (col.key === 'comments') {
        return {
          ...col,
          name: '',
          renderHeaderCell: () => null
        };
      }
      const isBetween =
        retailerNameIdx !== -1 && retailPriceIdx !== -1 &&
        idx > retailerNameIdx && idx < retailPriceIdx;
      if (
        isBetween &&
        col.key !== 'name' &&
        col.key !== 'retail_price'
      ) {
        return {
          ...col,
          renderHeaderCell: () => (
            <div className="flex items-center gap-1">
              <span>{col.name || col.key}</span>
              <button
                style={{ marginLeft: 6, fontSize: 14 }}
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteColumn(col.key);
                }}
                className="text-gray-400 hover:text-red-600"
                title={`Delete column ${col.name || col.key}`}
              >
                🗑️
              </button>
            </div>
          )
        };
      }
      return {
        ...col,
        renderHeaderCell: col.renderHeaderCell || (() => <span>{col.name || col.key}</span>)
      };
    });

  return (
    <>
      <style jsx global>{`
        .rdg-cell:focus, .rdg-cell.rdg-cell-selected {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        .dropdown-menu {
          pointer-events: auto !important;
        }
        .rdg, .rdg * {
          pointer-events: auto !important;
        }
        /* Force React Select dropdown menu to be visible and on top */
        .Select__menu, .react-select__menu, .Select-menu, .Select-menu-outer {
          z-index: 99999 !important;
          display: block !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <aside className="w-56 h-full bg-white border-r border-gray-200 py-6 px-4 flex flex-col gap-2">
          <h3 className="text-lg font-bold text-black mb-4">Workspaces</h3>
          
          {/* Regular Categories */}
          {dataCategories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`text-left px-3 py-2 rounded font-medium transition-all ${selectedCategory === cat ? 'bg-gray-200 text-black' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              {cat}
            </button>
          ))}
          
          {/* ScoreCard Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-gray-800">ScoreCards</h4>
              {userRole === 'ADMIN' && (
                <button
                  onClick={() => setShowCreateScoreCardModal(true)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="Create New ScoreCard"
                >
                  <FaPlus size={14} />
                </button>
              )}
            </div>
            
            {scorecards.map(scorecard => (
              <div key={scorecard.id} className="mb-2">
                <div className="flex items-center justify-between group">
                  <button
                    onClick={() => handleCategoryChange(scorecard.id)}
                    className={`flex-1 text-left px-3 py-2 rounded font-medium transition-all ${selectedCategory === scorecard.id ? 'bg-gray-200 text-black' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    {scorecard.name}
                  </button>
                  {userRole === 'ADMIN' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingScoreCard(scorecard)}
                        className="p-1 text-gray-500 hover:text-blue-600"
                        title="Edit ScoreCard"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={() => deleteScoreCard(scorecard.id)}
                        className="p-1 text-gray-500 hover:text-red-600"
                        title="Delete ScoreCard"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {scorecards.length === 0 && (
              <p className="text-sm text-gray-500 italic px-3 py-2">
                No scorecards yet. {userRole === 'ADMIN' && 'Click the + button to create one.'}
              </p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 h-full flex flex-col p-8">
          {/* Row Edit Toggle Button and Import */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={openAddColModal}
              className="px-3 py-1 rounded text-sm font-medium border bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
              disabled={userRole !== 'ADMIN'}
            >
              ➕ Add Column
            </button>
            <span className="relative flex items-center group ml-2">
              <FaInfoCircle className="text-gray-400 group-hover:text-blue-600 cursor-pointer" />
              <div className="absolute left-1/2 top-full mt-2 ml-2 w-64 bg-black text-white text-xs rounded p-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-150" style={{whiteSpace:'normal'}}>
                To import data, columns and data types must match exactly.
              </div>
            </span>
            <label className="px-3 py-1 rounded text-sm font-medium border bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2 cursor-pointer">
              📥 Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* DataGrid */}
          {getCurrentData() && getCurrentData()?.columns && getCurrentData()?.rows ? (
            <div ref={gridContainerRef} className="min-w-[1200px] h-full flex flex-col" style={{ position: 'relative' }}>
              {getSortedRows().map(row => (
                <React.Fragment key={row.id}>
                  {/* Main Row is rendered by DataGrid itself */}
                  {/* Subgrid: render directly below the parent row if expanded */}
                  {subGrids[row.id]?.expanded && (
                    <div style={{ width: '100%' }}>
                      {/* Notion-like subgrid card rendering logic */}
                      <SubGridRenderer parentId={row.id} />
                    </div>
                  )}
                </React.Fragment>
              ))}
              <DataGrid
                ref={gridRef}
                key={JSON.stringify(getCurrentData())}
                columns={columnsWithDelete.map((col, colIdx) => {
                  if (colIdx === 0) {
                    return {
                      ...col,
                      renderCell: (props: any) => {
                        if (props.row && props.row.isAddRow) {
                          return (
                            <button
                              onClick={handleAddRow}
                              className="w-full h-full flex items-center justify-center text-blue-600 hover:text-blue-800 font-medium"
                            >
                              ➕ Add Row
                            </button>
                          );
                        }
                        // Only show expand/collapse chevrons for main grid rows, not subgrid rows
                        if (props.row && !props.row.isSubRow && subGrids[props.row.id]) {
                          // ...existing chevron logic...
                        }
                        return col.renderCell ? col.renderCell(props) : props.row[col.key];
                      },
                      editable: (row: Row) => !(row && row.isAddRow),
                      renderEditCell: (props: any) => (props.row && props.row.isAddRow ? null : col.renderEditCell ? col.renderEditCell(props) : null)
                    };
                  }
                  return {
                    ...col,
                    renderCell: (props: any) => {
                      if (props.row && props.row.isAddRow) return null;
                      return col.renderCell ? col.renderCell(props) : props.row[col.key];
                    },
                    editable: (row: Row) => !(row && row.isAddRow),
                    renderEditCell: (props: any) => (props.row && props.row.isAddRow ? null : col.renderEditCell ? col.renderEditCell(props) : null)
                  };
                })}
                rows={getRowsWithSubRows()}
                onRowsChange={newRows => {
                  // Filter out the add row before updating state
                  const filteredRows = newRows.filter(r => !(r as any).isAddRow);
                  onRowsChange(filteredRows as Row[]);
                }}
                sortColumns={sortColumns}
                onSortColumnsChange={setSortColumns}
                className="fill-grid"
                enableVirtualization={false}
                onCellClick={(args) => {
                  const { rowIdx, column, row } = args;
                  // Only for product status columns, not Add Row
                  const isProductColumn = (() => {
                    const retailerNameIdx = columnsWithDelete.findIndex(col => col.key === 'name');
                    const retailPriceIdx = columnsWithDelete.findIndex(col => col.key === 'retail_price');
                    const colIdx = columnsWithDelete.findIndex(c => c.key === column.key);
                    return (
                      typeof retailerNameIdx === 'number' && typeof retailPriceIdx === 'number' &&
                      colIdx > retailerNameIdx && colIdx < retailPriceIdx
                    );
                  })();
                  if (row.isAddRow) return;
                  if (isProductColumn) {
                    const colIdx = columnsWithDelete.findIndex(c => c.key === column.key);
                    setStatusPicker({
                      rowIdx,
                      colIdx,
                      ...getCellPosition(rowIdx, colIdx),
                      value: row[column.key],
                      columnKey: column.key
                    });
                    return;
                  }
                  // ...rest of your logic...
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-lg" style={{ minHeight: '60vh' }}>
              {scorecards.length === 0 ? 'No ScoreCards yet. Please create one.' : 'Please select a ScoreCard.'}
            </div>
          )}
          {statusPicker && (
            <StatusPickerCard
              rowIdx={statusPicker.rowIdx}
              colIdx={statusPicker.colIdx}
              value={statusPicker.value}
              columnKey={statusPicker.columnKey}
              onSelect={v => {
                // Update the row value and close
                const rows = [...getSortedRows()];
                rows[statusPicker.rowIdx][statusPicker.columnKey] = v;
                onRowsChange(rows);
                setStatusPicker(null);
              }}
              onClose={() => setStatusPicker(null)}
            />
          )}

          {/* Add Column Modal */}
          {showAddColModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <h3 className="text-lg font-bold mb-4">Add New Column</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Column Name</label>
                    {/* Hidden password field to prevent browser autofill */}
                    <input type="password" style={{ display: 'none' }} autoComplete="new-password" />
                    <input
                      type="text"
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
                      placeholder="e.g., Phone Number"
                      autoComplete="new-password"
                    />
                  </div>
                  {colError && (
                    <p className="text-red-500 text-sm">{colError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowAddColModal(false); setColError(''); setNewColName(''); }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddColumnConfirm}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Add Column
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create ScoreCard Modal */}
          {showCreateScoreCardModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <h3 className="text-lg font-bold mb-4">Create New ScoreCard</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ScoreCard Name</label>
                    <input
                      type="text"
                      value={newScoreCardName}
                      onChange={e => setNewScoreCardName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., Sales Performance"
                      onKeyPress={e => e.key === 'Enter' && createScoreCard()}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateScoreCardModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createScoreCard}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Create ScoreCard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit ScoreCard Modal */}
          {editingScoreCard && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <h3 className="text-lg font-bold mb-4">Edit ScoreCard</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ScoreCard Name</label>
                    <input
                      type="text"
                      value={editingScoreCard.name}
                      onChange={e => setEditingScoreCard(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., Sales Performance"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingScoreCard(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (editingScoreCard) {
                          updateScoreCard(editingScoreCard.id, { name: editingScoreCard.name });
                          setEditingScoreCard(null);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comment Modal */}
          {openCommentRowId !== null && selectedCategory.startsWith('scorecard_') && (() => {
            const row: Partial<Row> = getCurrentData()?.rows.find(r => r.id === openCommentRowId) || {};
            return (
              <div className="fixed inset-0 z-50 flex">
                <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={handleCloseCommentModal}></div>
                <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slideInRight">
                  <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{row.name || 'Row'}</h2>
                      <span className="text-xs text-gray-500">ID: {row.id}</span>
                    </div>
                    <button onClick={handleCloseCommentModal} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">×</button>
                  </div>
                  <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Comments</h3>
                    <div className="flex-1 overflow-y-auto mb-2 space-y-3 pr-1" style={{ maxHeight: '40vh' }}>
                      {typeof row.id === 'number' && comments[selectedCategory]?.[row.id]
                        ? comments[selectedCategory][row.id].map((c, i) => (
                            <li key={i} className="flex items-start gap-3 bg-white rounded-xl shadow border p-3">
                              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                {c.username?.[0]?.toUpperCase() || 'A'}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium text-gray-800">{c.username || 'Anonymous'}</span>
                                  <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{c.timestamp}</span>
                                </div>
                                <div className="text-gray-700 text-sm whitespace-pre-line">{c.text}</div>
                              </div>
                            </li>
                          ))
                        : null}
                    </div>
                    <div className="pt-3 border-t bg-gray-50 rounded-b-xl flex gap-2 items-center">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                        className="flex-1 rounded-full border border-gray-300 focus:border-blue-500 focus:ring-blue-500 px-4 py-2 text-sm bg-white shadow-sm"
                        placeholder="Add a comment..."
                        onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                      />
                      <button
                        onClick={handleAddComment}
                        className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm font-semibold shadow"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Render the advanced drawer for ScoreCard rows */}
          {openRetailerDrawer !== null && selectedCategory && selectedCategory.startsWith('scorecard_') && (() => {
            const currentData = getCurrentData();
            const row: Partial<Row> = currentData?.rows.find(r => r.id === openRetailerDrawer) || {};
            return (
              <div className="fixed inset-0 z-50 flex">
                <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={() => setOpenRetailerDrawer(null)}></div>
                <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slideInRight rounded-l-2xl border-l border-gray-200">
                  <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50 rounded-t-2xl">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{row.name || 'Row'}</h2>
                    </div>
                    <button onClick={() => setOpenRetailerDrawer(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">×</button>
                  </div>
                  <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
                    {/* Address editing */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                      <input
                        type="text"
                        value={row.address || ''}
                        onChange={e => {
                          if (!currentData || row.id === undefined) return;
                          // Update the address for this row in the scorecard
                          const updatedRows = currentData.rows.map(r => r.id === row.id ? { ...r, address: e.target.value } : r);
                          updateCurrentData({ rows: updatedRows });
                        }}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="Enter address..."
                      />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Comments</h3>
                    <div className="flex-1 overflow-y-auto mb-2 space-y-4 pr-1" style={{ maxHeight: '40vh' }}>
                      {typeof row.id === 'number' && comments[selectedCategory]?.[row.id]
                        ? comments[selectedCategory][row.id].map((c, i) => {
                            const isAuthor = (user?.name || user?.username || 'Anonymous') === (c.username || 'Anonymous');
                            return (
                              <li key={i} className="flex items-start gap-3 bg-white rounded-xl shadow border border-gray-200 p-4">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                  {c.username?.[0]?.toUpperCase() || 'A'}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-gray-800">{c.username || 'Anonymous'}</span>
                                    <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{c.timestamp}</span>
                                  </div>
                                  {/* Edit mode for comment */}
                                  {editCommentIdx === i ? (
                                    <div className="flex gap-2 items-center mt-1">
                                      <textarea
                                        value={editCommentText}
                                        onChange={e => setEditCommentText(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                        rows={2}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => {
                                          // Save edited comment
                                          const updated = { ...comments };
                                          if (typeof row.id === 'number') {
                                            updated[selectedCategory][row.id][i].text = editCommentText;
                                          }
                                          setComments(updated);
                                          saveScorecardComments(updated);
                                          setEditCommentIdx(null);
                                          setEditCommentText('');
                                        }}
                                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-semibold"
                                      >Save</button>
                                      <button
                                        onClick={() => { setEditCommentIdx(null); setEditCommentText(''); }}
                                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs font-semibold"
                                      >Cancel</button>
                                    </div>
                                  ) : (
                                    <div className="text-gray-700 text-sm whitespace-pre-line mt-1">{c.text}</div>
                                  )}
                                  {/* Show Edit/Delete if author */}
                                  {isAuthor && editCommentIdx !== i && (
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={() => { setEditCommentIdx(i); setEditCommentText(c.text); }}
                                        className="text-xs text-blue-600 hover:underline px-1 py-0.5 rounded"
                                      >Edit</button>
                                      <button
                                        onClick={() => {
                                          // Delete comment
                                          const updated = { ...comments };
                                          if (typeof row.id === 'number') {
                                            updated[selectedCategory][row.id].splice(i, 1);
                                          }
                                          setComments(updated);
                                          saveScorecardComments(updated);
                                        }}
                                        className="text-xs text-red-500 hover:underline px-1 py-0.5 rounded"
                                      >Delete</button>
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })
                        : null}
                    </div>
                    {/* Modern comment input */}
                    <div className="pt-4 border-t bg-gray-50 rounded-b-2xl flex gap-3 items-start mt-2" style={{ borderTop: '1px solid #e5e7eb' }}>
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg mt-1">
                        {(user?.name || user?.username || 'A')[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={commentInput}
                          onChange={e => setCommentInput(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500 px-4 py-2 text-sm bg-white shadow-sm resize-none min-h-[44px] transition-all"
                          placeholder="Add a comment..."
                          rows={commentInput.length > 60 ? 4 : 2}
                          style={{ minHeight: 44, maxHeight: 120, marginBottom: 8 }}
                          onFocus={e => e.currentTarget.rows = 4}
                          onBlur={e => e.currentTarget.rows = commentInput.length > 60 ? 4 : 2}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); /* Only add if not shift+enter */ document.getElementById('add-comment-btn')?.click(); } }}
                        />
                        <button
                          id="add-comment-btn"
                          onClick={() => {
                            if (!commentInput.trim() || openRetailerDrawer == null || !selectedCategory) return;
                            const newComment = {
                              text: commentInput.trim(),
                              timestamp: new Date().toLocaleString(),
                              username: user?.name || user?.username || 'Anonymous',
                            };
                            setComments(prev => {
                              const updated = {
                                ...prev,
                                [selectedCategory]: {
                                  ...(prev[selectedCategory] || {}),
                                  ...(typeof row.id === 'number' ? { [row.id]: [...((prev[selectedCategory] || {})[row.id] || []), newComment] } : {}),
                                }
                              };
                              saveScorecardComments(updated);
                              return updated;
                            });
                            setCommentInput('');
                          }}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow transition-all float-right"
                          style={{ minWidth: 120 }}
                        >
                          Add Comment
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Contact Card Modal */}
          {contactCardModal}
        </main>
      </div>
    </>
  );
}