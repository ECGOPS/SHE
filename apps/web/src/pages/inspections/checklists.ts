import { InspectionType } from '@ecg-she/shared';

/** Questions a person walks through on site. A fail is a finding. */
export const INSPECTION_CHECKLISTS: Record<InspectionType, string[]> = {
  [InspectionType.SUBSTATION]: [
    'Fence, gates, and warning signs are intact',
    'No oil leak on transformers or switchgear',
    'Earthing connections are intact',
    'Switchyard is clear of stored material',
    'Fire equipment is present and in date',
    'The yard is locked against the public',
  ],
  [InspectionType.TRANSFORMER]: [
    'No oil leak and the oil level is acceptable',
    'Bushings and surge arresters are intact',
    'Earthing is intact',
    'Vegetation is clear of the structure',
    'Warning signs are in place',
  ],
  [InspectionType.LINE]: [
    'Conductors and ties are intact',
    'Poles are sound, with no severe lean',
    'Stay wires and earthing are intact',
    'Clearance from vegetation and buildings is adequate',
    'Nothing is hanging where the public can touch it',
  ],
  [InspectionType.VEHICLE]: [
    'Lights, horn, and brakes work',
    'Tyres and wheel nuts are sound',
    'First aid kit and fire extinguisher are present and in date',
    'No oil or fuel leak',
    'The load is secured',
  ],
  [InspectionType.OFFICE]: [
    'Walkways are clear',
    'Fire exits and extinguishers are clear and in date',
    'Cords and sockets are undamaged',
    'The first aid kit is stocked',
  ],
  [InspectionType.PPE]: [
    'Helmet is undamaged and in date',
    'Insulating gloves are tested and in date',
    'Boots and arc-rated clothing are serviceable',
    'Harness, if used today, is inspected and in date',
  ],
  [InspectionType.GENERAL]: [
    'The place is safe to start work',
    'Emergency equipment is available',
    'People at the job know the hazards',
  ],
};

export const OUTDOOR_INSPECTIONS: InspectionType[] = [
  InspectionType.SUBSTATION,
  InspectionType.TRANSFORMER,
  InspectionType.LINE,
];

export const PRE_USE_INSPECTIONS: InspectionType[] = [InspectionType.VEHICLE, InspectionType.PPE];
