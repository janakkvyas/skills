# Tripo AI se apne 3D models lagana

The game is complete without any art files: every object is a built-in
placeholder model. Each one is a named **slot**, and a `.glb` from Tripo AI
replaces it without touching code.

For the reference images themselves (links, licences, what was and was not
found) and the sources behind the Tripo settings below, see
[REFERENCE_PACK.md](REFERENCE_PACK.md).

## How to put a model in

1. Generate the model in Tripo and export it as **GLB** (triangles, textures
   included, compression off).
2. Copy the file into `public/models/`, e.g. `public/models/kadhai.glb`.
3. List it in `public/models/manifest.json`:

   ```json
   {
     "kadhai": "kadhai.glb",
     "shreenathji": { "file": "shreenathji.glb", "rotateY": 180, "scale": 1.05 },
     "vaishnav:dada": "dadaji.glb",
     "textures": { "pichwai": "pichwai.jpg" }
   }
   ```

4. `npm run dev` to look at it in a browser, then rebuild the APK (see the README).

The model is scaled and centred to fill the same space as the placeholder it
replaces, standing on its base. If it comes out facing the wrong way or a bit
off, adjust it in the manifest:

| Option | Meaning |
|---|---|
| `rotateY` | Turn it, in degrees. Try `180` if it faces away, `90` / `-90` if sideways. |
| `scale` | Multiplier on top of the automatic fit, e.g. `1.1`. |
| `lift` | Raise (or lower, if negative) in metres, e.g. `0.02`. |
| `fit` | `"contain"` (fit inside the placeholder's box), `"height"` or `"width"`. The default depends on the slot – see below. |

## What to make first

The placeholders are good enough to play with, so do these in order of how
much they add:

1. **`shreenathji`** – the one that matters most to your family. Use your own
   chitraji or a photo of your sevya swaroop: straight-on, whole figure, even
   light, no glass reflection. The Nathdwara swaroop is a bas-relief, so a
   flat-backed model is true to the original.
2. **`tokri`** – it holds every jalebi and is what is offered, so it is on
   screen from the kitchen to the pangat.
3. **`vaishnav:dada`, `vaishnav:ben`, `vaishnav:bal`, `vaishnav:bhai`** – the
   four diners. Generate each one already **seated cross-legged**; no rigging
   needed. A Tripo model sits still and does a happy little hop when served or
   eating (the built-in figures also fold their hands and lift food to the mouth).
4. **`kadhai`, `pot`, `chulha`** – the cooking set, on screen for half the game.
5. **`pakhawaj`, `jhanjh`, `ghanti`** – the kirtan instruments.
6. Everything else, as you like.

## All slots

Sizes are the placeholder's, in metres – what your model is fitted to. "Front"
is the side that should face the child.

| Slot | What it is | Size (w × h) | Notes for generating |
|---|---|---|---|
| `shreenathji` | The swaroop on its pithika | 1.5 × 2.2 | Front-facing. A soft glow behind the head is added by the game. |
| `sinhasan` | Throne base with gadi and bolsters | 2.3 × 0.5 | Empty; the swaroop stands on it. Low and wide. |
| `vaishnav:dada` | Grandfather, dhoti-kurta | 0.95 × 1.2 | Seated cross-legged, facing front. |
| `vaishnav:ben` | Woman in saree | 0.9 × 1.2 | Same. |
| `vaishnav:bal` | Child | 0.65 × 0.9 | Same. |
| `vaishnav:bhai` | Man in kurta | 0.95 × 1.2 | Same. `vaishnav` alone replaces all four with one model. |
| `kadhai` | Iron kadhai with two ring handles | 1.7 × 0.36 | **Empty.** The game adds the ghee and the jalebis. |
| `pot` | Brass pateela for chaasni | 1.15 × 0.45 | **Empty, no lid.** The game adds the syrup. |
| `chulha` | Clay stove, fire mouth at the front | 1.5 × 0.36 | No pot on it, no fire. The game adds flames. |
| `bowl` | Big steel mixing bowl | 1.1 × 0.32 | Empty. |
| `katori` | Small brass bowl | 0.34 × 0.13 | Empty. One model is reused for maida, dahi, sugar and kesar; the game puts the contents in. (`katori:kesar` etc. replace just one.) |
| `lota` | Brass water pot | 0.46 × 0.4 | Empty, open top. |
| `thali` | Small brass plate (holds the elaichi) | 0.6 × 0.03 | |
| `elaichi` | One green cardamom pod | 0.15 × 0.09 | A single pod. |
| `spoon` | Wooden stirring ladle | — | Tricky to fit (it is tilted); safest left as it is. |
| `pipingBag` | Cloth cone for the batter, nozzle down | 0.25 × 0.48 | Nozzle at the bottom. |
| `paatal` | Stitched leaf plate | 0.9 × 0.04 | Best left as it is: it is flat, and a picture does the job. |
| `tokri` | Shallow round cane basket | 1.0 × 0.23 | **Empty.** The game heaps the jalebis in it. |
| `chowki` | Low offering stool (bajot) with red cloth | 1.05 × 0.23 | Flat top. |
| `jhari` | Spouted water vessel with its red cloth (nevro) | 0.33 × 0.31 | Photograph your own jhariji on a plain cloth. |
| `tulsi` | Tulsi dal (two leaves on a stem) | 0.17 × 0.02 | Tiny; the placeholder is fine. |
| `diya` | Standing brass lamp | 0.22 × 0.61 | The placeholder's flame flickers; a model's will not. |
| `pakhawaj` | Barrel drum lying on its side | 0.71 × 0.52 | Lying horizontally. |
| `jhanjh` | Pair of brass cymbals with a cord | 0.5 × 0.12 | Lying flat. |
| `ghanti` | Brass hand bell | 0.24 × 0.38 | Standing on its mouth. |
| `ghanta` | Large hanging temple bell | 0.4 × 0.84 | Hook at the top; it swings from there. |

How a model is sized: vessels (kadhai, pot, bowl, katori, lota, chulha, tokri,
thali) are matched to the placeholder's **width**, so the ghee or syrup the
game pours in still meets the rim; the swaroop and the diners are matched by
**height**; everything else is fitted inside the placeholder's box. Override
with `fit` if you need to.

Not slots, by design:

- **Jalebi.** Each jalebi pipes itself in as a spiral, which a model cannot
  do, so it stays built in code.
- **Parda, arch, walls, floors.** These move or tile, so they are made in code.
- **Pichwai.** A flat picture. Put your own photo in `public/models/` and name
  it under `"textures": { "pichwai": "…" }`. The built-in one is a painted
  lotus cloth. Several public-domain Nathdwara pichwai are linked in the
  reference pack.

## Tripo settings that suit a phone

These are starting points, not Tripo's own figures; the reasoning and sources
are in the reference pack, section 2.

| | Small props | Medium props | Shreenathji, sinhasan | Diners |
|---|---|---|---|---|
| Examples | katori, elaichi, jhanjh, ghanti | kadhai, pot, chulha, tokri, lota, jhari, pakhawaj, chowki | | four on screen together |
| Mesh | Smart Mesh / clean topology, **triangles** | same | same | same |
| Face limit | 500 – 2,000 | 2,000 – 5,000 | 8,000 – 15,000 | 4,000 – 8,000 each |
| Texture | 512 – 1024 px | 1024 px | 2048 px | 1024 px |
| PBR | on for brass | on for metal, off for clay and cane | on | off |

- **Format GLB, triangles.** Choosing quads makes Tripo export FBX, which the
  game cannot load.
- **Leave compression off.** A meshopt- or Draco-compressed GLB will not load
  until a decoder is added to the game (easy to add – just ask).
- **Pivot at the bottom centre** if Tripo offers it. The game re-centres the
  model anyway.
- Keep the whole set under roughly 25 MB so the APK stays quick to install.

## A good input picture

One object, all of it in frame, filling most of the picture; plain white or
grey background; front or slight three-quarter view; soft even light. Remove a
busy background before uploading. For the chulha and the pakhawaj, which look
different from each side, use Tripo's multi-view with 2–4 photos.

To keep everything looking like one family of toys, end every text prompt the
same way, for example: *"…, stylized cartoon, chunky toy-like proportions,
flat bright colours, single object"*.

## Prompts for things with no good photo

No usable free photo was found for these; a text prompt (or your own photo) is
the way.

| Slot | Prompt |
|---|---|
| `chowki` | A low Indian wooden bajot offering stool, four short turned legs, red lacquer top with a gold painted border, chunky stylized toy-like proportions, flat bright colours, single object |
| `sinhasan` | A low wide Indian temple deity throne base, carved wood with gold paint, white cushion with a red border on top, two red velvet bolsters at the sides, no canopy, empty, stylized cartoon, single object |
| `jhari` | A small brass Indian water pot with a round belly, narrow neck and a curved side spout, wrapped in a bright red cloth cover tied at the neck, stylized cartoon, single object |
| `vaishnav:dada` | A friendly elderly Gujarati grandfather sitting cross-legged on the floor, white dhoti and cream kurta, small white moustache, red tilak on forehead, tulsi bead necklace, hands resting on knees, cute stylized cartoon toddler-game character, big head, simple shapes |
| `vaishnav:ben` | A smiling Indian woman sitting cross-legged on the floor in a bright pink saree with the pallu over her head, bindi, tulsi bead necklace, hands on knees, cute stylized cartoon character, big head, simple shapes |
| `vaishnav:bhai` | A cheerful Indian man sitting cross-legged on the floor in an orange kurta and white dhoti, red tilak on forehead, tulsi bead necklace, cute stylized cartoon character, big head, simple shapes |
| `vaishnav:bal` | A happy Indian child sitting cross-legged on the floor in a yellow kurta, red tilak on forehead, cute stylized cartoon character, big head, simple shapes |

Negative prompt for all: *photorealistic, multiple objects, background, floor
plane, text, thin loose strands*.
