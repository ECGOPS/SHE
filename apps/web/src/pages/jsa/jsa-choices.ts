/** Common distribution-work choices for a job briefing. Other is typed by the crew. */

export const JSA_ACTIVITIES = [
  'Replace a pole-mounted transformer',
  'Replace a drop-out fuse',
  'String or repair a conductor',
  'Install or replace a pole',
  'Clear vegetation near the line',
  'Switch at a substation',
  'Install or replace a meter',
  'Excavate for an underground cable',
  'Work in a cable vault or manhole',
  'Weld or cut metal',
  'Climb a pole or tower',
  'Patrol a feeder',
  'Maintain a distribution board',
] as const;

export const JSA_PLACES = [
  'Substation',
  'Feeder or overhead line',
  'Pole',
  'Pole-mounted transformer',
  'Customer premises',
  'Office or depot',
  'Cable trench',
  'Switching station',
] as const;

export const JSA_STEPS = [
  'Travel to the site and set up the work area',
  'Brief the crew on the hazards and controls',
  'Isolate and lock out the circuit',
  'Prove the line dead',
  'Apply earthing',
  'Climb the pole',
  'Replace the transformer or fuse',
  'String or sag the conductor',
  'Excavate the trench',
  'Enter the vault or manhole',
  'Weld or grind',
  'Restore the circuit',
  'Clear the site',
] as const;

export const JSA_HAZARDS = [
  'Contact with live conductors',
  'Arc flash or blast',
  'Fall from height',
  'Falling tools or materials',
  'Excavation collapse',
  'Struck by a vehicle',
  'Manual handling injury',
  'Heat stress',
  'Insect or snake bite',
  'Stored electrical or mechanical energy',
  'Unsafe atmosphere in a confined space',
  'Fire from hot work',
  'Oil or fuel spill',
  'Noise',
  'Public coming into the work area',
] as const;

export const JSA_CONTROLS = [
  'Open the isolator, lock it, and prove dead before anyone touches the line',
  'Wear arc-rated clothing for the task',
  'Use a harness tied off before leaving the ground',
  'Keep people clear of the drop zone and use a tool lanyard',
  'Shore the excavation and keep spoil at least 1 m back',
  'Set cones and a flagman between the crew and traffic',
  'Use a two-person lift or a mechanical aid for heavy gear',
  'Take water breaks and stop work in extreme heat',
  'Check the ground for snakes and wear boots',
  'Release stored energy and test before work',
  'Test the atmosphere and keep a watcher outside the space',
  'Keep a fire extinguisher at the work point and clear combustibles',
  'Place a drip tray and a spill kit before opening oil-filled equipment',
  'Wear hearing protection while the tool is running',
  'Barrier the work area and keep the public out',
] as const;

export const JSA_PPE = [
  'Safety helmet',
  'Safety boots',
  'Arc-rated clothing',
  'Insulating gloves with leather protectors',
  'Safety glasses',
  'Face shield',
  'Harness and lanyard',
  'High-visibility vest',
  'Hearing protection',
  'Respirator',
  'Cut-resistant gloves',
] as const;

export const JSA_TOOLS = [
  'Voltage detector',
  'Earthing cluster',
  'Hot sticks',
  'Insulated hand tools',
  'Ladder',
  'Climbing gear',
  'Pulley and rope',
  'Excavator or jackhammer',
  'Fire extinguisher',
  'Spill kit',
  'First aid kit',
  'Cones and barrier tape',
  'Two-way radio',
] as const;

export const JSA_EMERGENCY = [
  'Call the control room and the district safety officer',
  'For a pole rescue, use the rescue kit. Do not climb an unsecured pole',
  'For electric shock, switch off, start CPR, and call an ambulance',
  'For a fall, do not move the person. Call an ambulance',
  'For fire, use the extinguisher and leave if it spreads',
  'For a confined space, the watcher raises the alarm and nobody else enters',
  'Assemble upwind of the work area, clear of the line',
] as const;
