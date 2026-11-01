# Birds of a Feather

Lead a murmuration across the sunset. Gather the grey birds, cut through smaller flocks to steal theirs, catch the rare birds
circling the landmarks, and be the biggest flock when the sun goes down. Up to 12 players in one sky, with rival flocks filling
it, turning through four places: a harbour town, a red canyon, stormy farmland and a city of lanterns.

Every sunset pays song toward 40 levels that open trails and flair for your flock; rare birds fill a 24-species Aviary and can
lead your flock; there are three daily goals, three weekly goals, a streak, and one Daily Sunset a day with its own board.

Point where to fly (mouse, WASD or the stick) and hold to boost.

Play: https://onceworlds.com/play/birds-of-a-feather

## Run it

```sh
npm install
npm test        # the rules, rival flocks, places, tricks, progress and the room flow, in Node
npm run build   # into dist/
```

The rules are plain modules in `src/sim/` (no browser needed); `DESIGN.md` has every rule and number.

## License

MIT. The fonts (Bricolage Grotesque, Big Shoulders Display) are under the SIL Open Font License, in `public/fonts`.
