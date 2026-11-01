# Birds of a Feather: teardown and rebuild plan

Played from a fresh capture of `main` (a1c6b1f): 15 s of autoplay 40 s into a sunset at 1280×720, frames read at full size,
plus the old night/roost takes.

## Teardown: what is wrong today

### Looks cheap
- **Birds are paper darts.** 14 flat triangles, one flat colour, no body, no head, no beak, no shading worth the name. Close to the
  camera they are giant orange confetti filling the bottom of the screen; far away they are specks. No shadows.
- **You can't see yourself.** The chase camera sits behind the flock, so your own birds fill the lower third and your lead bird
  is a speck 30 u ahead under the number. Nothing on screen is "me".
- **The murmuration, the whole point, is invisible.** From inside its tail you never see the flock's shape swirl, stretch and
  bunch. Rival flocks read as smears.
- **The town is "low-poly default".** Untextured flat-shaded boxes with identical gable roofs, black window quads, no doors,
  no streets, no tiles, no AO. Terrain is a blurry vertex-coloured mesh. Trees are icosahedron blobs. Boats are two boxes.
  Nothing says "a harbour town at golden hour" except the colour of the light.
- **The hawk is a 4× paper dart** in brown. It reads as a glitch, not a predator.
- **Post and grade are flat.** A gentle bloom; no colour grade, no depth, no vignette; dusk looks muddy.

### Moves stiffly / feels floaty
- **Steering is indirect.** Turn-rate steering from behind, mouse "turn toward the cursor relative to an invisible bird", and a
  climb/dive axis the camera can't show. On a phone the stick turns left/right instead of pointing where you want to go.
- **Gathering is passive.** Flying over a roof adds birds with a chirp and a "+11". No burst, no chain, no build-up.
- **Steals trickle.** 3-30 birds a second by a hidden "local thickness" rule. Outcomes look random; the "29 vs 53 / thin here"
  labels are jargon that pile up over the flock. No decisive moment, no hit-stop, no sound that lands.
- **Boost** is an FOV kick. No speed lines, wind or visible stretch from this camera.
- **The hawk** strikes from above and behind the camera: you rarely see it coming; the strike is a grey puff.

### Reads unclear
- What the number over another flock means for me (prey or danger) depends on a colour change and a jagged underline.
- The sun clock is a 20 px circle on a line.
- Climb/dive, "thicker here", and the stamina arc are all invisible to a new player.

### Boring after one round / no reason to come back
- One map in the shared sky; every sunset plays the same.
- No short-term goals: no combos, streaks or tricks.
- No mid-term goals beyond place in the round.
- No long-term progression: a personal best, 9 badges and Migration's 12 feathers. Nothing to unlock, collect, wear or show.
- No daily anything. Nothing new tomorrow.

### Compared with the best of the genre
- **slither.io / agar.io:** a readable top view of everyone near you; the camera pulls back as you grow; every clash is
  decisive; skins give identity. Here: no view, mushy clashes, no identity.
- **hole.io:** two-minute rounds that build to a frantic end, a satisfying swallow with physics, a reward screen that tallies
  progress and unlocks a skin. Here: a quiet results card.
- **Flower / Sky:** flight that feels like flight (banking, wind, swooshes), every pickup a musical note in a melody you are
  writing. Here: chirps.
- **Brawl Stars / Fall Guys:** a progression track, rotating maps and events, daily quests, collections. Here: none.

## The rebuild

### 1. See the murmuration (camera and controls)
- A **high three-quarter camera** looking down over the town at your flock (fixed bearing per place, chosen for the light),
  leading in the flight direction and **pulling back as your flock grows**; punch-ins on big moments; the sun's haze fills
  the top of the frame. You see your whole flock's shape and its shadow sweeping over the roofs, and every flock around you.
- **Point where to fly.** Mouse: the bird flies toward the cursor. Keys: WASD/arrows in 8 directions. Phone: the stick points
  the way. One button: Boost. No climb/dive: the bird follows the roofs and thermals lift it.

### 2. Art: a sunset diorama
- **Birds:** a real starling (body, head, beak, two-jointed wings, forked tail), flapping with shoulder and wrist in the vertex
  shader, banking into turns, glides; lit with sun, sky and a rim of sunset light; casting soft shadows on the roofs.
- **Lead birds** are bigger and are a species the player chose from their collection (plumage, crest, tail), with ribbons.
- **The hawk:** a real raptor silhouette (fingered wings, fanned tail); its shadow grows on the ground as it stoops.
- **The town:** whitewashed houses with tiled roofs (procedural tile shading, ridge caps, chimneys with smoke), shuttered
  windows that light up at dusk, doors, balconies, flower boxes, cobbled streets, a square with a fountain, market awnings,
  laundry lines, lamp posts; textured fields, hedges, stylised trees; a sea with foam, swell and a glitter path; boats that
  bob. The same craft in all four places.
- **Grade:** ACES, a sunset colour grade, vignette, bloom on the sun and lights, a gentle tilt-shift so the town reads as a
  miniature at golden hour.

### 3. Feel and juice
- Gathers burst up from the perch with a wing-clap, dust and feathers; the count pops.
- **Chorus:** gathers in quick succession chain (x2, x3...), each a rising note of a melody; x5 gives a free **Tailwind**.
- Steals decide faster (higher rates), spray feathers in both colours at the contact point, and big ones get hit-stop,
  a camera punch and a callout (**Tail cut! +14**). Losing birds shakes the camera toward the hit.
- Boost: speed lines, wind, the flock streams out. Thermals: a spiral of dust and leaves, the flock corkscrews up.
- The hawk: its shadow grows, the screen edge reddens, then hit-stop, slow motion and a feather explosion; "Dodged!" swooshes.
- Sundown: the last seconds in slow motion, everyone flies to the roost; the winner's wire showers feathers.

### 4. Depth and reasons to come back
- **Tricks** with names and points (song): Tail cut, Scatter (take a flock to nothing), Chorus chains, Dodge, Scavenge (scoop
  the hawk's scraps), Slingshot (boost out of a thermal), Close call.
- **Rare birds:** three per sunset sit on landmarks (spire, lighthouse, masts), glinting; first to reach one wins it, a pack
  of grey birds and its species for your **Aviary** (24 species, three rarities). Any species you have caught can lead your flock.
- **Song (XP) and levels 1-40**, tallied after every sunset: unlocks of **trails** (ribbons, petals, lanterns, comet...) and
  **flock flair** (shimmer, glow, gilded tips...) every couple of levels. Others see your species, trail and flair.
- **Daily Sunset:** the same place, twist and rivals for everyone each day; today's top flocks; **three daily goals** and a
  **streak** with rewards.
- **The shared sky rotates places** every sunset (Saltmere, Redrock Canyon, Stormfield, Lantern City), each with its twist.
- Migration stays as the solo campaign (12 feathers). Badges re-cut to the new milestones.

### 5. Sound
Layered wingbeat rush by flock size, chorus notes in key, steal cascades, wind on boost, the hawk's cry and whistle, bells,
a fanfare and the tally's ticks; music that builds through the sunset.

### Order of work
Camera and controls → birds → the world → grade → tricks, rare birds and progression (with tests) → the place rotation →
juice and sound → screens and HUD → check, store art, trailer, docs.
