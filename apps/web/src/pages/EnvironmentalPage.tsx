import { GridColDef } from '@mui/x-data-grid';
import { EnvironmentalEventType, Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 220 },
  { field: 'type', headerName: 'Event type', width: 160, renderCell: (p) => statusChip(p.value) },
  { field: 'title', headerName: 'Title', flex: 1, minWidth: 200 },
  { field: 'status', headerName: 'Status', width: 130, renderCell: (p) => statusChip(p.value) },
  { field: 'severity', headerName: 'Severity', width: 130, renderCell: (p) => statusChip(p.value) },
  dateCol('occurredAt', 'Occurred'),
];

export function EnvironmentalPage() {
  return (
    <ModulePage
      title="Environmental events"
      subtitle="Name the substance, contain the release, and keep it open until oily or polluted waste has left the site with a waybill and a photo."
      queryKey="environmental"
      list={endpoints.envEvents}
      create={endpoints.createEnvEvent}
      columns={cols}
      ctaLabel="Log environmental event"
      permission={Permission.ENV_CREATE}
      allowLocation
      allowPhotos
      rowHref={(row) => `/environmental/${row.id}`}
      createdPath={(row) => (row.id ? `/environmental/${row.id}` : undefined)}
      formFields={[
        { name: 'regionId', label: 'Region', type: 'select', computeDefault: (s) => s?.user.regionId ?? '' },
        { name: 'type', label: 'Event type', type: 'select', required: true, options: Object.values(EnvironmentalEventType) },
        {
          name: 'substance',
          label: 'Substance',
          type: 'select',
          options: ['TRANSFORMER_OIL', 'DIESEL', 'PETROL', 'HYDRAULIC_OIL', 'SF6', 'WASTE_OIL', 'OTHER'],
          helperText: 'Required except for noise. Choose Other and name it below when it is not in the list.',
        },
        { name: 'substanceDetail', label: 'Other substance', type: 'text' },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'description', label: 'What happened', type: 'textarea', required: true },
        {
          name: 'occurredAt',
          label: 'Occurred at',
          type: 'datetime',
          required: true,
          computeDefault: () => new Date().toISOString().slice(0, 16),
        },
        { name: 'locationName', label: 'Place', type: 'text', helperText: 'Depot, substation, or the span where it happened.' },
        { name: 'latitude', label: 'Latitude', type: 'number' },
        { name: 'longitude', label: 'Longitude', type: 'number' },
        { name: 'estimatedQuantity', label: 'Estimated quantity', type: 'number' },
        { name: 'quantityUnit', label: 'Unit', type: 'select', options: ['litres', 'kg', 'tonnes', 'dB'] },
        {
          name: 'containmentActions',
          label: 'What was done to stop it',
          type: 'textarea',
          helperText: 'Leave blank if the release is still spreading. A safety officer cannot close it until this is recorded.',
        },
      ]}
    />
  );
}
