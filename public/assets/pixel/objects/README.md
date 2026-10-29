# Generated object sprites

Trees, plants, the koi pond and most furniture were generated for Open Office with the user's
PixelLab account (Pro Flash, 2026-10-28) from text descriptions, using the
measured reference objects only as style guidance. They are original files
rendered at the exact canvas size of the reference object so they sit on the
same footprint and anchor. Furniture, walls and floors are drawn in code in
`src/sprites/`. No Gather asset is included in the project.

Naming: `<kind>.png` for single variants, `<kind>-<color>.png` or
`<kind>-<color>-<facing>.png` for colour and orientation variants; the map in
`src/sprites/furnitureAssets.ts` and `src/sprites/assets.ts` resolves them.
