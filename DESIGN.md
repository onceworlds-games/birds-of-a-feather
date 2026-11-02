# Birds of a Feather: design

## The pitch

**Lead a flock across the sunset: gather the grey birds, fly through rival flocks to steal theirs, catch the rare birds on the
landmarks, and be the biggest when the sun goes down.**

**The goal in one line:** biggest flock at sundown wins.

What a new player sees in one look: a town from high above at golden hour, murmurations sweeping over it in their colours, theirs
with a big number over it and a bird in front of it, grey birds sitting on the roofs and wires below, a pillar of light over a
church spire where a rare bird waits, and the sun sinking toward its horizon line at the top of the screen.

**Signature mechanic:** your score is a living murmuration. It swirls behind you, stretches when you boost and bunches when you
turn, and where two flocks overlap, birds switch to whichever side is thicker *right there*, one by one, in a visible ripple of
colour. A big flock swallows a small one head-on; a small flock that slices through a big one's thin tail steals its stragglers.

**Why you come back:** every sunset pays song (the game's points) into a level, 1 to 40; levels open trails and flair for your
flock; rare birds caught fill a 24-species Aviary and can lead your flock; three daily goals, three weekly goals, a streak and
one Daily Sunset a day (the same place, rivals and seed for everyone, with its own board).

## The first minute (what a new player sees and does)

| Time | What happens | Hint (2-5 words, once) |
|---|---|---|
| 0.0 s | The page paints the title at once (HTML name and the Fly sign over a sunset gradient); the 3D world builds and its shaders compile after that first paint. | |
| ~1 s | **Title**: from under a telegraph wire high over the town, looking up into the sunset: starlings perch on the wire dark against the sky, your own lead bird among them in its species and flair; roofs and chimneys along the foot of the frame, smoke drifting. The name, big. **Fly** hangs from a wire under it, with **Today** (the day's goals done, `1/3`) and **Aviary** beside each other below, and the level bar. | |
| tap | Fly starts the AudioContext. The wire birds burst into the air (wing-clap, chirps); the camera swoops up and settles high above your lead bird, looking down at 54°. Your number pops up over the flock: **8**. | |
| 1.5 s after | Flying. The sun clock (top centre) shows the sun high over its horizon line. | "Point where to fly" / "Fly with WASD" / "Point the stick to fly" (the device used last) |
| 5 s | If nothing is gathered yet, a soft cream pulse rings the nearest roof of grey birds. | "Gather the grey birds" |
| ~8 s | You pass over the roof: the grey birds burst up and swirl into your flock, each one flashing your colour as it arrives; `+11` flies into your number. A second roof soon after sings the next note of a **Chorus** (`Chorus ×2`, a pip lights under your number). | |
| ~12 s | | "Biggest flock at sundown wins" |
| 10-25 s | More roofs and wires, a grey wheel over the fields. The board (top right) shows you climbing. | "Hold the mouse to boost" / "Hold Space to boost" / "Hold Boost to speed up" |
| ~25 s | The first smaller rival comes into view; its number is drawn cream (prey). | "Cut through smaller flocks" |
| ~30 s | You cut through it: a ripple of colour through its birds from where you touched, a rising chirp run, "thicker here" at the contact point. A bigger rival's number is Ember with a jagged underline. | "Avoid bigger flocks" |
| ~40 s | A thermal shimmers ahead over a chimney; riding it calls **Thermal**, boosting out of it **Slingshot**. | "Ride the thermal" |
| any time | The pillar of light over a landmark: fly through the rare bird circling there and it leads its little flock into yours: `Rare bird`, its name, a slow-motion beat. | |
| 45 s+ | The first hawk can come for the biggest flock: its cry, its dark shape circling, an Ember aim ring on the target. On a new player's first sunset it never targets them before 1:30. | "Hawk! Turn hard" |

A player who has never finished a sunset gets the gentle first round: if they are alone in the server, the rivals play Easy;
the hawk leaves them alone until 1:30; hints show. A hint shows again only to someone who seems stuck (no birds gathered for
20 s: "Gather the grey birds" again).

## Controls

Point where to fly, hold to boost, the same in every mode. You never crash: the flight floor follows the ground and the roofs.

| Input | Keyboard and mouse | Phone and tablet |
|---|---|---|
| Fly (point) | Mouse: the lead bird turns toward the point on the ground under the cursor. Or WASD / the arrows: eight ways, up the screen is up. | The platform's stick (`stick: 'analog'`, `zone: 'wide'`): the bird flies the way it points |
| Boost (hold) | Space or hold the left mouse button | One button: **Boost** (key Space) |
| Fly / the main sign | Space or Enter (or click or tap the sign) | Tap the sign |
| Today, Aviary, Migration | T, B, M | The signs |
| Back / pause a Migration place | Esc | The signs |

The mouse steers without pointer lock, so Esc and the platform's buttons always work. Whichever device was used last steers (and
names itself in the hints). When a cursor leaves the frame its steering eases back to straight. The touch controls are on only
while flying: every screen (the title, the night, Today, the Aviary, results) clears them, so their buttons take the whole screen.

**Altitude, decided:** nobody steers up or down. The bird flies in a height band that follows the ground, roofs and trees under it
and 12 u ahead (so it rises before a building, never into it), at **cruise** (7 u above the surface), where it passes right over
perched birds and gathers them. Thermals lift it (to 48 u) and it eases back down after. The high camera reads the whole town as a
map, so the game is about where you go, not how high.

## The core loop and where mastery comes from

Every few seconds: pick a target (a roof of grey birds, a wheeling grey flock, a rival you can beat, a rare bird's light), fly to
it, gather or steal, watch your number jump and your Chorus climb, look for the next one, glance at the sun.

| | A beginner | An expert |
|---|---|---|
| Gathering | Flies at roofs one at a time | Chains perches inside 2.6 s each to sing a Chorus of five (a free 4 s Tailwind) and six, rides thermals between them |
| Stealing | Hits whatever is smaller, often head-on into its thick front | Reads the overlap: slices the last fifth of a big flock's tail (a **Tail cut** at 12 birds in one pass), crosses at right angles, keeps their own flock bunched with tight turns |
| Rare birds | Finds one by chance | Plans a route through the landmarks before the rivals get there; a legendary is worth 400 song and 48 birds |
| Boost | Holds it until empty and sheds birds | Taps it (the first 0.6 s is free) to strike or escape; boosts out of a thermal for a Slingshot |
| The hawk | Gets hit | Turns hard as the hawk folds its wings (**Dodged**); trails the leader to scoop the birds the hawk scatters (**Scavenge**) |
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
  velocity when the dive begins (a rising whistle). A hard turn or a boost at that moment makes it miss.
- **Strike:** a 9 u sphere. Each flock inside loses **min(25% of its birds, 30% of its birds inside the sphere)** into a loose cloud
  at the strike point. A clean hit takes 15-25% (300 birds: ~64; 1,000 birds: ~16%); a partial hit less; a dodge nothing
  ("Dodged!" for a flock of 40+).
- The scattered cloud is the catch-up: whoever is shadowing the leader scoops it up.

### Rare birds

Three a sunset, dealt from the sunset's seed onto the map's **landmarks** (a church spire, a mast, the lighthouse, a mill, a
butte, a water tank): a bird of one of 23 species (the starling, everyone's first, is never dealt) circling its perch with a
little grey flock of its own, under a pillar of light in its rarity's colour. **Common** 62% (12 birds with it), **rare** 30%
(24), **legendary** 8% (48). The first lead bird to pass within 7 u of it (from 7 u under to 14 u over) catches it: the flock
joins, the species goes into that player's Aviary, the birds slow for a beat, and its name rises as a callout. The light, and an
edge pointer in its colour (with a star) to the nearest one off screen, say where; another player, or a rival passing by, can get there first.

### Tricks and song

**Song** is the game's points: what a sunset adds to your level. It never decides who wins (the flock at sundown does); it pays
for playing well. The page reads the sky's events about its own flock (the same on the host and on a mirror) and calls each trick
out over the flock with a note:

| Trick | When | Song |
|---|---|---|
| Gather / steal | each bird joined / taken | 1 / 2 |
| **Chorus** ×k | gathers (each a separate swoop, 0.6 s apart) in a row, each within 2.6 s of the last | 8 × (k − 1) for the k-th, pips under your number |
| **Tailwind** | a Chorus of five | 4 s at boost speed for free: no stamina, no shedding |
| **Tail cut** | 12 birds in one pass from a bigger flock | 50 |
| **Scatter** | taking a flock's last bird | 80 |
| **Dodged** / **Close call** | the hawk misses you / takes 3 or fewer | 60 / 20 |
| **Scavenge** | 5+ birds at once from a loose cloud | 20 + the birds |
| **Thermal** / **Slingshot** | a ride of 1 s+ / boosting out of one at once | 10 / 30 |
| **Rare bird** | catching one | 60 / 140 / 400 by rarity |

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
- The world is a 640 × 640 u square; flight is kept inside a circle of radius 290 u around the town: from 255 u out the bird is
  turned gently home and a sea mist thickens. No walls.
- **The places turn:** the shared sky flies each sunset in the next place at dawn: Saltmere Harbour, Redrock Canyon, Stormfield
  (with its storm front), Lantern City, and round again. Everyone in the room is in the same place; a page that arrives mid-way
  builds that one.

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
screen offers it **only while you're alone in the room**. While you're on a Migration you're
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

### The Daily Sunset

One sunset a day that is the same for everyone: the day picks the place (in the rotation's order), its seed (the same perches,
wheels, rare birds and spawns), 5-7 rivals, Normal or Hard, and how often the hawk comes (every 22, 28 or 34 s). It runs on your
page like a Migration place (alone in the room only; from Today or the night screen), as often as you like; your best flock at
sundown that day goes on the day's board (`ow.data` list `daily`: your best, pushed when it improves) and the first try of the day
adds to "N flew it today" (`ow.data` counter `daily-flown`, reset daily). Its result shows your place, the day's board (top 5),
the tally and **Again** / **Back to the sky**. It also counts for the day's goals, the week's "Fly the Daily Sunset on
N days" and the `daily-sunset` badge.

**How long solo lasts:** endless sunsets in the sky turning through four places (personal best, leaderboards, three rival
skills), Migration's 12 feathers, a new Daily Sunset every day, and the long climb: 40 levels, 24 species, 8 trails, 7 flairs,
16 badges.

## Multiplayer

**A public drop-in sky**, `onceworlds.rooms.join({ maxPlayers: 12 })`, called as the page loads. No lobby, no ready-up: one sunset
flows into the next with the night as a visible intermission (the platform guide's nonstop drop-in arena). Friends get private servers
and invites from the platform; the game shows no server menus. The title's Fly puts you in the sky.

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

Three time scales, all paid in **song**:

- **This sunset** (short): the flock at sundown, Chorus pips, trick callouts, a rare bird to chase, the sun clock.
- **Today and this week** (mid): three daily goals and three weekly goals (below), the streak, the Daily Sunset's board.
- **Always** (long): the level (1-40), the Aviary (24 species), trails and flair, badges, Migration's feathers, personal bests.

**The night's tally.** Every sunset ends in a tally, line by line as it counts up: Flock at sundown (1 song a bird), First /
Second / Third (150 / 90 / 50 with 3+ flocks), Gathers, steals and tricks, each rare bird caught (60 / 140 / 400), daily goals
done (150 each), weekly goals done (500 each), First sunset today (100), and the streak (`N days running`, 25 a day up to 200).
Then the level bar fills; a new level rings, and what it opens shows with a **Use** sign that puts it on at once.

**Levels:** 1 to 40; level L to L+1 takes 300 + 90(L−1) + 5(L−1)² song (level 10 at about 7,000 song in all, 20 at 31,600,
40 at 173,500). A first sunset pays 300-800; a strong one 2,500-4,500. About half an hour to level 10; 40 takes many evenings.

**The Aviary** (B, or from the title or the night): every species as a portrait drawn with the game's own bird (24: 10 common,
9 rare, 5 legendary), caught ones in colour with how many times, the rest as dark shapes named only by rarity. Tap a caught one
and your lead bird *is* that species from then on (its colours, beak, crest, tail and streamers, in play, on the title's wire and
on the board). Tabs for **Trails** (Streamers 1, Petals 2, Sparks 5, Lanterns 8, Comet 12, Rainbow 17, Feathers 24, Aurora 32)
and **Flair** (how the whole flock shines: Plain 1, Shimmer 3, Dusk glow 6, Gilded tips 10, Stardust 14, Night lights 20,
Ember 28), locked ones showing their level.

**Daily goals** (Today, T): three a day from a pool of ten, the same for everyone (seeded by the day), sized to two or three good
sunsets: gather 200-500, steal 40-150, a Chorus of 4-6, cut 1-3 tails, catch 1-2 rare birds, dodge the hawk, finish in the top
three, lead a flock of 150-350, fly 2-3 sunsets, ride 3-5 thermals. They add up over the day's sunsets (the Chorus and the flock
take the best one). Their ticks show on the night screen; the title's Today sign says `1/3`.

**Weekly goals** (Today's middle column): three a week (weeks start Monday), bigger and summed over every sunset: fly 12-20
sunsets, gather 2,500-5,000, steal 500-1,200, catch 4-8 rare birds, top three 5-8 times, cut 8-12 tails, fly the Daily Sunset
on 3-5 days, finish 8-12 daily goals, sing 6-10 Choruses of five.

**Streak:** a day with a sunset flown keeps it going (missing a day starts it over); shown big on Today and paid in the tally.

**Saved** (`ow.save`, key `profile`, v2, checked field by field on load so a bad save can't break a page; written at sundown, at a
result, on an equip and on a badge, never every frame): bests, sunsets flown and won, birds gathered and stolen, Migration
feathers, rival skill, hints seen, song, the Aviary's counts, what's equipped, the streak, the day's goals and Daily Sunset best,
the week's goals.

**Leaderboards:** `biggest-flock` (biggest flock at sundown), `sundowns` (sunsets won), `feathers` (Migration, 0-12), `level`,
`aviary` (species caught), and the Daily Sunset's own board each day.

**Badges** (16):

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
| `full-chorus` | Full Chorus | Sing a Chorus of six |
| `rare-bird` | Rare Bird | Catch a rare bird on its landmark |
| `legendary` | Legendary | Catch a legendary bird |
| `aviary-12` | Full Perch | Twelve species in the Aviary |
| `level-ten` | Level Ten | Reach level 10 |
| `seven-days` | Seven Sunsets | Fly on seven days in a row |
| `daily-sunset` | Daily Sunset | Fly a Daily Sunset |

## Balance and timing

Flight and rule numbers live in `src/sim/config.js`, tricks in `src/sim/tricks.js`, song, levels and goals in
`src/sim/progress.js`; the game and the tests import them.

| Thing | Number |
|---|---|
| Lead bird speed | 14 u/s; boost and Tailwind 24 u/s (0.25 s to reach); thermal exit +30% over 2.5 s; up to 12% slower from 100 to 500 birds |
| Turn rate | 130°/s (95°/s boosting), eased over 0.12 s, up to 30% wider for big flocks; bank up to 55° (drawn) |
| Height band | floor surface + 2.5 u, cruise + 7 (no climbing by hand); a thermal lifts 8 u/s to 48; back to cruise 3 u/s |
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
| Rare birds | 3 a sunset on landmarks; 62 / 30 / 8% common / rare / legendary; 12 / 24 / 48 birds with them; catch within 7 u |
| Tricks | Chorus gap 2.6 s (0.6 s is one gather), Tailwind at 5 for 4 s, Tail cut 12, Scavenge 5; song in the table under Rules |
| Song | tally lines above; level L → L+1: 300 + 90(L−1) + 5(L−1)²; 40 levels |
| Daily Sunset | 5-7 rivals, Normal or Hard, hawk every 22/28/34 s; the place follows the rotation by day |
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
ink text, 56 px tall (48 for small ones), the key shown on them on a keyboard) hanging by two thin strings from a sagging wire
across the screen. Text is at least 16 px everywhere; every screen fits a phone held either way (checked at 390×844 and 844×390).

1. **Title.** From under a telegraph wire looking up into the live sunset: starlings perched dark against the sky, your own
   lead bird among them in its species and flair, the town's roofs and smoke along the foot of the frame (on a short screen the
   camera tilts higher so the wire sits under the signs). "Birds of a Feather" in Bricolage Grotesque ExtraBold, cream with a
   thick ink outline (three lines on a phone held upright). **Fly** (gold, Space) on the wire, then **Today** `1/3` and
   **Aviary**, and the level bar (`Level 8` and how far to 9). Music: the pad, a tine now and then, distant birds.
2. **Takeoff** (1.3 s): the wire birds burst up, the camera swoops up behind and above your lead bird.
3. **Play HUD**:
   - **Top centre: the sun clock.** A short ink horizon line, the sun's disc sinking into it as the sunset runs (its colour the
     sky's sun). In the last 30 s the time appears beneath it (`0:24`), with a soft bell each of the last 10 seconds.
   - **Top right: the board.** Up to 5 rows (3 under the clock on a phone held upright): place, the flock's symbol in its
     colour, name, count, each row on its own thin wire, yours in gold. It starts below whatever the platform reserves.
   - **Over every flock:** its count with its symbol, the name beneath. A rival's number is cream when it's smaller than yours
     (prey) and Ember with a jagged underline when it's bigger (danger). Yours is the biggest, with the **Chorus pips** under it
     (five, lighting as the Chorus climbs, a gold ring while a Tailwind blows).
   - **Your lead bird:** a cream ring under it with the stamina arc in gold (only while not full).
   - **Callouts:** a trick's name and song rise from where it happened (`Chorus ×4  +24`, `Tail cut  +50`, a rare bird's name in
     its rarity's colour), short and big; `+11` rises off your count, `−18` in Ember drops from it.
   - **Edge pointers:** the biggest rival (symbol and count) off screen, the nearest rare bird (a star in its colour), the
     hunting hawk (Ember) when it's after you.
   - **Hints:** centre of the upper third, 2-5 words, cream with an ink outline, fading in and out.
   - The top-left corner (the platform's menu) and the lower corners (stick, Boost) stay empty; layout follows `ow.ui.reserved`.
4. **Sundown and the roost** (the night, 15 s). Your bird flies itself to the great wires and the camera pulls back to them
   against the last light. Flocks land on them in their colours, one wire each, biggest on top; each wire is labelled at its
   head (place, symbol, name, count; hidden on a phone, where the results need the room). At 3 s a fanfare and feathers in the
   winner's colour. Above: why ("Kestrel: biggest flock at sundown, 412"), your place, "New best". Then the **tally** counting up
   line by line with a tick each, the level bar filling (a level-up rings and shows what opened, with **Use**), and the day's
   goals with their ticks beside it. Signs: **Migration** and **Daily Sunset** (only while you're alone in the room),
   **Aviary**, and for the host when rival flocks fly, **Rivals: Easy · Normal · Hard**. "Dawn in 7" counts down; then the dawn
   sweep and the next sunset (in the next place), with no tap needed.
5. **Today** (T). Three columns (stacked on a phone held upright): the streak and the day's three goals; **This week** and its
   three goals; the **Daily Sunset**: today's place, rivals and skill, the storm if it has one, your best, how many flew it, the
   top five. Signs: **Daily Sunset** (gold, alone only) and **Back**.
6. **Aviary** (B). `Aviary 7 of 24`, tabs **Birds**, **Trails**, **Flair**; a grid of tiles (8 across on a wide screen, 3 on a
   phone), the equipped one ringed in gold. **Back** under it, or beside the tabs on a short screen.
7. **Migration route.** The coast seen from high; a dotted path links the four places. Each stop: its name, its goal in a few
   words, its feathers; locked ones dim. Tapping a stop shows its **Fly** sign; **Back to the sky** sits on the same wire.
8. **Migration place intro / Daily Sunset intro** (2 s, over a live flyover): the place's name big and its goal, then play.
9. **Migration result.** The goal line ticked or not; feathers fill one by one with a chime each; the tally. **Next place** (gold)
   or **Again**, and **Back to the sky**. **Daily Sunset result:** your flock and place, "New best", the day's board, the tally,
   **Again** and **Back to the sky**.
10. **Pause** (Migration and the Daily Sunset): "Paused", Resume (gold), Leave.
11. **Room closed.** One message on the wire's sign and one button (see Multiplayer).

## Art direction

**The world:** four places seen from the sky at the golden hour, each a whole town or landscape built from code (no model
files):
- **Saltmere Harbour:** a whitewashed harbour town on a hill above the sea: barrel-tiled terracotta roofs, plastered walls with
  shuttered windows and doors, balconies and flower boxes, chimneys with smoke, a church tower in the square, a fountain, market
  stalls, washing across the lanes, a stone quay with bobbing boats, a lighthouse whose beam turns at dusk, a patchwork of fields
  with hedges and hay bales, telegraph wires everywhere.
- **Redrock Canyon:** a river gorge cut in terraces through red flats with sand banks and cottonwoods; flat-topped mesas on
  cliffs over benches and skirts of fallen boulders, their beds of rock in their own colours (pale sandstone, red, a dark
  ledge-former, orange) followed round every face; buttes with cairns, clusters of hoodoos under cap rocks, low scarps
  wandering the flats, dry washes of pale gravel winding to the rim, sagebrush, junipers and dead snags everywhere, dust
  devils whirling through the afternoon. A ranch (houses, a barn, corrals with cattle, a wind pump turning over its tank, hay),
  a red dirt road to a rail halt (platform, station house, signal, a water tank on legs), and the railway: level across the
  flats through cuttings and over banks, into a stone-portalled tunnel through a mesa at each end, over the gorge on a timber
  trestle. A little steam train (engine, tender, boxcars, a tank car, a caboose) runs it, stops at the halt and puffs steam.
- **Stormfield:** wheat and green fields in rows, farms with plank barns and silos, a windmill with turning sails, lattice
  pylons, and the storm rolling across: a curtain of rain in drifting shafts, a dark shelf cloud over its edge, lightning.
- **Lantern City:** dense rooftops and towers, lit windows and street lamps, flat roofs with parapets and clutter.

The ground is painted once per place onto a canvas (tints, fields with rows, paved streets and squares, soft shade under every
building) at twice the height grid's resolution, smoothed, then finished in the shader: grass, cobbles, paving, strata, shrubs
with their shadows and pebbles scattered by noise, cloud shadows drifting over everything. The whole built world is one Lambert
material whose surfaces (roof tiles, plaster, windows that light at dusk, planks, stone, swaying foliage) are drawn in the shader
from a per-vertex code, merged into a handful of meshes. The sea: depth-tinted (shallows, sand, surf foam on the shore), rippled,
mirroring the sky by Fresnel with a glitter path to the sun. Smoke rises in lumpy, lit plumes that lean with the wind.

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
`ow.settings.quality`: low none, medium 1024, high 2048), a hemisphere light with a cool sky fill over warm ground bounce, sRGB
output, ACES tone mapping with the exposure lifted a little as the light goes, exponential fog in the horizon's colour. The sky
dome is a gradient shader with the sun's disc and a halo, driven by the sunset's time along with the sun's colour, intensity and
angle (kept from dropping too low, so dusk stays readable): gold → ember → rose → dusk, warm to the end (coral and amber, never
magenta), violet only after sundown. Window lights come up in the dusk, a window here and there so a town still reads as a town.
Bloom on medium and high only, then a grade pass: a little more saturation (held back in deep shadow and near white), a gentle
contrast, and a vignette tinted by the sky. **The camera** looks down at 54° from high over a point between the lead bird and its
flock's middle, a little ahead, at 50 + 1.75·√n u (so a bigger flock sees more of the map; 12% further on a phone held upright),
44° field of view (about 48° across on a phone held upright). It turns with the bird's heading slowly, punches in on a big
moment, widens on a boost, and never sinks below the surface. `ow.settings.reducedMotion`: no shake, no flashes, no punches.

**Birds:** a songbird mesh (body, head, beak, two-jointed wings, tail, an optional crest and tail streamers) drawn instanced,
coloured by region (back, belly, head, wing accent, beak); wings flap, bank and fold in the vertex shader from a per-bird phase
and rate, with glides mixed in, so a flock shimmers; a rim of light from the sun. Flock birds take the flock's colour; perched
grey birds are Ash. Birds steer toward their slots in the shape on a fixed 30 Hz step; near flocks also keep apart through a
spatial hash. **Lead birds** are drawn at 7× a flock bird, in their player's chosen **species** (its colours and shape), with its
**flair** (the whole flock's shine: a shimmer, a dusk glow, gilded tips, stardust, night lights, embers) and its **trail**
(streamers, petals, sparks, lanterns, a comet, a rainbow, feathers, an aurora). **The hawk** is a raptor mesh, dark against
the sky with an ember edge, wings folding into the stoop. Feathers are drawn as real feathers (a vane, a shaft, notches) that
spin, flip and drift down.

**Juice:** gathered birds burst up from a perch with a wing-clap and arrive with a colour flash; each Chorus note rises a step
in pitch and lights a pip; your count squashes and stretches on every change; a steal ripples colour through the losing flock
with a rising chirp run; trick callouts pop and rise; a big hit holds the birds still for a frame or two; a rare bird's catch is a
flare of its colour and a slow-motion beat; a big loss shakes the camera (trauma, decaying, squared, smooth); the hawk's strike
slows the birds and bursts feathers; a Tailwind streams air past the flock; thermals throw it upward with a whoosh; winning
showers feathers in your colour; the night's tally counts up with ticks and a level-up rings. Particles scale with quality.

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
- **Tricks:** each Chorus note a step up the scale; Tailwind a rushing sweep; Tail cut and Scatter a snap and a chirp run; a rare
  bird a shimmer in its rarity; a goal a chime; the tally a tick per line and a rising run for a level.
- **Music:** a sequencer at 92 BPM in D with a little swing, two composed tunes of eight bars that take turns. Title: a warm pad
  (detuned saws through a lowpass), a tine now and then, distant birds. Gold: + a kalimba-like arpeggio walking the chord and a
  shaker. Ember: + bass. Rose: + the whistled tune (a sine sliding in from the last note, with a breath of vibrato). Dusk: + a
  soft kick. The last 30 s: up a whole tone, four to the floor, the tune an octave up. Night: a music-box lullaby. A gentle
  limiter on the master keeps big gathers from clipping.

## Store art and the trailer

All rendered by the game itself in poster mode (`?poster=<name>`: fixed seed, the moment staged and frozen, no HUD).
- **Cover** (`thumb-1`): two huge murmurations colliding in front of the setting sun over Saltmere's roofs and lighthouse,
  Cobalt against Vermilion, their numbers over them; the name once, big.
- **Action** (`thumb-2`): from above, the hawk stooping into a Jade flock over the rooftops, its birds bursting white.
- **Win** (`thumb-3`): sundown on the great wires: each flock on its wire in its colour, the labels in order, the town's windows lit.
- **The game** (`thumb-4`): the play view as it is: your flock with its trail and lead bird cutting a Vermilion tail over the
  town, a rare bird's flock nearby, the HUD (counts, `Chorus ×4`, `Tail cut`, the pips, the board, the sun clock).
- **Icon:** a Cobalt flock curling behind its lead bird in front of a big sun's disc. No text.
- **Badges** (16): each a bold symbol on a coloured disc (a bird on a wire, a hawk's head, a thermal spiral, feathers, a star
  over a perched bird, a calendar of sunsets...).
- **Trailer** (32 s, 1280×720, real play on autoplay, every shot from the game's own frames and sound), nearly all flight:
  0-3 s your small flock over Saltmere's roofs with the hawk swooping past and "Biggest flock at sundown wins"; 3-6 s gathering
  round the windmill in gold light (`Chorus ×2`); 6-9 s a White Raven caught off the boats (+400); 9-12 s dusk, the hawk's ring
  on your 494 and its strike; 12-21 s a flock over each place: Redrock's gorge, Stormfield's fields under the hawk's ring,
  Lantern City's towers; 21-28 s the last seconds (`Slingshot`, cutting a rival's tail), sundown and the swoop to the wires;
  28-29 s the tally in a glance (biggest flock, a level and its unlocks); 29-32 s the name over the wires at a pink dawn. The
  music is the game's own score, the effects each shot's own.

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
- **Altitude confusing:** there is no altitude to steer: the bird holds cruise over whatever is under it and thermals lift it;
  flocks within a few units of height always meet (vertical distance counts 0.75×); you can't crash.
- **Nothing to come back for:** levels, the Aviary, trails and flair, daily and weekly goals, the streak and the Daily Sunset's
  board (Progression); every sunset pays something toward them, win or lose.
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

- `src/sim/` (pure, no `window`, three.js or SDK; node tests import them): `config.js` (flight and rule numbers), `rng.js` (seeded),
  `maps.js` (the four places: terrain heights, buildings, wires, perch slots, thermals, wheels' loops, spawns, from a seed),
  `flight.js` (a leader's flight: turning, the height band, boost, stamina, thermals, the boundary), `flock.js` (paths, the
  8-puff shape, local counts), `rivals.js` (the bots' thinking), `sky.js` (one whole sky: flight at a fixed 30 Hz, the rules
  (gathering, stealing, shedding, the hawk, the storm, the clock, spawns) at 10 Hz, giving events), `migration.js` (places,
  goals, feathers), `wire.js` (state shapes, checks, the perch bitset), `species.js` (the 24 birds), `tricks.js` (tricks and
  their song from the sky's events), `progress.js` (the profile and its checks, levels, trails and flair, the tally, daily and
  weekly goals, the streak, the Daily Sunset's spec). The own bird flies at a fixed 60 Hz on its page.
- `src/net.js` (the room: presence, host state, events, host change, a stub room off the platform), `src/render/` (`view.js`
  sky, light, bloom and the grade; `look.js` the sunset's colours; `world.js` a place; `ground.js` the painted ground and its
  shader; `town.js` buildings, the quay and the trestle; `worldmat.js` the one world material; `nature.js` trees; `props.js`;
  `birdmesh.js` the songbird and the raptor; `birds.js` every bird; `portraits.js` the Aviary's pictures; `fx.js` trails,
  rare-bird lights, the hawk's flight, rings, feathers, the storm), `src/hud.js` (a 2D canvas over the 3D one),
  `src/screens.js` (title, night and tally, Today, the Aviary, Migration, results, the signs), `src/audio.js`, `src/poster.js`,
  `src/autoplay.js` (`?autoplay=1`, only on a local address: a Hunter flies your bird, for the trailer), `src/main.js`.
- `test/*.test.mjs` under `node --test`.
