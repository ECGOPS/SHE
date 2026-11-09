import { HazardCategory } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { ModuleCreatePage } from '../../components/ModuleCreatePage';
import { FormField } from '../../components/ModulePage';

const HAZARD_FORM_FIELDS: FormField[] = [
  {
    name: '__std',
    type: 'info',
    label: 'What to report',
    helperText:
      'A hazard is a condition that could hurt someone. If something nearly happened, use Near miss. The safety officer rates the risk and chooses the control. ISO 45001 §6.1.2.',
  },
  {
    name: 'occurredAt',
    label: 'Occurred at',
    type: 'datetime',
    required: true,
    computeDefault: () => new Date().toISOString().slice(0, 16),
  },
  {
    name: 'regionId',
    label: 'Region',
    type: 'select',
    required: true,
    computeDefault: (s) => s?.user.regionId ?? '',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    options: Object.values(HazardCategory),
  },
  {
    name: 'peopleExposed',
    label: 'People are exposed to this now',
    type: 'boolean',
    defaultValue: false,
  },
  { name: 'title', label: 'What is wrong', type: 'text', required: true },
  { name: 'description', label: 'Describe the condition', type: 'textarea', required: true },
  {
    name: 'immediateAction',
    label: 'What did you do to make it safe?',
    type: 'textarea',
    helperText: 'Isolate, barricade, or stop the job. Leave blank if you could not make it safe.',
  },
  { name: 'locationName', label: 'Location', type: 'text' },
  { name: 'latitude', label: 'Latitude', type: 'number' },
  { name: 'longitude', label: 'Longitude', type: 'number' },
];

export function HazardNewPage() {
  return (
    <ModuleCreatePage
      title="Report a new hazard"
      subtitle="Record the condition first, then what you did to make it safe. A safety officer rates the risk and chooses the control."
      queryKey="hazards"
      create={endpoints.createHazard}
      formFields={HAZARD_FORM_FIELDS}
      ctaLabel="Submit report"
      offlineKind="hazard"
      allowPhotos
      allowLocation
      cancelPath="/hazards"
      createdPath={(created) => (created.id ? `/hazards/${created.id}` : undefined)}
      successNoun="hazard report"
    />
  );
}
