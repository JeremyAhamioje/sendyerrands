/**
 * Nigerian states, for the marketplace filter and vendor sign-up.
 *
 * Ordered by where Sendy actually trades rather than alphabetically. A filter
 * row is scanned left to right and abandoned quickly, so the states with
 * vendors in them have to be reachable without scrolling past Abia and Adamawa.
 * The rest follow alphabetically, because past the first few any other ordering
 * is just a second thing to learn.
 */
const ACTIVE = ['Lagos', 'FCT - Abuja', 'Rivers', 'Oyo', 'Kano'];

const REST = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Plateau', 'Sokoto', 'Taraba', 'Yobe',
  'Zamfara',
];

export const NIGERIAN_STATES = [...ACTIVE, ...REST];

/** The filter row: "All" first, so the default is one tap away again. */
export const STATE_FILTERS = ['All', ...NIGERIAN_STATES];
