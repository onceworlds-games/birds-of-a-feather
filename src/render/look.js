// The sunset is the clock and the art: one function from "how far through the sunset" to every colour and light in the sky.

import * as THREE from 'three';

// share of the sunset → the light (gold, then ember, rose and dusk: warm to the end, never magenta); night after sundown
const KEYS = [
  { s: 0.0, zenith: '#5E9BD0', horizon: '#FFD7A1', haze: '#F5C690', sun: '#FFE6B0', sunI: 2.7, hemiSky: '#BFD6EE', hemiGround: '#B58A5A', hemiI: 1.15, elev: 26, glow: 0, disc: '#FFF1C8' },
  { s: 0.2, zenith: '#6A97C9', horizon: '#FFC983', haze: '#F2B878', sun: '#FFD99A', sunI: 2.6, hemiSky: '#C7D2E2', hemiGround: '#B98352', hemiI: 1.1, elev: 19, glow: 0, disc: '#FFE9B0' },
  { s: 1 / 3, zenith: '#5E7FB8', horizon: '#FFA55C', haze: '#F0975A', sun: '#FFB873', sunI: 2.45, hemiSky: '#C5B9C9', hemiGround: '#B4704A', hemiI: 1.0, elev: 14, glow: 0, disc: '#FFD79A' },
  { s: 0.52, zenith: '#56699F', horizon: '#FF9452', haze: '#E68B62', sun: '#FFAC6C', sunI: 2.35, hemiSky: '#A8A8CE', hemiGround: '#946A50', hemiI: 1.05, elev: 9, glow: 0.05, disc: '#FFC07A' },
  { s: 2 / 3, zenith: '#4C5590', horizon: '#F78A58', haze: '#D98A66', sun: '#FFA66C', sunI: 2.0, hemiSky: '#A4AACB', hemiGround: '#8C664E', hemiI: 1.02, elev: 5.5, glow: 0.2, disc: '#FFAE78' },
  { s: 0.8, zenith: '#3D4583', horizon: '#EE7E58', haze: '#C27A62', sun: '#FFA070', sunI: 1.7, hemiSky: '#9AA4CF', hemiGround: '#7C5E56', hemiI: 0.95, elev: 3, glow: 0.45, disc: '#FFA070' },
  { s: 155 / 180, zenith: '#2F3669', horizon: '#D86E5A', haze: '#A2675C', sun: '#FF9A74', sunI: 1.5, hemiSky: '#8C98CA', hemiGround: '#604E58', hemiI: 0.95, elev: 1.6, glow: 0.75, disc: '#FF8E6C' },
  { s: 1.0, zenith: '#232850', horizon: '#A85A5E', haze: '#7A5258', sun: '#F09280', sunI: 1.05, hemiSky: '#7884BC', hemiGround: '#4C4258', hemiI: 0.88, elev: -0.5, glow: 1, disc: '#FF806A' },
  { s: 1.12, zenith: '#16173A', horizon: '#4A3A6E', haze: '#3A3058', sun: '#A2B2E2', sunI: 0.62, hemiSky: '#5E6CA2', hemiGround: '#302E4A', hemiI: 0.76, elev: 18, glow: 1, disc: '#E8E4FF' },
];

const tmp = KEYS.map((k) => {
  const o = { ...k };
  for (const key of Object.keys(k)) if (typeof k[key] === 'string') o[key] = new THREE.Color(k[key]);
  return o;
});

const out = {
  zenith: new THREE.Color(),
  horizon: new THREE.Color(),
  haze: new THREE.Color(),
  sun: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  disc: new THREE.Color(),
  sunI: 0,
  hemiI: 0,
  elev: 0,
  glow: 0,
  sunDir: new THREE.Vector3(),
};

/** The light at share s (0 = the start of a sunset, 1 = sundown, up to 1.12 = night). Returns a shared object. */
export function lightAt(s) {
  s = Math.max(0, Math.min(KEYS[KEYS.length - 1].s, s));
  let i = 0;
  while (i < tmp.length - 2 && s > tmp[i + 1].s) i++;
  const a = tmp[i];
  const b = tmp[i + 1];
  const t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
  for (const key of ['zenith', 'horizon', 'haze', 'sun', 'hemiSky', 'hemiGround', 'disc']) out[key].copy(a[key]).lerp(b[key], t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  out.elev = a.elev + (b.elev - a.elev) * t;
  out.glow = a.glow + (b.glow - a.glow) * t;
  // the sun sets in the west, a little south; at night the moon rides higher in the east-south
  const night = s > 1.0;
  const el = (out.elev * Math.PI) / 180;
  const az = night ? 0.6 : Math.PI - 0.32 + s * 0.12;
  out.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
  return out;
}

/** The light phase's name at share s, for the music and the HUD. */
export function phaseAt(s) {
  if (s >= 1) return 'night';
  if (s >= 155 / 180) return 'dusk';
  if (s >= 2 / 3) return 'rose';
  if (s >= 1 / 3) return 'ember';
  return 'gold';
}
