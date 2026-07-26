/**
 * Directory presentation copy.
 *
 * Edit this file when a team changes name or the contact structure changes.
 * The actual email addresses and roles live in data/fixtures.json.
 */
export const DIRECTORY_LAYERS = [
  {
    id: 'constituency',
    level: 'top',
    eyebrow: 'Constituency-wide',
    title: 'Global focal points',
    description:
      'The first contact for matters that concern YOUNGO as a whole.',
    groups: ['focal_points'],
  },
  {
    id: 'coordination',
    level: 'middle',
    eyebrow: 'Cross-team coordination',
    title: 'Liaisons and operations',
    description:
      'Contacts who connect YOUNGO processes, institutions, and day-to-day support.',
    groups: ['liaisons', 'operations'],
  },
  {
    id: 'working-groups',
    level: 'base',
    eyebrow: 'Thematic participation',
    title: 'Working-group contacts',
    description:
      'The people to contact about a specific policy area or working group.',
    groups: ['wg_contacts'],
  },
]
