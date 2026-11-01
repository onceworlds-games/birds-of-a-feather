# Birds of a Feather

Lead a murmuration across the sunset over a harbour town. Gather the grey birds, fly through smaller flocks to steal theirs,
and be the biggest flock when the sun goes down. Up to 12 players in one sky, with rival flocks filling it.

Play: https://onceworlds.com/play/birds-of-a-feather

## Run it

```sh
npm install
npm test        # the rules, rival flocks, places and the room flow, in Node
npm run build   # into dist/
```

The rules are plain modules in `src/sim/` (no browser needed); `DESIGN.md` has every rule and number.

## License

MIT. The fonts (Bricolage Grotesque, Big Shoulders Display) are under the SIL Open Font License, in `public/fonts`.
