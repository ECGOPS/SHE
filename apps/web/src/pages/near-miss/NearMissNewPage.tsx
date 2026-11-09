import {
  BODY_PART_AFFECTED,
  NATURE_OF_INJURY,
  NearMissCategory,
  SEVERITY_POTENTIAL,
} from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { ModuleCreatePage } from '../../components/ModuleCreatePage';
import { FormField } from '../../components/ModulePage';

const NEAR_MISS_FORM_FIELDS: FormField[] = [
  {
    name: '__std',
    type: 'info',
    label: 'Standards reference',
    helperText:
      'A near miss is an event that could have hurt someone and did not. If you are only reporting a condition, with no event, use Hazards. ISO 45001 §10.2 · OSHA Form 301.',
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
  { name: 'title', label: 'Short title', type: 'text', required: true },
  {
    name: 'description',
    label: 'What happened',
    type: 'textarea',
    required: true,
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    options: Object.values(NearMissCategory),
    helperText: 'Unsafe act, unsafe condition, or potential incident.',
  },
  {
    name: 'severityPotential',
    label: 'How bad could it have been?',
    type: 'select',
    required: true,
    options: [...SEVERITY_POTENTIAL],
    helperText: 'Your first judgement. The safety officer confirms it.',
  },
  { name: 'locationName', label: 'Location', type: 'text' },
  { name: 'latitude', label: 'Latitude', type: 'number' },
  { name: 'longitude', label: 'Longitude', type: 'number' },
  {
    name: 'bodyPartAtRisk',
    label: 'Body part at risk',
    type: 'select',
    options: [...BODY_PART_AFFECTED],
  },
  {
    name: 'potentialInjuryNature',
    label: 'Potential nature of injury',
    type: 'select',
    options: [...NATURE_OF_INJURY],
  },
  {
    name: 'anonymous',
    label: 'Hide my name from the shared report',
    type: 'boolean',
    defaultValue: false,
    helperText:
      'Your name stays with the safety officer so they can ask a follow-up. It is hidden from everyone else, and from the audit trail.',
  },
];

export function NearMissNewPage() {
  return (
    <ModuleCreatePage
      title="Report a new near miss"
      subtitle="Record what nearly happened. A safety officer reviews the potential, records the cause, and closes it or raises a corrective action."
      queryKey="near-miss"
      create={endpoints.createNearMiss}
      formFields={NEAR_MISS_FORM_FIELDS}
      ctaLabel="Submit report"
      offlineKind="near-miss"
      allowPhotos
      allowLocation
      cancelPath="/near-miss"
      createdPath={(created) => (created.id ? `/near-miss/${created.id}` : undefined)}
      successNoun="near miss report"
    />
  );
}
