// The birds a player can catch and lead with: 24 species in three rarities. Pure data (the rules, the Aviary and the renderer
// all read it). Colours: back, belly, head, accent (wing tips, tail, crest), beak. Shape: beak length, crest, tail length,
// tail streamers, size.

export const RARITY = ['common', 'rare', 'legendary'];

export const SPECIES = [
  // common
  { id: 'starling', name: 'Starling', rarity: 0, c: ['#2E2A3E', '#3A3550', '#25343C', '#6B5A9A', '#E8C04A'], shape: [1, 0, 1, 0, 1] },
  { id: 'sparrow', name: 'House Sparrow', rarity: 0, c: ['#8A5A36', '#D8CDB8', '#6E6A66', '#4A3424', '#3A3430'], shape: [0.8, 0, 0.9, 0, 0.95] },
  { id: 'robin', name: 'Robin', rarity: 0, c: ['#7A6248', '#F2E8DA', '#E8662C', '#5A4634', '#2E2A28'], shape: [0.8, 0, 0.9, 0, 0.92] },
  { id: 'bluetit', name: 'Blue Tit', rarity: 0, c: ['#7FA25A', '#F2D24A', '#3E7CD8', '#2F63B8', '#2A2A30'], shape: [0.6, 0.15, 0.9, 0, 0.85] },
  { id: 'goldfinch', name: 'Goldfinch', rarity: 0, c: ['#B48A5C', '#F0E2C8', '#E23A2E', '#F4C82A', '#E9D2B0'], shape: [0.9, 0, 1, 0, 0.9] },
  { id: 'chaffinch', name: 'Chaffinch', rarity: 0, c: ['#6C7A8A', '#D88A6A', '#7A8CA6', '#3A3A40', '#8C8C96'], shape: [0.85, 0, 1, 0, 0.95] },
  { id: 'blackbird', name: 'Blackbird', rarity: 0, c: ['#1E1C22', '#26232A', '#1A181E', '#121014', '#F2A51E'], shape: [1.1, 0, 1.25, 0, 1.08] },
  { id: 'swallow', name: 'Barn Swallow', rarity: 0, c: ['#1E3466', '#F0D6B4', '#B2382A', '#14244A', '#1E1C22'], shape: [0.6, 0, 1.3, 0.75, 0.95] },
  { id: 'wagtail', name: 'Wagtail', rarity: 0, c: ['#5E5E64', '#F4F0E6', '#F2F0EA', '#1E1E22', '#1E1E22'], shape: [0.9, 0, 1.6, 0, 0.9] },
  { id: 'dove', name: 'Collared Dove', rarity: 0, c: ['#C2AE9C', '#DCCCC0', '#CCBAAC', '#7E6E64', '#2E2A2A'], shape: [0.8, 0, 1.3, 0, 1.15] },
  // rare
  { id: 'kingfisher', name: 'Kingfisher', rarity: 1, c: ['#169CC8', '#F08A2E', '#1A7FB8', '#2BD3E8', '#1C1A1E'], shape: [1.9, 0, 0.7, 0, 0.95] },
  { id: 'beeeater', name: 'Bee-eater', rarity: 1, c: ['#C9862E', '#2EC2B4', '#E8C82E', '#2E9E4A', '#1C1A1E'], shape: [1.6, 0, 1.2, 0.55, 1] },
  { id: 'hoopoe', name: 'Hoopoe', rarity: 1, c: ['#E2A06A', '#EAC29A', '#E8945A', '#1E1A1E', '#2A2624'], shape: [1.8, 1, 1.1, 0, 1.05] },
  { id: 'waxwing', name: 'Waxwing', rarity: 1, c: ['#B88A72', '#D8B49C', '#C28A6E', '#F2D23A', '#1E1A1E'], shape: [0.8, 0.85, 1, 0, 1] },
  { id: 'oriole', name: 'Golden Oriole', rarity: 1, c: ['#F6C81E', '#F8D640', '#F4C21A', '#1E1A1E', '#D8605A'], shape: [1, 0, 1.05, 0, 1.05] },
  { id: 'roller', name: 'Roller', rarity: 1, c: ['#A8743E', '#4ABCE8', '#5AC8F0', '#2A48C8', '#1E1C22'], shape: [1.2, 0, 1.2, 0.3, 1.1] },
  { id: 'bullfinch', name: 'Bullfinch', rarity: 1, c: ['#7A7E88', '#EE5A48', '#1C1A20', '#F2F0EA', '#1C1A20'], shape: [0.7, 0, 0.95, 0, 1] },
  { id: 'redstart', name: 'Redstart', rarity: 1, c: ['#5E626E', '#F07A32', '#1E1C22', '#E8582A', '#1E1C22'], shape: [0.8, 0, 1.15, 0, 0.92] },
  { id: 'jay', name: 'Jay', rarity: 1, c: ['#C29C8C', '#E6CEC0', '#D8C4BA', '#2E6CE0', '#1E1C22'], shape: [1, 0.4, 1.2, 0, 1.15] },
  // legendary
  { id: 'quetzal', name: 'Quetzal', rarity: 2, c: ['#1EB86A', '#E2283A', '#22C878', '#16E08A', '#F2D23A'], shape: [0.8, 0.6, 1.1, 1, 1.15] },
  { id: 'pheasant', name: 'Golden Pheasant', rarity: 2, c: ['#E8341E', '#E8481E', '#F6C21A', '#1E7AC8', '#E8C04A'], shape: [0.9, 1, 1.9, 0.8, 1.25] },
  { id: 'macaw', name: 'Scarlet Macaw', rarity: 2, c: ['#E21E26', '#E8302A', '#E8261E', '#2A6CE8', '#F2EEE6'], shape: [1.3, 0, 1.8, 0.4, 1.3] },
  { id: 'tanager', name: 'Paradise Tanager', rarity: 2, c: ['#16161C', '#3AC6F0', '#7AF04A', '#E8302A', '#26242A'], shape: [0.8, 0, 1, 0, 0.95] },
  { id: 'raven', name: 'White Raven', rarity: 2, c: ['#F4F2EE', '#E8E4DE', '#FAF8F4', '#CFC8D8', '#E89A8A'], shape: [1.4, 0.2, 1.3, 0, 1.3] },
];

export const SPECIES_BY_ID = new Map(SPECIES.map((s, i) => [s.id, i]));

/** How likely each rarity is when a rare bird is dealt (common, rare, legendary). */
export const RARITY_ODDS = [0.62, 0.3, 0.08];

/** Pick a species index for a dealt rare bird (rng: { next() }). The starling, everyone's first, is never dealt. */
export function dealSpecies(rng) {
  const r = rng.next();
  const rarity = r < RARITY_ODDS[0] ? 0 : r < RARITY_ODDS[0] + RARITY_ODDS[1] ? 1 : 2;
  const pool = SPECIES.map((s, i) => [s, i]).filter(([s, i]) => s.rarity === rarity && i > 0);
  return pool[Math.floor(rng.next() * pool.length) % pool.length][1];
}

/** Song (points) for catching one, by rarity. */
export const CATCH_SONG = [60, 140, 400];
