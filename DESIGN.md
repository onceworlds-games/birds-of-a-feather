# Birds of a Feather: design

## The pitch

**Lead a flock across the sunset: gather the grey birds, fly through rival flocks to steal theirs, and be the biggest when the
sun goes down.**

**The goal in one line:** biggest flock at sundown wins.

What a new player sees in one look: a sky full of murmurations over a harbour town, theirs in one colour with a big number over
it, grey birds sitting on the roofs and wires below, and the sun sinking toward the sea at the top of the screen.

**Signature mechanic:** your score is a living murmuration. It swirls behind you, stretches when you boost and bunches when you
turn, and where two flocks overlap, birds switch to whichever side is thicker *right there*, one by one, in a visible ripple of
colour. A big flock swallows a small one head-on; a small flock that slices through a big one's thin tail steals its stragglers.

## The first minute (what a new player sees and does)

| Time | What happens | Hint (2-5 words, once) |
|---|---|---|
| 0.0 s | The page paints the title at once (HTML name and the Fly sign over a sunset gradient); the 3D world builds and its shaders compile after that first paint. | |
| ~1 s | **Title**: the camera sits just behind a telegraph wire high over Saltmere's rooftops; 16 grey birds perch on the wire in the foreground, bobbing. Beyond, the live sky: rival flocks sweep over the town, rippling colour as they steal from each other. The name, big. One sign hangs from a wire strung across the screen: **Fly** (Space). Under it, `Best 312` if the player has one. | |
| tap | Fly starts the AudioContext. The 16 birds on the wire burst into the air (wing-clap burst, chirps); the camera drops off the wire into a swoop and settles behind your lead bird. Eight of the birds stay with you and flash into your colour, rear to front; the other eight wheel away grey. Your number pops up over the flock: **8**. | |
| 1.5 s after | Flying. The sun clock (top centre) shows the sun high over its horizon line. | "Steer with the mouse" / "Steer with A and D" / "Steer with the stick" (the device used last) |
| 5 s | If nothing is gathered yet, a soft cream pulse rings the nearest roof of grey birds. | "Gather the grey birds" |
| ~8 s | You pass over the roof: the grey birds burst up and swirl into your flock, each one flashing your colour as it arrives; a cascade of chirps; `+11` flies from the roof into your number, which squashes and settles at **19**. | |
| ~12 s | | "Biggest flock at sundown wins" |
| 10-25 s | More roofs and wires; a grey wheeling murmuration over the fields. Flying into it is the first gasp: 40 birds turn your colour at once. The leaderboard (top right) shows you climbing: 5th, 4th. | "Hold Space to boost" / "Hold the mouse to boost" / "Hold Boost to speed up" (near prey, or at 26 s) |
| ~25 s | The first smaller rival comes into view; its number is drawn cream (prey). | "Cut through smaller flocks" |
| ~30 s | You cut through it: a ripple of colour through its birds starting where you touched, `+14`, a rising chirp run, and a small "54 vs 37 / thicker here" at the contact point. If a bigger rival heads at you, its number is Ember with a jagged underline. | "Avoid bigger flocks" (first time one closes in) |
| ~40 s | First thermal shimmering ahead over a chimney. | "Ride the thermal" |
| 45 s+ | The first hawk can come for the biggest flock: its cry, its silhouette circling high, an Ember aim ring on the target. On a new player's first sunset it never targets them before 1:30. | "Hawk! Turn hard" (first time it hunts you) |
| 60 s | The light turns from gold to ember; the music adds its bass and shaker. | |

A player who has never finished a sunset gets the gentle first round: if they are alone in the server, the rivals play Easy;
the hawk leaves them alone until 1:30; hints show. A hint shows again only to someone who seems stuck (no birds gathered for
20 s: "Gather the grey birds" again).

## Controls

One stick, one button, the same in every mode. You never crash: the flight floor follows the ground and the roofs.

| Input | Keyboard and mouse | Phone and tablet |
|---|---|---|
| Steer (turn) | Mouse: the bird turns toward the cursor (aimed at a point 25 u ahead of the lead bird, projected on screen; a small dead zone). Or A/D, ←/→. | The platform's stick (`stick: 'analog'`), x |
| Climb and dive | Mouse above/below the lead bird, or W/S, ↑/↓ | The stick, y (up = climb) |
| Boost (hold) | Space or hold the left mouse button | One button: **Boost** (key Space) |
| Fly / continue | Space or Enter (or click/tap the sign) | Tap the sign |

The mouse steers without pointer lock, so Esc and the platform's buttons always work. Whichever device was used last steers (and
names itself in the hints). When a cursor leaves the frame its steering eases back to straight.

**Altitude, decided:** the bird flies in a height band that follows the ground, roofs and trees under it and 12 u ahead (so it
rises before a building, never into it). Let go and it eases back to **cruise** (7 u above the surface), where it passes right over
perched birds and gathers them. Push up to climb (slower), down to dive (faster). Climbing is for crossing over a bigger flock,
escaping and reaching a thermal; diving is free speed. A beginner who only turns left and right plays a complete game at cruise.

## The core loop and where mastery comes from

Every few seconds: pick a target (a roof of grey birds, a wheeling grey flock, a rival you can beat), fly to it, gather or steal,
watch your number jump, look for the next one, glance at the sun.

| | A beginner | An expert |
|---|---|---|
| Gathering | Flies at roofs one at a time | Chains a route of perches and wires, rides thermals between them, shepherds a grey wheel into a clean pass |
| Stealing | Hits whatever is smaller, often head-on into its thick front | Reads the overlap: slices the last fifth of a big flock's tail, crosses at right angles to cut more, keeps their own flock bunched with tight turns |
| Boost | Holds it until empty and sheds birds | Taps it (the first 0.6 s is free) to strike or escape; boosts after leaving a thermal |
| Altitude | Stays at cruise | Climbs over a bigger flock to escape, dives on prey for speed |
| The hawk | Gets hit | Turns hard as the hawk folds its wings; trails the leader to scoop the birds the hawk scatters |
| Sundown | Hopes | Banks a lead early, then avoids every contact in the last 20 s, or saves a boost for one last tail cut |

## The rules

### The flock's shape (what the rules and the drawing both use)

Every flock is its lead bird plus *n* birds. The rules don't track birds one by one; they describe a flock by the path its leader
just flew:

- The leader's path is kept for 6 s with points a twentieth of a second apart, whatever rate it's fed at (the own bird pushes at
  60 Hz, the host at 30 Hz); the newest point always follows the leader.
- The flock trails the leader by **T = 0.5 + 0.08·√n seconds** of that path (n = 100: 1.3 s, about 18 u long; n = 400: 2.1 s).
  A boosting leader covers more path in those seconds, so a boost strings the flock out by itself.
- Along that stretch sit **8 puffs** (spheres) at u = (k + 0.5)/8 of the way back. Puff k holds n·w(u)/Σw birds with
  **w(u) = (1 − u)² + 0.05**: a dense head and a thin tail (n = 300: 91, 70, 51, 36, 24, 15, 8, 5 birds front to back).
- Puff radius = **2 + 0.5·√(birds in it)** u. Vertical distances count 0.75× (flocks at nearly the same height always meet).

Turning tightly curls the path, so the same birds sit closer together: a flock in a tight turn is denser. Boosting stretches it
thin. Both fall out of the shape with no extra rule. Big flocks are heavier: from 100 to 500 birds they turn up to 30% wider and
fly up to 12% slower.

Each page draws every bird of every flock flying toward a slot in this shape (see Rendering), so what you see is what the host
judges.

### Gathering wild birds

- **Perched** birds (roofs, wires, trees, masts, the church tower): one per perch slot, in clusters of 6-30. They join when the
  lead bird passes within **6 u** horizontally while no more than 4 u above its cruise height (perches up to 5 u above the bird
  count too). At cruise you gather a roof just by flying over it; climbing passes over it.
- **Grey wheels**: wild murmurations circling on fixed loops over the fields, the harbour and the cliffs. A wheel is one puff of
  radius 7 + 0.4·√n; while your leader is inside it, its birds join at **25 a second**. When a wheel is empty it's gone.
- **Loose clouds**: birds just scattered by a hawk or shed by a boost. A puff of radius 6 that drifts down for 4 s; any leader
  inside gathers **30 a second**. After 4 s the rest land on the nearest free perches and are perched birds again.
- Gathered birds take your colour as they reach the flock. Birds scattered from a flock or shed by it won't rejoin that flock for
  2.5 s.

### Stealing

Ten times a second, for each pair of flocks whose puffs overlap (centre distance < sum of radii):
1. Take the deepest overlapping pair; its midpoint is the **contact point P**.
2. Each flock's **local count** at P is the sum over its puffs of (birds in puff) × max(0, 1 − distance/10 u).
3. If one side's local count L_w ≥ **1.25 ×** the other's L_l, the thinner side loses birds to the thicker one at
   **clamp(0.5 × (L_w − L_l), 3, 30) birds a second**, never more than its own local count at P. Within 25% nothing moves.
4. The birds that switch are the loser's birds nearest P; they flash and turn the winner's colour one after another, spreading
   outward from P (the ripple). Both sides see why at P, for a moment: "21 vs 16" and "thicker here" on the winner's side,
   "thin here" on the loser's.

One contact per pair per tick, a fresh flock (just spawned or respawned) is shielded for 3 s, and a flock can drop to 0: then
it's the lead bird alone, which is never taken, and the hint "Gather the grey birds" returns.

Worked numbers (the tests check them, and that swapping the two sides swaps the result exactly): a compact 30-bird flock
crossing the tail of a cruising 300-bird flock reads about 21 against 16 there and takes 3 birds a second while it stays. The
same 30 flying into the 300's head reads about 19 against 116 and loses 30 a second: nearly all of itself. Two flocks of 100
meeting head-on read the same and pass through each other.

### Boost

Hold to fly at 24 u/s instead of 14. Stamina lasts **3 s**, starts refilling 0.4 s after you let go, and is full again in **4 s**;
a boost needs 0.3 s of stamina to start. The first **0.6 s** of a boost is free; after that a flock of more than 12 sheds **4% of
its birds a second** (at least 1) from its tail into a loose cloud behind it. A full 3 s boost from 200 birds sheds about 19, which
a chaser can scoop up. The stamina shows as a gold arc on the ring under your lead bird, and only while it isn't full.

### Thermals

Shimmering columns of rising air over chimneys, cliff edges and sun-baked fields (8 in Saltmere), 9 u wide and 55 u tall. Inside
one you rise 8 u/s (the band's ceiling lifts to 48 u) and stamina refills 2.5× as fast; leaving one gives **+30% speed**, fading
over 2.5 s. Free speed for whoever plans a route through them.

### The hawk

- The first hawk can come at **0:45**, then every **35 ± 5 s**; in the last 40 s of a sunset every **22 ± 3 s**. One at a time.
  A runaway flock (120+ birds and more than twice the next) brings it back every 20 s.
- It hunts the **biggest flock with at least 40 birds** (not a shielded one; in a new player's first sunset, not them before 1:30).
  If none qualifies it waits 5 s and looks again.
- **Circle (4 s):** it glides down to circle high over its target, with a cry everyone hears (louder for the target). The target
  sees an Ember edge arrow toward it, an Ember aim ring on their flock and the hint "Hawk! Turn hard".
- **Stoop (1.2 s):** it folds its wings and dives at where the flock's head will be in 1.2 s, extrapolated from the leader's
  velocity when the dive begins (a rising whistle). A hard turn, a boost or a dive at that moment makes it miss.
- **Strike:** a 9 u sphere. Each flock inside loses **min(25% of its birds, 30% of its birds inside the sphere)** into a loose cloud
  at the strike point. A clean hit takes 15-25% (300 birds: ~64; 1,000 birds: ~16%); a partial hit less; a dodge nothing
  ("Dodged!" for a flock of 40+).
- The scattered cloud is the catch-up: whoever is shadowing the leader scoops it up.

### The sunset (a round)

- A sunset lasts **3:00**. The sun is the clock: **gold** (3:00-2:00), **ember** (2:00-1:00), **rose** (1:00-0:25), **dusk**
  (the last 25 s, window lights come on). The sun sinks toward the sea as it runs. The music rises with it.
- **Sundown** at 0:00: every flock flies to the town's great wires and roosts. Biggest flock wins (a tie shares first).
- **Night: 15 s**: the roost and results (0-5 s the landing, the results from 3 s, 12-15 s a 3 s dawn sweep: the light runs back
  to gold), then a new sunset starts by itself.
- At dawn every flock starts again with **8 birds** at a spawn point around the edge of town, facing in; the wild birds are dealt
  again from the new sunset's seed (1,000 perched out of 1,500 perch slots, plus 5 grey wheels of 40: **1,200 wild birds**).
- Birds are conserved during a sunset: they only move between flocks, perches, wheels and loose clouds. New birds appear only
  with a new flock (8) and at dawn.
- Nobody flying (everyone on the title or in Migration) for 10 s: the sky **parks** (the clock stops, rival flocks keep flying for
  the title's view under a low ember sun). The next Fly starts a fresh dawn, so nobody's first sunset begins with 20 seconds left.
- The world is a 600 × 600 u square; flight is kept inside a circle of radius 290 u around the town: from 255 u out the bird is
  turned gently home and a sea mist thickens. No walls.

## Solo

A player alone is in a public server by themselves (or a private one): the same sky, with **rival flocks** filling it to 7 flocks.
That *is* the main game alone, endless sunsets with personal bests. The host picks how sharp the rivals are on the night screen
(Easy, Normal, Hard; Normal by default; Easy for a first sunset alone).

**Rival flocks** (bots) are named like birds and each has a personality, never a tag:

| Personality | Names | Plays like |
|---|---|---|
| Gatherer (greedy) | Magpie, Gull, Jackdaw | Beelines for the biggest grey clusters; fights only when clearly thicker |
| Hunter | Kestrel, Shrike, Merlin | Stalks flocks it can beat, aims at tails, times its boosts, shadows the leader for scattered birds |
| Skittish (coward) | Plover, Sparrow, Linnet | Flees anything bigger, flies high, scoops scattered birds |
| Drifter | Swift, Gannet, Tern | Rides thermals between perches in long loops; fair in a fight |

How a rival thinks (on the host, through the same flight rules as a player): every reaction time it scores what's within 150 u:
grey clusters (birds ÷ (distance + 20) × greed), prey (the birds it would win at the best contact point ÷ (distance + 30) ×
aggression), threats (bigger flocks closing in, × fear), thermals (when stamina is low, × thermal love). It steers at the best one
with a lead, adds heading noise and misjudges counts, boosts by personality, and dodges a stoop with a chance.

| Skill | Reaction | Heading noise | Count misjudged by | Dodges a stoop | Uses thermals | Notices a bigger flock |
|---|---|---|---|---|---|---|
| Easy | 0.6 s | ±25° | ±40% | 10% | 20% | at 40 u, and often wanders off |
| Normal | 0.35 s | ±12° | ±20% | 45% | 50% | at 65 u |
| Hard | 0.2 s | ±5° | ±8% | 80% | 90% | at 90 u, and cuts tails |

Every rival also flees a storm front (Stormfield) before it reaches it.

### Migration (the solo series)

Four places, one sunset each (2:00), each with its own map, twist and goal. It's a solo activity inside a public sky: the night
screen offers it **only while you're alone in the room** (the title keeps its one button). While you're on a Migration you're
still in the room, but your flock isn't in the shared sky (the shared sky parks); the same rules run on your page. Pausable
(`ow.on('pause')`, Esc, a hidden page). **If someone arrives mid-place**, the place ends at once and a sign says "Kestrel flew
in" with **Fly**, back to the shared sky: never two sunsets at once in one room.

| # | Place | Rivals | Twist | Goal: 1 feather | 2 | 3 |
|---|---|---|---|---|---|---|
| 1 | **Saltmere Harbour**: the town at golden hour | 3 Easy | none; hawk every 40 s | Finish first | first with 150 | first with 250 |
| 2 | **Redrock Canyon**: red mesas, a river gorge | 4 Normal | 12 strong thermals on the rims; canyon falcons: a hawk every 20 s | Keep 150 at sundown | 250 | 350 |
| 3 | **Stormfield**: wheat, farms, a windmill | 4 Normal | a storm front rolls west to east at 4 u/s: everywhere behind it a flock sheds 6% a second; "Stay out of the storm" | Finish first | first with 200 | first with 300 |
| 4 | **Lantern City**: rooftops and towers, lights on | 6 Hard | starts in the pink; 1,600 rooftop pigeons; a hawk every 25 s | First with 300 | first with 450 | first with 600 |

Each place unlocks when the one before it earns a feather. Feathers (best per place, out of 12) are kept. A full run is about 10
minutes; three feathers everywhere takes many tries. Results offer **Again**, **Next place** and **Back to the sky**.

**How long solo lasts:** endless sunsets in the sky (personal best, leaderboards, three rival skills), plus Migration's 12 feathers.

## Multiplayer

**A public drop-in sky**, `onceworlds.rooms.join({ maxPlayers: 12 })`, called as the page loads. No lobby, no ready-up: one sunset
flows into the next with the night as a visible intermission (the platform guide's nonstop drop-in arena). Friends get private servers
and invites from the platform; the game shows no server menus. The title's one button, Fly, puts you in the sky.

- **Seats:** up to 12 flocks: every flying player, plus rival flocks to make 7 (with 7+ players flying there are none). A player
  who arrives mid-sunset starts at once with 8 birds at the spawn point farthest from other flocks, shielded for 3 s. A rival
  flock over the count leaves at the next dawn (never mid-sunset); one that's missing joins at once, flying in from the sea.
- **Who decides what:** each page flies its own lead bird (its input, its flight). The **host's page** runs the rules: joins,
  steals, shedding, hawks, the clock, spawns and the rival flocks. Nobody else can write the counts.
- **Presence** (20 Hz, ~100 bytes): `{ x, y, z, hx, hz, p, b, st, rid }`: position, heading as a unit vector (no angle wrap),
  climb, boosting, status (`title`, `fly`, `mig`), the sunset it's in. The host's presence also carries its rival leaders:
  `rv: { 'r1': [x, y, z, hx, hz, b], ... }` (under 600 bytes for 6), so every page draws them with `presenceAt`, smoothly.
- **Host state** (only the host writes `host:` keys; written when changed, at most 8 times a second):
  - `host:sky`: `{ v, rid, seed, map, dawnAt, parked, skill, flocks: [[id, slot, n, shieldUntil, spawn], ...], hawk }`:
    the sunset (dawnAt on `ow.now()`, the platform's clock), every flock's colour slot and count, the hawk's phase, target and
    aim point.
  - `host:wild`: `{ rid, perched (base64 bitset of the perch slots), wheels: [n, ...], loose: [[id, x, y, z, n, until], ...] }`.
  - `host:results`: `{ rid, standings: [[id, n], ...] }`, written at sundown, so a page that loads during the night sees them.
- **Messages** (host → everyone, batched, at most 10 a second): what to animate: `steal` (from, to, k, P), `join` (flock, perch
  ids or wheel or cloud, k), `shed` (flock, k), `strike` (P, losses). Only for show: counts always come from state, and each page
  eases its drawn birds to the counts in state.
- **Fairness:** the host judges every flock where it was 100 ms ago, its own and the rivals' too, the same moment it sees other
  players (`presenceAt`). Gathers feel instant anyway: the gathered birds take ~0.4 s to fly into your flock, by which time the
  host's count has arrived.
- **Checked on the host:** presence shapes and ranges (finite numbers, inside the world, `st` from the list); speed (a leader that
  moves faster than 36 u/s, or teleports more than 40 u, is treated as a respawn: no gathering or stealing along the jump).
  **Checked on every page:** every `host:` value against its schema (a bad one is ignored, the last good one stays), names drawn
  as text only.
- **Latecomers** fly at once (above). **Reloads:** the seat hold keeps the flock and its count; the page reads its own last
  presence (`room.me.presence`) and, if it was flying this sunset, skips the title and carries on from there ("Tap for sound"
  until its first tap). **Away** (seat held): the flock circles where it was and can be stolen from, but gathers nothing.
  **Leavers** (seat hold over): the flock bursts into a loose cloud, a feast for whoever is near.
- **Host change:** the new host carries on from `host:sky` and `host:wild` (no reset) and takes over the rival leaders from where
  its page last drew them. While offline (`room.connected` false) a host page does nothing a host does. Authority is
  `room.isHost && room.connected`, checked every frame.
- **Budget:** at 12 players, presence 20 Hz each plus the host's ~16 writes and messages a second, well inside a room's share.
- **Room closed:** one message and one button, as the platform guide says: kicked "You were removed" → Play; disconnected "Connection lost"
  → Rejoin; replaced "Playing in another tab" → Play here. Each calls `rooms.join` again with the same options.

**Why the room directly, not createMatch/createBots:** there is no lobby or match to run, and rival flocks fly in real time, not
through calls every 700 ms. The game writes its `host:` values itself and checks every read against its own schema
(`src/sim/wire.js`).

## Progression and reasons to come back

- **Saved** (`ow.save`, key `profile`, written at sundown, at a Migration result and on a badge, never every frame): biggest flock
  ever, biggest at sundown, sunsets flown, sunsets won, birds gathered and stolen in total, Migration feathers per place, rival
  skill picked, which hints were seen.
- **Personal bests** on the title (`Best 312`) and on the night screen ("New best!").
- **Leaderboards:** `biggest-flock` (your biggest flock at sundown), `sundowns` (sunsets won, total), `feathers` (Migration
  feathers, 0-12).
- **Badges** (9):

| id | Name | Earned by |
|---|---|---|
| `first-flock` | First Flock | Gather 50 birds in one sunset |
| `hundred-birds` | Hundred Birds | Lead a flock of 100 |
| `murmuration` | Murmuration | Lead a flock of 400 |
| `tail-cutter` | Tail Cutter | Steal 10 birds in one pass from a flock bigger than yours |
| `hawk-dodger` | Hawk Dodger | Make a hawk miss you with 40+ birds |
| `sundown-king` | Sundown King | Biggest flock at sundown, with 4+ flocks in the sky |
| `thermal-rider` | Thermal Rider | Ride 5 thermals in one sunset |
| `migration` | Migration | Earn a feather in all four places |
| `twelve-feathers` | Twelve Feathers | Earn all 12 feathers |

## Balance and timing

All numbers live in one file (`src/sim/config.js`) that the game and the tests import.

| Thing | Number |
|---|---|
| Lead bird speed | 14 u/s; boost 24 u/s (0.25 s to reach); dive up to ×1.25; climb ×0.85; thermal exit +30% over 2.5 s; up to 12% slower from 100 to 500 birds |
| Turn rate | 110°/s (80°/s boosting), eased over 0.12 s, up to 30% wider for big flocks; bank up to 55° (drawn) |
| Height band | floor surface + 2.5 u, cruise + 7, ceiling + 30 (+48 in a thermal); climb 7 u/s, dive 11 u/s, back to cruise 3 u/s |
| Stamina | 3 s; refill 4 s after a 0.4 s pause; 0.3 s to start; first 0.6 s of a boost free |
| Shedding | 4% of n per s (min 1) once n > 12 |
| Flock length | T = 0.5 + 0.08·√n s of the leader's path |
| Join | 6 u horizontal, at most 4 u over cruise; wheels 25/s; loose clouds 30/s, 4 s; 2.5 s before your own scattered birds rejoin |
| Steal | margin 1.25; rate clamp(0.5·ΔL, 3, 30)/s; kernel 10 u; shield 3 s |
| Hawk | 0:45 first, 35 ± 5 s, last 40 s 22 ± 3 s, a runaway flock every 20 s; circle 4 s, stoop 1.2 s, strike 9 u, ≤ 25% |
| Thermals | 8 in Saltmere; 9 u radius, 55 u tall, +8 u/s lift, stamina ×2.5 |
| Sunset | 3:00 (Migration 2:00), night 15 s; start 8 birds |
| Wild | 1,200 per sunset (1,000 perched of 1,500 slots + 5 wheels × 40); Lantern City 1,600 |
| Flocks | rivals fill to 7; at most 12 |
| Rival skill | the table under Solo |

**Targets the tests hold the game to** (simulations of whole sunsets in node, many seeds, with rival flocks and scripted players):
- A sunset ends at exactly 3:00 and the cycle repeats every 3:15; a parked sky restarts on the first Fly.
- Seven Normal flocks: the lead changes at least once in 60%+ of sunsets and the winner holds under 60% of all flock birds (no
  runaway leader; over 20 seeds the winner has 360-640 birds, median ~470, and ~45% of the flock birds); some wild birds are
  always left at sundown.
- A Hard rival against six Easy ones wins 60%+ of sunsets, against six Hard ones 35% or less (bots are beatable, and skill
  shows).
- The tail cut, head-on and equal-flock cases above; a full 3 s boost from 200 birds sheds 15-25; a clean hawk strike takes 15-25%
  and a hard turn at the stoop 5% or less.
- Birds are conserved within a sunset; no NaN, no flock below 0, nothing outside the world, over thousands of simulated sunsets.
- A fake room: the host reloads mid-sunset (the next host carries on; counts, clock and rivals intact), a player leaves (their
  birds become a loose cloud), a latecomer gets a flock at once, a page sends garbage presence (ignored).

## Every screen

There is no lobby screen: the sky is drop-in, and the night between sunsets is the intermission.

The game's own buttons are **signs hung from a wire**: solid rectangles (gold for the main one, cream for the rest, 3 px corners,
ink text, 56 px tall at least, the key shown on them) hanging by two thin strings from a sagging wire across the screen. At most
two on a screen, never a stack.

1. **Title.** The live sky behind (the real room's flocks, or the parked sky's rivals) from just behind a foreground telegraph
   wire with 16 perched grey birds (the camera tilts up on a phone held upright, so the sky and roofs fill the tall frame).
   "Birds of a Feather" in Bricolage Grotesque ExtraBold, cream with a thick ink outline: one line, centred, on landscape; three
   lines on portrait. The **Fly** sign hangs by two strings from a wire drawn across the screen under the name, swinging a
   little; `Best 312` in Big Shoulders beneath it. Nothing else. Music: the dusk pad, quiet.
2. **Takeoff** (1.3 s): the wire birds burst up, the camera swoops down behind your lead bird.
3. **Play HUD**:
   - **Top centre: the sun clock.** A short ink horizon line, the sun's disc sinking into it as the sunset runs (its colour the
     sky's sun), so its height reads as the time left. In the last 30 s the time appears beneath it in Big Shoulders (`0:24`),
     with a soft bell each of the last 10 seconds.
   - **Top right: the wires.** Up to 5 rows (3 + you on a phone held upright, under the clock): place numeral, the flock's
     symbol in its colour, name, count. Each row sits on its own thin sagging wire; your row's wire is cream. No panel behind it:
     cream text with an ink outline. It starts below whatever the platform reserves at the top (`ow.ui.reserved`).
   - **Over every flock:** its count (Big Shoulders; yours 48 px, others 30-44 px by distance) with its symbol, the name beneath
     (16 px). A rival's number is cream when it's smaller than yours (prey) and Ember with a jagged underline when it's bigger
     (danger). Tags shrink with distance, never under 16 px, and fade beyond 220 u.
   - **Your lead bird:** a thin cream ring under it, with the stamina arc in gold on it (only while not full).
   - **Edge pointers:** the biggest rival (its symbol and count) when it's off screen; the hunting hawk (Ember, a hawk glyph) when
     it's after you.
   - **Floating numbers:** `+11` flies from where the birds came from into your count; `−18` in Ember drops from it.
   - **Hints:** centre of the upper third, Bricolage 700, 24-28 px, cream with an ink outline, fading in and out.
   - The top-left corner (the platform's menu) and the lower corners (stick, Boost) stay empty; layout follows `ow.ui.reserved`.
4. **Sundown and the roost** (the night, 15 s). Your bird flies itself to the great wires over the harbour road and the camera
   pulls back to them against the last light. Flocks land on them in their colours, one wire each, biggest on top (top 5, plus
   yours), each bird flying to its own place on the wire. At 3 s a fanfare, and feathers in the winner's colour shower over its
   wire. Each wire is labelled at its head: place, symbol, name, count. Above them one line says why: "Kestrel: biggest flock at
   sundown, 412" (or "You: biggest flock at sundown, 847"), and "New best!" when it is. Badges earned pop as the platform's
   notices. Signs: **Migration** (cream, only while you're alone in the room) and, for the host when rival flocks fly, **Rivals:
   Easy · Normal · Hard** as three small tags on one wire (the chosen one gold). "Dawn in 7" counts down in Big Shoulders. Then
   the dawn sweep and the next sunset, with no tap needed.
5. **Migration route.** The coast seen from high at dusk; a dotted flight path of tiny bird glyphs links the four places. Each
   stop: its name, its goal in a few words ("Finish first", "Keep 150"), its feathers (three feather shapes, filled or empty);
   locked ones dim with a lock shape. Tapping a stop shows its **Fly** sign; **Back to the sky** sits on the same wire.
6. **Migration place intro** (2 s, over a live flyover of the place): the place's name big and its goal under it, then play.
7. **Migration result.** The roost scene of that place; the goal line ticked or not; feathers fill one by one with a chime each.
   Signs: **Next place** (gold) or **Again**, and **Back to the sky**.
8. **Migration pause.** "Paused", Resume (gold), Leave (cream), on the wire.
9. **Room closed.** One message on the wire's sign and one button (see Multiplayer).

## Art direction

**The world:** Saltmere, a whitewashed harbour town on a hill above the sea at golden hour, seen from the sky: terracotta roofs,
crooked chimneys, a church tower in the square, telegraph wires strung across every street and out over the fields, a lighthouse
on a western headland, cliffs and sea stacks, a patchwork of wheat and green fields with hay bales and a windmill on the north
hill, fishing boats in the harbour. Clean low-poly with soft, warm, physically lit materials; long sunset shadows; haze in the
distance; the sea a mirror of the sky with a glitter path to the sun. The sun sets in the west over the sea.

**Palette:**

| Role | Name | Hex |
|---|---|---|
| Ground/ink (outlines, shade, the platform's panel) | Dusk Ink | `#231A2E` |
| Text, whitewash | Cream | `#FFF1DC` |
| Accent, the sun, main buttons, good | Sun Gold | `#FFB547` |
| Danger, the hawk, bigger flocks | Ember | `#F05A3C` |
| Dusk sky, the last 30 s | Rose | `#E8758F` |
| Sea, deep shade | Harbour Teal | `#1E5866` |
| Roofs | Terracotta | `#C0563A` |

Wild birds are Ash `#8D8794` with darker wingtips: plainly uncoloured. **Flock colours** (12, each with a symbol, so no flock is
told apart by colour alone): Cobalt `#2D6CFF` circle, Vermilion `#FF3B2F` triangle, Jade `#22C98A` square, Saffron `#FFC21A`
diamond, Fuchsia `#E040A0` star, Cyan `#1FC8F0` cross, Lime `#9BE03A` hexagon, Tangerine `#FF8A1E` chevron, Violet `#8E5CFF`
ring, Rose Pink `#FF7FA8` X, Teal `#0FA3A0` crescent, Ivory `#F2EAD8` pentagon (the last slot, used only by a full sky). The host
gives each flock a free slot; it keeps it while it stays.

**Type:** Bricolage Grotesque (variable; ExtraBold for the title, Bold for names, hints and signs) and Big Shoulders Display
(Black) for every number: counts, the clock, places. Self-hosted woff2 files in `public/fonts` (latin only, OFL); canvas text
waits for `document.fonts.load` with a 1.5 s timeout.

**The signature element: the wire.** A sagging telegraph wire with birds perched on it. It's everywhere: the title's foreground,
every button hangs from it, every leaderboard row sits on one, the results are flocks roosting on the great wires, the badges and
the icon are drawn from it. The murmurations are the signature *in play*; the wire is what a screenshot remembers.

**Light and camera:** a low directional sun with soft shadows (a tight shadow box that follows the player; map size by
`ow.settings.quality`: low none, medium 1024, high 2048), a hemisphere light (sky colour over warm ground bounce), sRGB output,
ACES tone mapping, exponential fog in the horizon's colour. The sky dome is a gradient shader with the sun's disc and a halo,
driven by the sunset's time along with the sun's colour, intensity and angle: gold → orange → pink → dusk violet. Window lights
come up in the dusk (emissive). Bloom on medium and high only (high threshold: the sun, its glitter, the windows). The camera
chases from behind and above the lead bird, far enough to see the whole flock: the flock's length (T × 14 u) + 10 u back, up to
46 u, and 5 u + a third of that above; ×1.3 further back on a phone held upright, with a field of view kept at about 50° across.
It springs after the bird, banks a little into turns, widens its field of view on a boost, and never sinks below the surface. `ow.settings.reducedMotion`: no shake, no flashes, no roll, no field-of-view kick.

**Birds:** a low-poly bird (body, two hinged wings, tail; about 20 triangles) drawn instanced in three draw calls (flying,
perched, lead birds) with a per-instance colour; wings flap in the vertex shader from a per-bird phase and rate, with glides
mixed in by a slow wave, so a flock shimmers. Backs and wings are the flock's colour with a touch of emissive (it still reads at
dusk), bellies dark ink, so a flock reads as its colour from any side. Birds steer toward their slots in the shape on a fixed
30 Hz step; near flocks also keep apart through a spatial hash, far ones skip it. **Lead birds** are 1.65× bigger, with two
ribbon streamers in their colour, and the flock's symbol on the tag. **The hawk** is four times a bird's size, dark umber.

**Juice:** gathered birds burst up from a perch with a wing-clap and arrive with a colour flash; your count squashes and stretches
on every change; a steal ripples colour through the losing flock with a rising chirp run; a big loss shakes the camera (trauma,
decaying, squared, smooth); the hawk's strike has a 90 ms slow-motion on the birds and feathers bursting; thermals throw
the flock upward with a whoosh; winning showers feathers in your colour. Particles scale with quality.

## Sound

All synthesized with Web Audio; one mixer bus for effects and one for music (music quieter on the title and at night).

- **Wingbeats:** a looped, filtered flutter whose density and loudness grow with your flock's size (a rush of thousands at 400+);
  rival flocks nearby add theirs by distance.
- **Gather:** birdsong chirps (short FM sweeps on a pentatonic scale), one per arriving bird, staggered; a wing-clap burst from a
  perch.
- **Steal:** a cascade of chirps rising in pitch when you gain, falling when you lose, over a soft whoosh.
- **Boost:** a whump on press, wind rising with speed; a soft two-note fall when birds are shed.
- **Thermal:** a warm swell and an upward whoosh.
- **Hawk:** the cry (a screech gliding down, with breath noise), a whistle rising through the stoop, a thump and a flutter burst
  on the strike; "Dodged!" gets a bright sting.
- **Clock:** a soft bell on each of the last 10 seconds; sundown is a deep bell and a held chord.
- **Results:** a brass-like fanfare and a chorus of birdsong for the winner; a gentle resolved chord for everyone else.
- **UI:** a wooden tick on signs.
- **Music:** a small sequencer at 88 BPM in D. Gold: a warm pad and a plucked arpeggio. Orange: + soft bass and a shaker. Pink:
  + a whistled melody (a sine with vibrato, like a bird). The last 30 s: + pulsing drums and a rising swell, up a semitone. Night:
  a music-box lullaby. Title: the dusk pad and distant birds.

## Store art and the trailer

All rendered by the game itself in poster mode (`?poster=<name>`: fixed seed, the moment staged and frozen, no HUD).
- **Cover** (`thumb-1`): two huge murmurations colliding in front of the setting sun over Saltmere's roofs, Cobalt rippling into
  Vermilion, their numbers over them; the name once, big.
- **Action** (`thumb-2`): the hawk mid-stoop into a flock, birds bursting outward, close.
- **Win** (`thumb-3`): sundown on the great wires: your flock on the top wire, the others below in order, feathers falling.
- **Multi** (`thumb-4`): six flocks over the town, each with its number.
- **Icon:** a Cobalt flock curling behind its lead bird in front of a big sun's disc. No text.
- **Badges:** each a bold symbol on a coloured disc (a bird on a wire, a hawk's head, a thermal spiral, feathers...).
- **Trailer** (30 s, 1280×720, real play on autoplay: a Hard hunter's mind flies your bird): 0-6 s your flock over the
  rooftops in gold light, count, sun clock and board in view, gathering and growing (the goal); 6-12 s along the cliffs, cutting
  a rival's tail ("thicker here", the count climbing); 12-21 s dusk, the clock counting down from 0:11, the hawk's aim ring on
  your 700-bird flock; 21-27 s sundown, the flocks landing on the wires and "You: biggest flock at sundown"; 27-30 s the title,
  the name over the live sky.

## Originality check

It resembles **.io games** (agar.io, slither.io: grow by collecting, absorb whoever is smaller) and calm **flying games** (Flower,
Journey's flight). What a player notices in the first minute that is different:
- Your score is a flock you watch move, not a number on a blob: it swirls, stretches and bunches.
- Size alone doesn't win a clash: the thicker side *at the contact point* does, so a small flock beats a big one's tail.
- Nobody dies or respawns: you lose birds, never your life. Speed costs birds.
- The sun is the clock, and the round ends with everyone roosting on the wires, the results drawn as birds on a wire.

## Risks and how they're handled

- **Steals feel random** if what you see differs from what the host judges. Every drawn bird flies to a slot in the same 8-puff
  shape the rules use; the host judges everyone at the same 100 ms delay; tests check the drawn and judged shapes agree.
- **Phones and 1,500+ birds:** one instanced mesh for all flying birds, one for perched ones, one for lead birds, flapping in
  the shader, birds stepped at a fixed 30 Hz (a spatial hash only for flocks near the camera); under ~60 draw calls; shadows and
  bloom only above low; no per-frame allocation; the frame loop stops on a hidden page (a 2 Hz tick keeps a hidden host's sky
  running). `?stats=1` logs frame times; the platform check measures the game's own work at under 2 ms a frame.
- **Runaway leader:** the hawk hunts the biggest, big flocks have long thin tails, boosting sheds, scattered birds feed chasers;
  the balance tests above hold it.
- **Twelve colours:** every flock also has a symbol, a name and a number.
- **Altitude confusing:** cruise does everything a beginner needs; flocks within a few units of height always meet (vertical
  distance counts 0.75×); you can't crash.
- **A lone player landing late in a sunset:** the parked sky starts fresh on their Fly.
- **The host leaving mid-sunset:** everything that matters is in `host:` state and the clock is on `ow.now()`; rivals continue
  from the new host's mirror of them.
- **Load time:** three.js (~140 KB gzipped, its own file) and the game (~65 KB gzipped) and two fonts; the title paints from
  HTML before the 3D world is built and its shaders compile (`compileAsync`).
- **Bandwidth at 12 players:** presence ~100 bytes at 20 Hz; host state only on change and at most 8 Hz; events batched.

## Stack

Vite + three.js (npm, `package-lock.json` committed, `"dir": "dist"`, `vite.config.js` with `base: './'`), the three.js addons
for the bloom pass, and self-hosted fonts. The SDK is the platform's `window.onceworlds`; every call is wrapped so a page outside
the platform (or a poster) plays on a stub room. No physics library: flight is a few lines of steering, and the flock is the
shape above.

- `src/sim/` (pure, no `window`, three.js or SDK; node tests import them): `config.js` (every number), `rng.js` (seeded),
  `maps.js` (the four places: terrain heights, buildings, wires, perch slots, thermals, wheels' loops, spawns, from a seed),
  `flight.js` (a leader's flight: turning, the height band, boost, stamina, thermals, the boundary), `flock.js` (paths, the
  8-puff shape, local counts), `rivals.js` (the bots' thinking), `sky.js` (one whole sky: flight at a fixed 30 Hz, the rules
  (gathering, stealing, shedding, the hawk, the storm, the clock, spawns) at 10 Hz, giving events), `migration.js` (places,
  goals, feathers), `wire.js` (state shapes, checks, the perch bitset). The own bird flies at a fixed 60 Hz on its page.
- `src/net.js` (the room: presence, host state, events, host change, a stub room off the platform), `src/render/` (`view.js`
  sky, light and bloom; `look.js` the sunset's colours; `world.js`; `birds.js`; `fx.js` ribbons, the hawk's flight, rings,
  feathers, the storm), `src/hud.js` (a 2D canvas over the 3D one), `src/screens.js`
  (title, night, Migration, the signs), `src/audio.js`, `src/poster.js`, `src/autoplay.js` (`?autoplay=1`, never in production:
  a Hunter flies your bird, for the trailer), `src/main.js`.
- `test/*.test.mjs` under `node --test`.
