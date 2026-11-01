// One material for the whole built world: three.js's Lambert lighting (sun, sky, shadows, fog) with surfaces drawn in the
// shader from a per-vertex `surf` code: barrel-tiled roofs, plastered walls with shuttered windows (lit at dusk) and a door,
// planks, stone blocks, foliage that sways, striped cloth, glowing lamps. Cloud shadows drift over everything.
// Static geometry is merged into a handful of meshes; nothing here allocates per frame.

import * as THREE from 'three';

export const SURF = { plain: 0, roof: 1, wall: 2, wood: 3, stone: 4, leaf: 5, lamp: 6, cloth: 7, ground: 8 };

/** Uniforms every world material shares (time, dusk, the drifting clouds). */
export function worldUniforms() {
  return {
    uTime: { value: 0 },
    uDusk: { value: 0 }, // 0 day → 1 night: windows and lamps light up
    uCloud: { value: new THREE.Vector2() },
    uCloudAmt: { value: 1 },
    uFocus: { value: new THREE.Vector3() }, // what the camera follows: things between it and the camera thin out
    uFade: { value: 0 },
  };
}

const NOISE = /* glsl */ `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm3(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.28 + vnoise(p * 4.07 + 3.3) * 0.17; }
`;

const VERT_DECL = /* glsl */ `
attribute vec4 surf;
attribute vec4 sdat;
varying vec4 vSurf;
varying vec4 vSdat;
varying vec3 vWPos;
varying vec3 vWNormal;
uniform float uTime;
`;

const FRAG_DECL = /* glsl */ `
varying vec4 vSurf;
varying vec4 vSdat;
varying vec3 vWPos;
varying vec3 vWNormal;
uniform float uTime;
uniform float uDusk;
uniform vec2 uCloud;
uniform float uCloudAmt;
uniform vec3 uFocus;
uniform float uFade;
${NOISE}
// a perturbed normal from a height gradient (dh/du, dh/dv) over surface coordinates uv, in world space
vec3 bumpNormal(vec3 N, vec2 uv, vec2 dh) {
  vec3 dp1 = dFdx(vWPos);
  vec3 dp2 = dFdy(vWPos);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
  return normalize(N - (T * invmax) * dh.x - (B * invmax) * dh.y);
}
`;

// the surfaces: modify diffuseColor, set pN (world normal) and surfEmit
const SURFACES = /* glsl */ `
vec3 surfEmit = vec3(0.0);
vec3 pN = normalize(vWNormal);
{
  float kind = vSurf.x;
  vec2 uv = vSurf.yz;
  float seed = vSurf.w;
  float far = clamp(length(fwidth(uv)) * 1.6, 0.0, 1.0); // fades fine detail with distance
  if (kind > 0.5 && kind < 1.5) {
    // barrel tiles: rows down the slope, humps across, each tile a little different, moss and age in patches
    float tw = 0.6;
    float rh = 0.5;
    float row = floor(uv.y / rh);
    float uu = uv.x / tw + row * 0.5;
    float tile = floor(uu);
    float fu = fract(uu);
    float fv = fract(uv.y / rh);
    float hump = sin(fu * 3.14159);
    float id = h21(vec2(tile, row) + seed * 17.0);
    float shade = mix(0.7, 1.06, smoothstep(0.0, 0.35, fv)) * mix(0.82, 1.0, hump);
    shade = mix(shade, 0.93, far);
    vec3 c = diffuseColor.rgb * shade * (0.9 + 0.2 * id);
    float age = fbm3(vWPos.xz * 0.35 + seed * 3.0);
    c = mix(c, c * vec3(0.78, 0.82, 0.62), smoothstep(0.55, 0.8, age) * 0.6);
    c = mix(c, vec3(0.42, 0.4, 0.36), smoothstep(0.75, 0.95, id) * 0.25);
    diffuseColor.rgb = c;
    float near = (1.0 - far) * (1.0 - far);
    float dhu = cos(fu * 3.14159) * 3.14159 / tw * 0.05 * near;
    float dhv = (fv < 0.15 ? -0.5 : 0.07) * near;
    pN = bumpNormal(pN, uv, vec2(dhu, dhv));
  } else if (kind > 1.5 && kind < 2.5) {
    // plaster: a stone plinth, grime at the foot, and windows by style (vSdat.w): 0-4 houses with shutters of that colour,
    // 5 city blocks, 6 a church's arched windows, 7 a bell tower with a clock and a belfry, 8 none
    float W = vSdat.x;
    float H = vSdat.y;
    float flags = vSdat.z;
    float style = vSdat.w;
    vec3 wall = diffuseColor.rgb;
    float grain = fbm3(uv * vec2(1.3, 2.1) + seed * 9.0);
    vec3 c = wall * (0.94 + 0.08 * grain);
    c *= mix(0.74, 1.0, smoothstep(0.0, 1.8, uv.y));
    // streaks under the eaves and from the sills
    c *= 1.0 - 0.07 * smoothstep(H - 1.2, H, uv.y) * (1.0 - far);
    if (uv.y < 0.45) c = mix(wall * vec3(0.7, 0.66, 0.6), c, 0.2);
    // a corner quoin line
    float edge = min(uv.x, W - uv.x);
    c *= mix(0.9, 1.0, smoothstep(0.0, 0.18, edge));
    if (style < 4.5) {
      float storey = 2.9;
      float level = floor(uv.y / storey);
      float fy = uv.y - level * storey;
      float n = max(1.0, floor(W / 2.5));
      float sp = W / n;
      float col = floor(uv.x / sp);
      float fx = uv.x - (col + 0.5) * sp;
      bool door = flags > 0.5 && level < 0.5 && abs(col - floor(n * 0.5)) < 0.5;
      float ww = door ? 0.55 : 0.42;
      float wy0 = door ? 0.0 : (level < 0.5 ? 0.95 : 0.85);
      float wy1 = door ? 2.15 : wy0 + 1.25;
      float top = H - 0.55;
      // a string course between storeys
      if (level > 0.5 && fy < 0.12) c *= 0.9;
      if (uv.y < top && uv.x > 0.4 && uv.x < W - 0.4 && W > 1.6 && uv.y + (wy1 - fy) < top + 0.3) {
        float inX = step(abs(fx), ww);
        float inY = step(wy0, fy) * step(fy, wy1);
        float frame = step(abs(fx), ww + 0.1) * step(wy0 - 0.14, fy) * step(fy, wy1 + 0.08);
        vec3 sh = style < 0.5 ? vec3(0.17, 0.42, 0.55) : style < 1.5 ? vec3(0.22, 0.45, 0.33) : style < 2.5 ? vec3(0.12, 0.56, 0.56) : style < 3.5 ? vec3(0.76, 0.58, 0.28) : vec3(0.52, 0.27, 0.2);
        float open = h21(vec2(col * 1.7, level + seed * 13.0));
        float sw = open < 0.3 ? 0.0 : 0.5; // some windows have their shutters closed
        float shut = (1.0 - inX) * step(abs(fx), ww + sw) * inY * (door ? 0.0 : 1.0);
        if (frame > 0.5) c = mix(c, wall * 1.1, 0.9 - far * 0.5);
        // the sill's shadow
        if (fy < wy0 - 0.14 && fy > wy0 - 0.3 && abs(fx) < ww + 0.1 && !door) c *= mix(0.78, 1.0, far);
        if (shut > 0.5) {
          float slat = 0.82 + 0.18 * step(0.5, fract(fy * 7.0));
          c = mix(c, sh * mix(slat, 1.0, far), 1.0 - far * 0.4);
        }
        if (inX * inY > 0.5) {
          float wid = h21(vec2(col, level) + seed * 31.0);
          vec3 glass = door ? vec3(0.3, 0.19, 0.13) : vec3(0.15, 0.17, 0.23);
          if (open < 0.3 && !door) glass = sh * 0.95; // closed: the shutters cover the glass
          glass += vec3(0.13, 0.12, 0.14) * smoothstep(wy0 + 0.5, wy1, fy) * (door || open < 0.3 ? 0.0 : 1.0);
          // a cross of glazing bars
          if (!door && open >= 0.3 && (abs(fx) < 0.035 || abs(fy - (wy0 + wy1) * 0.5) < 0.035)) glass = wall * 0.95;
          c = mix(c, glass, 1.0 - far * 0.35);
          float lit = step(wid, 0.2 + uDusk * 0.6) * smoothstep(0.08, 0.6, uDusk) * (door ? 0.35 : open < 0.3 ? 0.25 : 1.0);
          surfEmit += vec3(1.0, 0.62, 0.26) * lit * (0.75 + 0.5 * h21(vec2(wid, 3.1))) * 1.6;
        }
      }
    } else if (style < 5.5) {
      // a city block: a cornice, shopfronts on the ground floor, then storeys of tall framed panes
      float storey = 3.6;
      float level = floor(uv.y / storey);
      float fy = uv.y - level * storey;
      float n = max(1.0, floor(W / 3.0));
      float sp = W / n;
      float col = floor(uv.x / sp);
      float fx = uv.x - (col + 0.5) * sp;
      float wid = h21(vec2(col, level) + seed * 31.0);
      if (uv.y > H - 0.9) c = wall * (uv.y > H - 0.35 ? 1.12 : 0.72);
      else if (level < 0.5) {
        if (abs(fx) < sp * 0.42 && fy > 0.25 && fy < 2.7) {
          vec3 shop = vec3(0.14, 0.16, 0.2) + vec3(0.1) * smoothstep(1.4, 2.7, fy);
          c = mix(c, shop, 1.0 - far * 0.3);
          surfEmit += vec3(1.0, 0.7, 0.35) * step(wid, 0.25 + uDusk * 0.7) * smoothstep(0.1, 0.5, uDusk) * 1.3;
        }
        if (fy > 2.8 && fy < 3.3) c = mix(c, (wid < 0.5 ? vec3(0.55, 0.2, 0.18) : vec3(0.2, 0.36, 0.3)), 0.85 - far * 0.3);
      } else {
        if (fy < 0.15) c *= 0.88;
        float inX = step(abs(fx), sp * 0.26);
        float inY = step(0.85, fy) * step(fy, 3.0);
        float frame = step(abs(fx), sp * 0.26 + 0.12) * step(0.7, fy) * step(fy, 3.1);
        if (frame > 0.5) c = mix(c, wall * 1.12, 0.85 - far * 0.5);
        if (inX * inY > 0.5) {
          vec3 glass = vec3(0.16, 0.19, 0.25) + vec3(0.16, 0.15, 0.17) * smoothstep(1.6, 3.0, fy);
          if (abs(fx) < 0.04) glass = wall;
          c = mix(c, glass, 1.0 - far * 0.35);
          float lit = step(wid, 0.15 + uDusk * 0.55) * smoothstep(0.08, 0.6, uDusk);
          surfEmit += mix(vec3(1.0, 0.62, 0.28), vec3(0.85, 0.9, 1.0), step(0.8, h21(vec2(wid, 7.0)))) * lit * (0.7 + 0.5 * h21(vec2(wid, 3.1))) * 1.5;
        }
      }
    } else if (style < 6.5) {
      // a church: tall arched windows that glow at dusk
      float n = max(1.0, floor(W / 4.2));
      float sp = W / n;
      float col = floor(uv.x / sp);
      float fx = uv.x - (col + 0.5) * sp;
      float r = 0.65;
      float y0 = 2.6;
      float y1 = H - 2.2;
      float inside = step(abs(fx), r) * step(y0, uv.y) * step(uv.y, y1 - r) + step(length(vec2(fx, uv.y - (y1 - r))), r);
      float rim = step(abs(fx), r + 0.18) * step(y0 - 0.2, uv.y) * step(uv.y, y1 - r) + step(length(vec2(fx, uv.y - (y1 - r))), r + 0.18);
      if (rim > 0.5) c = mix(c, wall * 0.84, 0.8 - far * 0.4);
      if (inside > 0.5) {
        vec3 glass = vec3(0.16, 0.18, 0.28);
        float lead = step(0.5, fract(uv.y * 2.2)) * step(0.5, fract(fx * 2.2 + 0.25));
        glass = mix(glass, vec3(0.3, 0.16, 0.3), lead * 0.6);
        c = mix(c, glass, 1.0 - far * 0.3);
        surfEmit += mix(vec3(1.0, 0.55, 0.25), vec3(0.6, 0.4, 1.0), lead) * smoothstep(0.1, 0.6, uDusk) * 1.4;
      }
      if (flags > 0.5 && abs(uv.x - W * 0.5) < 0.95 && uv.y < 3.1) {
        float arch = step(uv.y, 2.15) + step(length(vec2(uv.x - W * 0.5, uv.y - 2.15)), 0.95);
        if (arch > 0.5) c = vec3(0.32, 0.2, 0.13);
      }
    } else if (style < 7.5) {
      // a bell tower: a clock face below a belfry of arched openings
      float fx = uv.x - W * 0.5;
      float bel0 = H - 5.2;
      float bel1 = H - 1.4;
      float r = 0.75;
      float inside = step(abs(fx), r) * step(bel0, uv.y) * step(uv.y, bel1 - r) + step(length(vec2(fx, uv.y - (bel1 - r))), r);
      if (abs(uv.y - (bel0 - 0.3)) < 0.22 || abs(uv.y - (H - 0.4)) < 0.3) c *= 0.82;
      if (inside > 0.5) {
        c = mix(c, vec3(0.1, 0.09, 0.11), 1.0 - far * 0.3);
        surfEmit += vec3(1.0, 0.7, 0.4) * smoothstep(0.3, 0.9, uDusk) * 0.6;
      }
      vec2 cp = vec2(fx, uv.y - (bel0 - 1.9));
      float cr = length(cp);
      if (cr < 1.15) {
        c = cr > 1.0 ? wall * 0.5 : vec3(0.95, 0.92, 0.84);
        float ang = atan(cp.x, cp.y);
        float tick = step(0.94, cos(ang * 12.0)) * step(0.78, cr) * step(cr, 0.95);
        c = mix(c, vec3(0.12), tick);
        // the hands at ten to seven
        vec2 hd1 = vec2(sin(-2.62), cos(-2.62));
        vec2 hd2 = vec2(sin(-1.05), cos(-1.05));
        float h1 = step(abs(cp.x * hd1.y - cp.y * hd1.x), 0.06) * step(0.0, dot(cp, hd1)) * step(cr, 0.55);
        float h2 = step(abs(cp.x * hd2.y - cp.y * hd2.x), 0.045) * step(0.0, dot(cp, hd2)) * step(cr, 0.85);
        c = mix(c, vec3(0.1), max(h1, h2));
        surfEmit += vec3(1.0, 0.85, 0.55) * step(cr, 1.0) * smoothstep(0.2, 0.8, uDusk) * 0.5;
      }
    }
    diffuseColor.rgb = c;
  } else if (kind > 2.5 && kind < 3.5) {
    float plank = floor(uv.y / 0.32);
    float id = h21(vec2(plank, seed));
    float edge = smoothstep(0.0, 0.06, fract(uv.y / 0.32));
    diffuseColor.rgb *= mix(0.75, 1.0, edge) * (0.86 + 0.24 * id) * (0.94 + 0.08 * vnoise(vec2(uv.x * 0.8, plank * 3.0)));
  } else if (kind > 3.5 && kind < 4.5) {
    float rh = 0.55;
    float row = floor(uv.y / rh);
    float bw = 1.1;
    float bu = uv.x / bw + row * 0.5;
    float id = h21(vec2(floor(bu), row) + seed);
    float m = smoothstep(0.0, 0.06, fract(uv.y / rh)) * smoothstep(0.0, 0.05, fract(bu)) * smoothstep(1.0, 0.95, fract(bu));
    diffuseColor.rgb *= mix(mix(0.7, 1.0, m), 0.95, far) * (0.88 + 0.22 * id);
  } else if (kind > 4.5 && kind < 5.5) {
    // foliage: clumps of light and shade, the sunny top lighter
    float clump = fbm3(vWPos.xz * 0.9 + vWPos.y * 0.7 + seed);
    diffuseColor.rgb *= 0.78 + 0.4 * clump;
    diffuseColor.rgb *= mix(0.72, 1.12, clamp(pN.y * 0.5 + 0.5, 0.0, 1.0));
  } else if (kind > 5.5 && kind < 6.5) {
    surfEmit += diffuseColor.rgb * (0.25 + uDusk * 2.6);
  } else if (kind > 6.5 && kind < 7.5) {
    float stripe = step(0.5, fract(uv.x / 0.7));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.94, 0.88), stripe * (1.0 - far * 0.5));
  }
}
`;

// whatever stands between the camera and the flock it follows thins out in a dither, so the flock is never hidden
const SEE_THROUGH = /* glsl */ `
if (uFade > 0.0) {
  vec3 ab = uFocus - cameraPosition;
  float t = clamp(dot(vWPos - cameraPosition, ab) / dot(ab, ab), 0.0, 1.0);
  float d = length(vWPos - (cameraPosition + ab * t));
  float r = mix(3.0, 12.0, t);
  float k = smoothstep(r, r * 0.55, d) * (1.0 - smoothstep(0.82, 0.95, t)) * uFade;
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (k * 0.9 > ign) discard;
}
`;

const CLOUDS = /* glsl */ `
{
  float cl = fbm3(vWPos.xz / 95.0 + uCloud);
  float shadow = mix(1.0, 0.55, smoothstep(0.52, 0.7, cl) * uCloudAmt);
  reflectedLight.directDiffuse *= shadow;
}
`;

/**
 * A Lambert material with the world's surfaces. Geometry gives `color`, `surf` (kind, u, v, seed) and `sdat` (wall: width,
 * height, door flag, shutter colour; foliage: sway).
 */
export function worldMaterial(uniforms, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (surf.x > 4.5 && surf.x < 5.5) {
          float sw = sdat.x * max(0.0, position.y - sdat.y);
          transformed.x += sin(uTime * 1.4 + position.x * 0.13 + position.z * 0.07) * sw;
          transformed.z += cos(uTime * 1.1 + position.z * 0.11) * sw * 0.7;
        }`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vSurf = surf;
        vSdat = sdat;
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${SEE_THROUGH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${SURFACES}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(pN, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += surfEmit;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${CLOUDS}`);
  };
  mat.customProgramCacheKey = () => 'world-surf';
  return mat;
}

/** Cloud shadows only (for materials that aren't surfaces: the ground). */
export function cloudChunk() {
  return { decl: `uniform vec2 uCloud;\nuniform float uCloudAmt;\n${NOISE}`, apply: CLOUDS };
}

const col = new THREE.Color();

/** Collects triangles with colours and surface codes into one geometry. Smooth normals where given, else flat. */
export class Builder {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.s = [];
    this.d = [];
    this.r = 1;
    this.g = 1;
    this.b = 1;
    this.kind = 0;
    this.seed = 0;
    this.dat = [0, 0, 0, 0];
  }
  color(hex, k = 1) {
    col.set(hex);
    this.r = col.r * k;
    this.g = col.g * k;
    this.b = col.b * k;
    return this;
  }
  rgb(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }
  surf(kind, seed = 0, dat = null) {
    this.kind = kind;
    this.seed = seed;
    this.dat = dat ?? [0, 0, 0, 0];
    return this;
  }
  /** A vertex: p [x, y, z], n [nx, ny, nz], uv [u, v], shade (multiplies the colour). */
  vert(p, n, uv, shade = 1) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(this.r * shade, this.g * shade, this.b * shade);
    this.s.push(this.kind, uv ? uv[0] : 0, uv ? uv[1] : 0, this.seed);
    this.d.push(this.dat[0], this.dat[1], this.dat[2], this.dat[3]);
  }
  tri(a, b, c, uva = null, uvb = null, uvc = null, sa = 1, sb = 1, sc = 1) {
    const n = faceNormal(a, b, c);
    this.vert(a, n, uva, sa);
    this.vert(b, n, uvb, sb);
    this.vert(c, n, uvc, sc);
  }
  /** A quad a b c d (counter-clockwise seen from outside), uv from its own frame: u along a→b, v along a→d. */
  quad(a, b, c, d, uv = null, shades = null) {
    const s = shades ?? [1, 1, 1, 1];
    const u = uv ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
    this.tri(a, b, c, u[0], u[1], u[2], s[0], s[1], s[2]);
    this.tri(a, c, d, u[0], u[2], u[3], s[0], s[2], s[3]);
  }
  /** A box: base centre (x, y, z), w × h × d, turned by yaw. UVs in world units per face. */
  box(x, y, z, w, h, d, yaw = 0, { top = true, bottom = false, shadeFoot = 1 } = {}) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const P = (u, v, yy) => [x + c * u + s * v, y + yy, z + s * u - c * v];
    const hw = w / 2;
    const hd = d / 2;
    const b0 = P(-hw, -hd, 0);
    const b1 = P(hw, -hd, 0);
    const b2 = P(hw, hd, 0);
    const b3 = P(-hw, hd, 0);
    const t0 = P(-hw, -hd, h);
    const t1 = P(hw, -hd, h);
    const t2 = P(hw, hd, h);
    const t3 = P(-hw, hd, h);
    const f = shadeFoot;
    this.quad(b0, b1, t1, t0, [[0, 0], [w, 0], [w, h], [0, h]], [f, f, 1, 1]);
    this.quad(b1, b2, t2, t1, [[0, 0], [d, 0], [d, h], [0, h]], [f, f, 1, 1]);
    this.quad(b2, b3, t3, t2, [[0, 0], [w, 0], [w, h], [0, h]], [f, f, 1, 1]);
    this.quad(b3, b0, t0, t3, [[0, 0], [d, 0], [d, h], [0, h]], [f, f, 1, 1]);
    if (top) this.quad(t0, t1, t2, t3, [[0, 0], [w, 0], [w, d], [0, d]]);
    if (bottom) this.quad(b3, b2, b1, b0);
  }
  /** A cylinder or cone on its base centre; smooth sides. */
  cyl(x, y, z, r0, r1, h, seg = 8, cap = true, uvScale = 1) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      const n0 = [Math.cos(a0), (r0 - r1) / Math.max(h, 1e-3), Math.sin(a0)];
      const n1 = [Math.cos(a1), (r0 - r1) / Math.max(h, 1e-3), Math.sin(a1)];
      const p0 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0];
      const p1 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0];
      const q0 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1];
      const q1 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
      const u0 = a0 * r0 * uvScale;
      const u1 = a1 * r0 * uvScale;
      this.vert(p0, n0, [u0, 0]);
      this.vert(q0, n0, [u0, h]);
      this.vert(q1, n1, [u1, h]);
      if (r1 > 0.001) {
        this.vert(p0, n0, [u0, 0]);
        this.vert(q1, n1, [u1, h]);
        this.vert(p1, n1, [u1, 0]);
      } else {
        this.vert(p0, n0, [u0, 0]);
        this.vert(q1, n1, [u1, h]);
        this.vert(p1, n1, [u1, 0]);
      }
      if (cap && r1 > 0.001) this.tri([x, y + h, z], q1, q0);
    }
  }
  /** A rounded blob (an icosphere, subdivided once), squashed by sy, smooth normals; shade darker underneath. */
  blob(x, y, z, r, sy = 1, wobble = 0, under = 0.7) {
    const g = BLOB;
    for (let i = 0; i < g.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const vx = g[i + k * 3];
        const vy = g[i + k * 3 + 1];
        const vz = g[i + k * 3 + 2];
        const j = 1 + wobble * Math.sin(vx * 5.1 + vy * 3.3 + vz * 4.7 + x * 0.7 + z * 0.3);
        this.vert([x + vx * r * j, y + vy * r * sy * j, z + vz * r * j], [vx, vy / Math.max(sy, 0.3), vz], [vx * r, vy * r], under + (1 - under) * (vy * 0.5 + 0.5));
      }
    }
  }
  /** A thin tube along points (triangular section). */
  tube(points, radius) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const l = Math.hypot(dx, b[1] - a[1], dz) || 1;
      let ux = -dz / l;
      let uz = dx / l;
      const ul = Math.hypot(ux, uz) || 1;
      ux /= ul;
      uz /= ul;
      const ring = (p) => [0, 1, 2].map((k) => {
        const ang = (k / 3) * Math.PI * 2;
        return [p[0] + ux * Math.cos(ang) * radius, p[1] + Math.sin(ang) * radius, p[2] + uz * Math.cos(ang) * radius];
      });
      const ra = ring(a);
      const rb = ring(b);
      for (let k = 0; k < 3; k++) this.quad(ra[k], rb[k], rb[(k + 1) % 3], ra[(k + 1) % 3]);
    }
  }
  get count() {
    return this.p.length / 3;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('surf', new THREE.Float32BufferAttribute(this.s, 4));
    g.setAttribute('sdat', new THREE.Float32BufferAttribute(this.d, 4));
    g.computeBoundingSphere();
    return g;
  }
}

export function faceNormal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

const BLOB = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  return Array.from(g.attributes.position.array);
})();
