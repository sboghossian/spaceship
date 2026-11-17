# Post Pilot

A fork of [Spaceship IDE](https://github.com/chuanqisun/spaceship) by Chuanqi Sun, pointed at LinkedIn posts instead of short stories and restyled in a light cream, slate and gold palette.

All of the interaction design and engineering is Chuanqi Sun's: the focus monitor, attention lock, future vector steering and realtime re-generation. Read the original README for the ideas behind it, and watch the demos on [Instagram](https://www.instagram.com/reels/DfyQPhFtW-z/) and [YouTube](https://www.youtube.com/watch?v=3WmNLWUmcnY).

## What this fork changes

- **Skin**: the colour tokens in `index.html` (cream page, slate ink, gold for anything changing), the page title and the wording of the key dialog. Layout, type and motion are untouched.
- **Content**: the prompts in `src/story/` and `src/text/live-*.ts` continue a LinkedIn post, not a story. They ask for first person, plain text, and no invented statistics, names or quotes.
- **Knobs**: the steering axes are tone, angle, density, proof, audience, formality, candor, close and surprise.
- **Simulator**: the placeholder word bank and axes are post-flavoured, so the change shows without API keys.

## Status

- Simulator mode builds and runs.
- Live mode (Cerebras and Gemini, your own keys, kept in browser local storage) has not been tested with the new prompts. Use it at your own risk.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints, under `/spaceship/`.

## Credit and licence

MIT, copyright Chuanqi Sun; see [LICENSE](./LICENSE). If you build on the work, cite the original:

```bibtex
@misc{sun2026spaceship,
  author       = {Sun, Chuanqi},
  title        = {Spaceship {IDE}: Steer Your Ideas in Realtime, Space Pilot Style},
  year         = {2026},
  publisher    = {GitHub},
  howpublished = {\url{https://github.com/chuanqisun/spaceship}},
  note         = {Demo: \url{https://chuanqisun.github.io/spaceship/}}
}
```
