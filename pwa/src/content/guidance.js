/**
 * Plain-language guidance shown with a result.
 *
 * Written as SCREENING language ("associated with"), never as a diagnosis.
 * Entries are looked up by class NAME (the text from class_names.json), never
 * by position, so a change in class order cannot attach the wrong advice to a
 * result. A class with no entry here gets the generic fallback instead of
 * crashing.
 */

export const GUIDANCE = {
  Coccidiosis: {
    signs: 'Blood-streaked or rust-coloured droppings are associated with coccidiosis.',
    steps: [
      'Separate the affected bird or birds from the rest.',
      'Keep litter dry; damp litter helps the parasite spread.',
      'Do not start medicine on your own. A veterinarian should confirm first and choose the treatment.',
      'Wash your hands and boots after handling.',
    ],
  },
  Healthy: {
    signs: 'This photo looks like a normal dropping.',
    steps: [
      'One normal photo does not clear the whole flock.',
      'Keep watching appetite, water intake, activity and droppings.',
      'Scan again, and call a veterinarian, if droppings or behaviour change.',
    ],
  },
  'Newcastle Disease': {
    signs: 'Green, watery droppings are associated with Newcastle disease.',
    steps: [
      'Contact a veterinarian or your local agriculture office promptly. This disease spreads fast and is reportable in many areas.',
      'Keep the affected birds apart, and do not move birds, crates or equipment between houses.',
      'Wash and disinfect hands, boots and tools after handling.',
    ],
  },
  Salmonella: {
    signs: 'White or yellow-white droppings are associated with salmonellosis.',
    steps: [
      'Wash hands thoroughly after touching birds, eggs or litter. Salmonella can affect people too.',
      'Keep eggs from affected birds out of the food chain until a veterinarian advises.',
      'Separate affected birds and ask a veterinarian about testing to confirm.',
    ],
  },
};

/** Used for any class name that has no entry above. */
export const GENERIC_GUIDANCE = {
  signs: 'The photo shows signs the app associates with this class.',
  steps: ['Separate any bird that looks unwell.', 'Ask a veterinarian to confirm before treating.'],
};

/** Retake tips shown whenever the app declines to call a result. */
export const RETAKE_TIPS = [
  'Retake in daylight, with no shadow falling across the dropping.',
  'Get close so one dropping fills the square. Move the phone; do not zoom.',
  'Use a fresh dropping. Dry ones lose the colour the app relies on.',
  'Keep the phone still until the checks turn green.',
];
