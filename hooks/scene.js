// Christmas Eve drawn as a glyph mosaic: every pixel is a small square tile with a
// character stamped in it, over a dotted grid, with blocky drop shadows.
// Pure vector. All motion is SMIL (<animate>, <animateTransform>) set to repeat
// indefinitely; nothing runs as script.
//
// Two layers so it fits any window:
//   - the sky fills the window (slice), and
//   - the picture (moon, house, trees, sleigh, snow) always fits whole (meet),
//     anchored to the bottom, with snow, grid and ground running past its edges.

// Local change: each tile's glyph is drawn as a path (its Menlo Bold outline) instead of
// <text>. ~1,200 text glyphs made the scene too costly for the desktop app's moving-
// backdrop budget, so the app froze it. See tools/glyph-paths.py.
import { GLYPH_PATHS } from './glyph-paths.js'

const T = 10 // tile pitch
const S = 9 // tile size

// ---------- Zoom (local change; everything else is the original) ----------
//
// ZOOM_OUT shrinks the picture layer (moon, house, trees, sleigh, snow).
//   1   = the original framing
//   1.3 = the picture drawn at 1/1.3 ≈ 77% of its original size
// Chosen by eye as "a bit"; raise it to zoom out further. The star-filled sky
// layer behind the picture is not zoomed.
const ZOOM_OUT = 1.3

// The picture's own box in SVG units: 160 x 100 tiles at pitch T.
const PIC_W = 1600
const PIC_H = 1000

// Zooming out = a viewBox ZOOM_OUT times larger, grown about the picture's
// bottom centre, so the ground stays at the foot of the window and the extra
// room goes to both sides equally and to the sky above.
const VIEW_W = PIC_W * ZOOM_OUT
const VIEW_H = PIC_H * ZOOM_OUT
const VIEW_X = (PIC_W - VIEW_W) / 2 // negative: equal margin left and right
const VIEW_Y = PIC_H - VIEW_H // negative: all the extra height goes above

// key: [tile fill, glyph ink]
const PALETTE = {
  w: ['#f2f6ff', '#b4c4de'], // snow
  l: ['#c4d4ee', '#8ea4c8'], // snow in shade
  r: ['#e2485c', '#9e2236'], // red
  n: ['#b02f45', '#721729'], // roof crimson
  y: ['#f4d36a', '#b08f2a'], // gold
  o: ['#f0a64a', '#b06a1e'], // window frame glow
  m: ['#c98a5a', '#8c5832'], // walls
  c: ['#a24a3c', '#6a2a20'], // chimney brick
  g: ['#4caf6e', '#24703f'], // green
  d: ['#2d7a4a', '#164a2a'], // deep green
  b: ['#a86b3c', '#6a3f1c'], // reindeer
  k: ['#5e3a1c', '#2f1c0a'], // antler, eye
  s: ['#f2c6a4', '#b8865e'], // skin
  z: ['#ff3d3d', '#a81414'], // red nose
  q: ['#fff1c2', '#d2bd78'], // moon
  h: ['#ecd394', '#b39a55'], // moon crater
  t: ['#7a4a2a', '#46280f'], // trunk
  f: ['#ffffff', '#c9d6ec'], // snowflake
  v: ['#03050c', '#1b2547'], // black hole interior (local addition)
}
const GLYPHS = ['$', 't', '%', 'X']
const FLAKE_GLYPHS = ['*', '+', ':', '*']

const SYMBOLS = Object.entries(PALETTE)
  .map(([key, [fill, ink]]) =>
    (key === 'f' ? FLAKE_GLYPHS : GLYPHS)
      .map(
        (g, i) =>
          `<g id="${key}${i}"><rect width="${S}" height="${S}" rx="1" fill="${fill}" stroke="${ink}" stroke-width="0.8"/><path d="${GLYPH_PATHS[g]}" fill="${ink}"/></g>`,
      )
      .join(''),
  )
  .join('')

const BULB = { r: '#ff4d5e', y: '#ffd84a', g: '#53e08a', u: '#5ab4ff', p: '#ff8ad0' }
const BULB_SYMBOLS = Object.entries(BULB)
  .map(
    ([k, c]) =>
      `<g id="L${k}"><rect width="6" height="6" rx="1.5" fill="${c}"/><rect x="1" y="1" width="2" height="2" fill="#ffffff" opacity="0.75"/></g>`,
  )
  .join('')

// ---------- SMIL helpers: every animation repeats forever ----------

// Opacity that holds each value in turn (pixel-style on/off).
const blink = (values, dur, begin = 0) =>
  `<animate attributeName="opacity" values="${values}" dur="${dur}s" begin="${begin}s" calcMode="discrete" repeatCount="indefinite"/>`
// Opacity that eases between values.
const fade = (values, dur, begin = 0) =>
  `<animate attributeName="opacity" values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`
// A translation along a list of points.
const move = (values, dur, begin = 0, discrete = false) =>
  `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" begin="${begin}s"${discrete ? ' calcMode="discrete"' : ''} repeatCount="indefinite"/>`
// Local additions. Same attribute order as the helpers above (dur, then begin), which
// sceneAt() relies on to phase-lock every animation to the clock.
// A full turn about (cx, cy).
const spin = (cx, cy, dur, begin = 0) =>
  `<animateTransform attributeName="transform" type="rotate" values="0 ${cx} ${cy};360 ${cx} ${cy}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`
// Any other attribute eased between values (used for a ripple's radius).
const tween = (attribute, values, dur, begin = 0) =>
  `<animate attributeName="${attribute}" values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`

// ---------- Tiles as pattern-filled cells (local change, performance) ----------
//
// The original drew every tile as its own <use> (~1,200 in all). When anything in the
// scene moves, the browser redraws the whole picture each frame, and that many separate
// tiles put the scene over the desktop app's per-frame cost budget for moving backdrops,
// so the app froze it after 3 s (reproduced with the app's own player code).
//
// Here the tiles that share a symbol (palette key + glyph variant, e.g. "n2") become
// ONE path made of their cells, filled with a pattern holding that symbol (PATTERNS
// below). Same pixels, about a hundred paths instead of ~1,200 tiles.
//
// Cell geometry: a tile at (X, Y) is a 9 x 9 rect with a 0.8-wide stroke, so it covers
// X-0.4 .. X+9.4. Its cell is X-0.5 .. X+9.5: exactly one tile pitch T wide, so cells
// of neighbouring tiles meet edge to edge and each cell holds its whole tile.
const CELL_INSET = 0.5 // how far a cell starts before its tile, user units

// cells: array of [symbol id, X, Y], X/Y the tile's top-left in user units.
// Returns one pattern-filled <path> per symbol id.
function patternPaths(cells) {
  const paths = new Map() // symbol id -> { d: its path data, x, y: where its last cell starts }
  for (const [id, X, Y] of cells) {
    const x = X - CELL_INSET
    const y = Y - CELL_INSET
    const path = paths.get(id)
    // The first cell of each path moves absolutely (M). Each later one moves relative (m)
    // to where the previous cell started, since 'z' returns the pen there: the same
    // shapes as absolute moves, written with much shorter numbers (the scene must stay
    // under the app's 131,072-character limit).
    const moveTo = path === undefined ? `M${x} ${y}` : `m${x - path.x} ${y - path.y}`
    const d = (path === undefined ? '' : path.d) + `${moveTo}h${T}v${T}h${-T}z`
    paths.set(id, { d, x, y })
  }
  let out = ''
  for (const [id, { d }] of paths) out += `<path d="${d}" fill="url(#p${id})"/>`
  return out
}

// One pattern per tile symbol: the symbol drawn once in a T x T cell. The pattern grid
// starts CELL_INSET before the tile grid, and the symbol sits CELL_INSET inside it, so
// the symbol lands exactly where a <use x=X y=Y> of it would.
//
// Sharpness: the browser renders each pattern's tile at the on-screen size and repeats it,
// which softens glyphs slightly. At Retina resolution that differs from tile-by-tile
// drawing in under 1% of pixels (mean 0.2/255). Declaring the pattern larger and scaling
// it back (patternTransform) was tested and changes nothing.
const PATTERNS = Object.keys(PALETTE)
  .flatMap(key => [0, 1, 2, 3].map(i => `${key}${i}`))
  .map(
    id =>
      `<pattern id="p${id}" x="${-CELL_INSET}" y="${-CELL_INSET}" width="${T}" height="${T}" patternUnits="userSpaceOnUse"><use href="#${id}" x="${CELL_INSET}" y="${CELL_INSET}"/></pattern>`,
  )
  .join('')

// Lay a pixel map out as tiles. Each map character is a palette key; '.' is empty.
//
// crisp = false: pattern-filled cells (cheap; the browser resamples each pattern tile,
//                so glyphs come out slightly soft).
// crisp = true:  one <use> per tile, the original method (sharp, but each tile costs a
//                separate draw every frame). Used only for the sprites the eye goes to,
//                see CRISP below, so the scene stays well inside the app's cost budget.
function tiles(rows, ox = 0, oy = 0, salt = 0, crisp = false) {
  const cells = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (!(c in PALETTE)) continue
      const v = (x * 7 + y * 13 + salt) % 4
      cells.push([`${c}${v}`, (ox + x) * T, (oy + y) * T])
    }
  })
  if (!crisp) return patternPaths(cells)
  return cells.map(([id, X, Y]) => `<use href="#${id}" x="${X}" y="${Y}"/>`).join('')
}

// Which sprites are drawn crisp (per-tile) instead of as patterns. Every crisp tile adds
// per-frame cost.
// Measured in the app's own player (1440x900): all patterns 3.0-3.5 ms; team + moon crisp
// 6.8 ms; + trees 5.3-8.3 ms; everything crisp 7.8 ms. The limit is 5.56 ms, so all off.
const CRISP = { team: false, moon: false, tree: false, house: false }

// A sprite's blocky drop shadow as one plain path: each row's run of tiles
// becomes one rectangle. No filter, so it costs nothing to redraw.
function shadowPath(rows, ox = 0, oy = 0) {
  let d = ''
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!(row[x] in PALETTE)) {
        x++
        continue
      }
      let e = x
      while (e < row.length && row[e] in PALETTE) e++
      const w = (e - x) * T - 1
      d += `M${(ox + x) * T} ${(oy + y) * T}h${w}v${S}h${-w}z`
      x = e
    }
  })
  return d
}
const SHADOW = (d) => `<path d="${d}" fill="#040a1e" fill-opacity="0.6"/>`

// ---------- Pixel maps ----------

const MOON = [
  '...qqqqq...',
  '..qqqqqqq..',
  '.qqqhqqqqq.',
  'qqqhhqqqqqq',
  'qqqqqqqqhqq',
  'qqqqqqqqqqq',
  'qhqqqqqqqqq',
  'qqqqqqhhqqq',
  '.qqqqqhqqq.',
  '..qqqqqqq..',
  '...qqqqq...',
]

const TREE = [
  '......y......',
  '.....yyy.....',
  '......y......',
  '......g......',
  '.....wgd.....',
  '....gggdd....',
  '...wgrggdd...',
  '.....ggd.....',
  '....wgggd....',
  '...gggyggd...',
  '..wggggggdd..',
  '....gggdd....',
  '...wgggrgd...',
  '..gggggggdd..',
  '.wggyggggrdd.',
  'gggggggggggdd',
  '.....ttt.....',
  '.....ttt.....',
]

const HOUSE = [
  '...............ww',
  '...............cc',
  '..........w....cc',
  '.........www...cc',
  '........wwnww..cc',
  '.......wwnnnww.cc',
  '......wwnnnnnwwcc',
  '.....ww' + 'n'.repeat(7) + 'ww',
  '....ww' + 'n'.repeat(9) + 'ww',
  '...ww' + 'n'.repeat(11) + 'ww',
  '..ww' + 'n'.repeat(13) + 'ww',
  '.' + 'w'.repeat(19),
  '..' + 'm'.repeat(17),
  '..' + 'm'.repeat(17),
  '..mmooommmmmmmooomm',
  '..mmoyommrrrmmoyomm',
  '..mmooommrgrmmooomm',
  '..mmmmmmmrrrmmmmmmm',
  '..mmmmmmmrrymmmmmmm',
  '..mmmmmmmrrrmmmmmmm',
  'w'.repeat(21),
]

const SLEIGH = [
  '...........rw......',
  '..........rrr......',
  '.........wwww......',
  '....gg....sss......',
  '...gggg...www.....n',
  '...gggg..rrrrr....n',
  'nyyyyyyyyyyyyyyyy.n',
  'nnrrrrrrrrrrrrrrrnn',
  '.nrrrrrryrrrrrrrrn.',
  '..nnnnnnnnnnnnnnn..',
  '..y....y.....y..y..',
  '.yyyyyyyyyyyyyyyyyy',
]

const DEER = [
  '.....k.k..',
  '......kk..',
  '......bkb.',
  '......bbbk',
  'wbbbbbbbb.',
  '.bbbbbbbb.',
  '.bbbbbbb..',
]
const LEGS_A = ['.b.b..b.b.', 'b..b.b..b.']
const LEGS_B = ['..bb...bb.', '..bb...bb.']

// ---------- Placement, in tiles, on a 160 x 100 tile picture ----------

const GROUND = 90 // row the ground sits on
const HX = 118, HY = GROUND - 20 // house
const MX = 136, MY = 6 // moon
// Local addition: one more tree at each far edge (tile columns -14 and 160), seen on
// wider windows. Each entry gets its shadow, snow base and level ground automatically.
const TREES = [[-14, GROUND - 17], [6, GROUND - 17], [141, GROUND - 17], [160, GROUND - 17]]

// ---------- Things on the ground (local additions) ----------
// Each prop stands on the ground: its bottom row sits just above row GROUND.
const SNOWMAN = [
  '...vvv...', // top hat (black-hole black)
  '...vvv...',
  '..vvvvv..', // brim
  '..wwwww..',
  '..wvwvw..', // coal eyes
  '..wwoww..', // carrot nose
  '..rrrrr..', // scarf
  '.rwwwwww.',
  't.wwvww.t', // twig arms, coal button
  '.twwwwwt.',
  '..wwvww..',
  '.wwwwwww.',
  '.wwwvwww.',
  '..wwwww..',
]
const PRESENTS = [
  '.y...r.', // bows
  'ryr.lrl', // a red box with gold ribbon, a pale-blue box with red ribbon
  'ryr.lrl',
]
const LAMP = [
  '.yyy.', // lamp head
  '.yqy.',
  '.kkk.',
  '..k..', // post
  '..k..',
  '..k..',
  '..k..',
  '..k..',
  '..k..',
  '.kkk.', // foot
]
const LAMP_X = 108 // the lamp's left tile column, just left of the house; its glow uses it too
// [pixel map, left tile column, salt for glyph variety]
const PROPS = [[PRESENTS, 19, 1], [SNOWMAN, 27, 2], [LAMP, LAMP_X, 3]]

// A spotted doe by the right-hand trees, facing the house. She grazes, head down in the
// snow, and every DOE_CYCLE seconds lifts her head to look around for a quarter of it.
// The two poses share the same body rows and legs, so swapping them only moves the
// head and neck. One swap every few seconds is far below the app's flash threshold.
// Necks are short and thick and grow out of the chest (a one-tile-wide neck read as a
// stalk). Grazing, the neck slopes down as a wedge and the head rests just ahead of the
// front legs; head up, it sits on a 2 x 2 neck that is part of the back line.
const DOE_GRAZING = [
  '............',
  '............',
  '............',
  '....bbbbbbbw', // back; white tail tuft at the right
  '...bbbbwbbwb', // shoulders, fawn spots
  '..bbbbbbbbbb', // chest widening into the neck
  '.kbbb.b.b.bb', // ear (k); neck sloping down; legs
  '.bkb..b.b..b', // lowered head, eye (k)
  '.sb...k.k..k', // pale muzzle in the snow; hooves
]
const DOE_ALERT = [
  '............',
  '..bk........', // top of the head, ear (k) behind it
  'bkbb........', // nose, eye (k), head joining the neck
  '..bbbbbbbbbw', // short neck running into the back; tail tuft
  '..bbbbwbbwbb', // neck into the spotted body
  '...bbbbbbbbb',
  '......b.b.bb', // legs
  '......b.b..b',
  '......k.k..k', // hooves
]
const DOE_X = 154 // left tile column: head in the gap between the right-hand trees, rump in front of the far one
const DOE_CYCLE = 10 // seconds: grazing for 3/4 of it, head up for the last 1/4
const DEER_X = [21, 32, 43] // reindeer offsets in the team; the last one leads

let teamBody = tiles(SLEIGH, 0, 3, 1, CRISP.team)
DEER_X.forEach((dx, i) => {
  teamBody += tiles(DEER, dx, 3, i, CRISP.team)
})
teamBody += tiles(['yy'], 19, 8, 0, CRISP.team) + tiles(['y'], 31, 8, 0, CRISP.team) + tiles(['y'], 42, 8, 0, CRISP.team)
const teamShadow = SHADOW(shadowPath(SLEIGH, 1, 5) + DEER_X.map(dx => shadowPath(DEER, dx + 1, 5)).join(''))
const legsA = DEER_X.map((dx, i) => tiles(LEGS_A, dx, 10, i, CRISP.team)).join('')
// Still frame (local change): where legsB is drawn in SCENE its group rests at
// opacity="0", so a still frame shows one set of legs instead of both overlapping.
const legsB = DEER_X.map((dx, i) => tiles(LEGS_B, dx, 10, i, CRISP.team)).join('')
const nose = `<use href="#z0" x="${(43 + 9) * T}" y="${6 * T}">${fade('1;0.45;1', 2)}</use>`

// The sleigh's flight: from off the left to off the right, climbing.
// Local change: it glides smoothly. The original moved in 20-pixel hops, six a second,
// and the desktop app's photosensitivity check stops scenes with abrupt, repeated
// brightness changes; a straight glide needs only its two end points.
const FLY_STEPS = 155
// Points along the flight, "x y" in user units (used for the still-frame resting spot).
const flyPoints = Array.from({ length: FLY_STEPS + 1 }, (_, i) => {
  const t = i / FLY_STEPS
  return `${Math.round(-1000 + 3100 * t)} ${Math.round(420 - 270 * t)}`
})
const flyGlide = `${flyPoints[0]};${flyPoints[FLY_STEPS]}` // start;end, interpolated smoothly

// ---------- Still frame (local change) ----------
// When the desktop app draws the scene in its still mode it deletes every SMIL
// element, so each animated element shows its own attributes instead. Those resting
// values are set below so the still frame looks deliberate. While the scene animates,
// SMIL replaces them (additive="replace" is SMIL's default), so motion is unchanged.
//
// How far along its flight the sleigh rests: 0 = off the left edge, 1 = off the
// right. 0.62 leaves the team climbing toward the moon, right of the middle of the
// picture where the conversation sits. Chosen by eye; tune freely.
const SLEIGH_REST_FRACTION = 0.62
const sleighRest = flyPoints[Math.round(SLEIGH_REST_FRACTION * FLY_STEPS)] // "x y"

// Lights along both roof slopes and the eave. Local change: each bulb fades softly
// (offset in four phases) instead of switching hard on and off, which flickered a small
// patch of the picture about 3.3 times a second, past the usual 3-per-second flash limit.
const BULB_KEYS = ['r', 'y', 'g', 'u', 'p']
const bulbPts = []
for (let r = 3; r <= 10; r++) bulbPts.push([(HX + 12 - r) * T - 2, (HY + r) * T + 5])
for (let c = 1; c <= 19; c++) bulbPts.push([(HX + c) * T + 2, (HY + 11) * T + 7])
for (let r = 10; r >= 3; r--) bulbPts.push([(HX + 8 + r) * T + S - 4, (HY + r) * T + 5])
const BULBS = bulbPts
  .map(
    ([x, y], i) =>
      `<use href="#L${BULB_KEYS[i % 5]}" x="${x}" y="${y}">${fade('1;0.4;1', 2.4, -((i % 4) * 0.6).toFixed(1))}</use>`,
  )
  .join('')

// Snowdrifts: a top row of tiles per column, and a tiled fill beneath it,
// running well past both edges so a wide window never sees the end.
const groundCells = [] // [symbol id, X, Y] for each top tile; drawn with patternPaths below
const groundPts = []
// The ground is level under the house and trees (and a little either side),
// so they stand on the snow instead of over a dip.
const FLAT = [
  [HX - 2, HX + 23],
  ...TREES.map(([x]) => [x - 2, x + 15]),
  ...PROPS.map(([rows, x]) => [x - 1, x + rows[0].length]), // local addition: props stand level too
  [DOE_X - 1, DOE_X + DOE_GRAZING[0].length], // and the doe
]
for (let c = -80; c < 240; c++) {
  const flat = FLAT.some(([a, b]) => c >= a && c <= b)
  const top = flat ? GROUND : GROUND - Math.round(1.2 + 1.2 * Math.sin(c * 0.31) + 0.8 * Math.sin(c * 0.11 + 1))
  groundCells.push([`w${(((c * 7) % 4) + 4) % 4}`, c * T, top * T])
  groundPts.push(`${c * T},${(top + 1) * T}`, `${(c + 1) * T},${(top + 1) * T}`)
}
const groundTop = patternPaths(groundCells)
const groundFill = `<polygon points="${groundPts.join(' ')} ${240 * T},1000 ${-80 * T},1000" fill="url(#snowPat)"/>`

// Falling snow: single tiles and five-tile crosses, from far above the picture
// so a tall window is snowing all the way up.
// Seeded random numbers, so the snow looks random but the file never changes.
let seed = 20251224
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Each flake gets its own spot across the width (one per slice, jittered so
// none bunch up), its own speed, its own start time and its own sideways drift.
const FLAKES = 46
// The original band is x = -400..2000 (2400 wide, centred on x = 800). It is
// widened by ZOOM_OUT about the same centre so the wider view is still snowing
// at its edges. FLAKES stays 46, so the same number of flakes are on screen as
// before, each drawn smaller.
// Each flake falls from FALL_FROM_Y (far above the picture, so a tall window is
// snowing all the way up) to FALL_TO_Y (the picture's bottom edge), in user units.
// These are the original's numbers, named so the still-frame position can reuse them.
const FALL_FROM_Y = -1200
const FALL_TO_Y = 1000
const SNOW_WIDTH = 2400 * ZOOM_OUT
const SNOW_LEFT = PIC_W / 2 - SNOW_WIDTH / 2
// (The flakes themselves are built further down, after the telescope, so that
// cross-shaped flakes can stay clear of it.)

// Stars live on the sky layer, which fills the window.
const STARS = [[6, 3], [17, 8], [28, 2], [39, 6], [52, 3], [61, 9], [70, 4], [82, 7], [12, 14], [47, 13], [99, 17], [33, 18], [75, 15], [103, 5], [90, 24], [20, 26]]
  .map(
    ([c, r], i) =>
      `<rect x="${c * 15 + 4}" y="${r * 15 + 4}" width="4" height="4" fill="#fff6d0">${fade('1;0.35;1', 2.6, -((i % 5) * 0.6).toFixed(1))}</rect>`,
  )
  .join('')

const mx = (MX + 5.5) * T
const my = (MY + 5.5) * T
const winY = (HY + 15) * T + 4.5

// ---------- Black hole binary, pulsar, chimney smoke (local additions) ----------
//
// Everything here moves smoothly and slowly. The desktop app stops a moving backdrop that
// flashes (it runs a photosensitivity check), so nothing blinks: brightness only changes
// gently or by sweeping.
// Positions are picture coordinates (user units). With the zoom in effect the visible
// picture spans roughly x -240..1840 and y -300..1000; the conversation sits in the middle,
// so these live in the upper corners.

// (Local tweak: the binary and pulsar are drawn subdued, with smaller, fainter glows,
// ripples and beams and faded tiles, so they sit quietly in the sky.)
// Black hole binary: two equal-mass black holes on a circular orbit seen at an
// inclination, so the orbit projects to an ellipse with semi-axes BH_A x BH_B.
const BH_X = 110, BH_Y = -60 // orbit centre
const BH_A = 62, BH_B = 22 // projected semi-axes: BH_B / BH_A = cos(inclination) ~ 0.35
const BH_PERIOD = 12 // orbital period, seconds
const BH_ORBIT_STEPS = 36 // points sampled around the orbit for the (linear) path
// A binary radiates gravitational waves at twice its orbital frequency (quadrupole), so a
// ripple leaves every BH_PERIOD / 2 seconds and lives RIPPLE_LIFE seconds.
const RIPPLE_EVERY = BH_PERIOD / 2
const RIPPLES = 3 // ripples alive at once
const RIPPLE_LIFE = RIPPLE_EVERY * RIPPLES
const RIPPLE_R = [20, 220] // radius at birth and at fade-out, user units (before the tilt)

// The hole: a dark core ringed by accretion-disc tiles. Drawn centred on (0, 0): tile
// columns -2..2 put the 5x5 sprite at -20..29, so its centre is 4.5 (half a tile) right/down.
const BH = [
  '.oyo.',
  'yvvvo',
  'ovvvy',
  'yvvvo',
  '.oyo.',
]
const SPRITE_CENTRE = 4.5 // offset of a sprite's centre from its (0, 0) tile origin

// Path of one hole: BH_ORBIT_STEPS + 1 points around the ellipse starting at phase
// `phase` (radians); the other hole uses phase + pi (opposite side, equal masses).
function orbitPath(phase) {
  const points = []
  for (let i = 0; i <= BH_ORBIT_STEPS; i++) {
    const theta = phase + (2 * Math.PI * i) / BH_ORBIT_STEPS
    const x = BH_X + BH_A * Math.cos(theta) - SPRITE_CENTRE
    const y = BH_Y + BH_B * Math.sin(theta) - SPRITE_CENTRE
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return points
}
const holes = [0, Math.PI]
  .map(phase => {
    const path = orbitPath(phase)
    // Resting transform = the first point, for the app's still frame.
    return `<g transform="translate(${path[0]})">${move(path.join(';'), BH_PERIOD)}<circle cx="${SPRITE_CENTRE}" cy="${SPRITE_CENTRE}" r="26" fill="url(#bhglow)"/><g opacity="0.7">${tiles(BH, -2, -2, 2)}</g></g>`
  })
  .join('')
// Ripples: dashed rings growing and fading, squashed by BH_B / BH_A like the orbit.
let ripples = ''
for (let i = 0; i < RIPPLES; i++) {
  const begin = -i * RIPPLE_EVERY
  ripples +=
    `<g opacity="0.2">${fade('0.4;0', RIPPLE_LIFE, begin)}` +
    `<circle r="${(RIPPLE_R[0] + RIPPLE_R[1]) / 2}" fill="none" stroke="#a9bce6" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke">` +
    `${tween('r', `${RIPPLE_R[0]};${RIPPLE_R[1]}`, RIPPLE_LIFE, begin)}</circle></g>`
}
const BINARY = `<g transform="translate(${BH_X} ${BH_Y}) scale(1 ${(BH_B / BH_A).toFixed(3)})">${ripples}</g>${holes}`

// Pulsar: a neutron star whose two beams sweep round like a lighthouse. Real pulsars spin
// in milliseconds to seconds; this one is slowed right down (and doesn't blink) so the
// app's flash check stays happy.
const PSR_X = 1720, PSR_Y = -170 // the star's centre
const PSR_PERIOD = 6 // seconds per turn of the beams
const BEAM_LENGTH = 150 // user units
const BEAM_HALF_WIDTH = 8 // half the beam's width at its far end, user units
const PSR = ['.l.', 'lfl', '.l.']
const beam = `<polygon points="${PSR_X} ${PSR_Y} ${PSR_X - BEAM_HALF_WIDTH} ${PSR_Y - BEAM_LENGTH} ${PSR_X + BEAM_HALF_WIDTH} ${PSR_Y - BEAM_LENGTH}" fill="url(#beam)"/>`
const PULSAR =
  `<g>${spin(PSR_X, PSR_Y, PSR_PERIOD)}${beam}<g transform="rotate(180 ${PSR_X} ${PSR_Y})">${beam}</g></g>` +
  // Core glow brightens a little each time a beam passes the line of sight: twice a turn.
  `<circle cx="${PSR_X}" cy="${PSR_Y}" r="26" fill="url(#psrglow)" opacity="0.45">${fade('0.35;0.55;0.35', PSR_PERIOD / 2)}</circle>` +
  `<g transform="translate(${PSR_X - 10 - SPRITE_CENTRE} ${PSR_Y - 10 - SPRITE_CENTRE})" opacity="0.75">${tiles(PSR, 0, 0, 1)}</g>`

// Chimney smoke: puffs of shaded-snow tiles rising and drifting right as they fade.
const SMOKE_X = (HX + 15) * T, SMOKE_Y = (HY - 2) * T // just above the chimney top
const SMOKE_RISE = [40, -170] // drift right, rise (negative = up), user units
const SMOKE_LIFE = 8 // seconds for one puff to rise and fade
const SMOKE_PUFFS = 3
let smoke = ''
for (let i = 0; i < SMOKE_PUFFS; i++) {
  const begin = -(i * SMOKE_LIFE) / SMOKE_PUFFS
  const restFraction = i / SMOKE_PUFFS // where this puff rests in the still frame
  const rest = `${SMOKE_X + SMOKE_RISE[0] * restFraction} ${SMOKE_Y + SMOKE_RISE[1] * restFraction}`
  smoke +=
    `<g transform="translate(${rest})">${move(`${SMOKE_X} ${SMOKE_Y};${SMOKE_X + SMOKE_RISE[0]} ${SMOKE_Y + SMOKE_RISE[1]}`, SMOKE_LIFE, begin)}` +
    `<g opacity="${(0.5 * (1 - restFraction)).toFixed(2)}">${fade('0.5;0', SMOKE_LIFE, begin)}${tiles(['ll', 'll'], 0, 0, i)}</g></g>`
}

// ---------- Depth: far mountains, haze, rolling hills (local addition) ----------
//
// Layers further back are drawn with chunkier steps, darker or hazier colours and
// smaller, dimmer trees, so the eye reads distance. All static: no per-frame motion,
// so they cost almost nothing against the app's budget and can't flash.
const DEPTH_FROM = -80, DEPTH_TO = 240 // tile columns covered (as wide as the ground)

// A stepped silhouette standing on row GROUND. heightAt(c) gives the top, in rows above
// GROUND, at tile column c; the outline steps every `step` columns (bigger = farther).
function ridge(heightAt, step) {
  let d = `M${DEPTH_FROM * T} ${GROUND * T}`
  for (let c = DEPTH_FROM; c < DEPTH_TO; c += step) {
    const top = (GROUND - Math.round(heightAt(c))) * T
    d += `V${top}H${(c + step) * T}`
  }
  return d + `V${GROUND * T}Z`
}

// Far mountains, 6 to 26 rows tall. Drawn twice: once in snowcap colour, then again
// MOUNTAIN_CAP rows lower in rock colour, which leaves a snowcap band along every top.
const mountainHeight = c => 16 + 6 * Math.sin(c * 0.09 + 1) + 4 * Math.sin(c * 0.23)
const MOUNTAIN_STEP = 3 // columns per step
const MOUNTAIN_CAP = 2 // snowcap depth, rows
const MOUNTAINS =
  `<path d="${ridge(mountainHeight, MOUNTAIN_STEP)}" fill="#5d7bb5"/>` +
  `<path d="${ridge(c => mountainHeight(c) - MOUNTAIN_CAP, MOUNTAIN_STEP)}" fill="#172f63"/>`

// Haze: fades the mountains' feet into the night air (atmospheric perspective).
const HAZE_ROWS = 30 // how far above the ground the haze reaches
const HAZE = `<rect x="${DEPTH_FROM * T}" y="${(GROUND - HAZE_ROWS) * T}" width="${(DEPTH_TO - DEPTH_FROM) * T}" height="${HAZE_ROWS * T}" fill="url(#haze)"/>`

// Rolling hills, 1 to 11 rows tall: nearer, so lighter snow and finer steps.
const hillHeight = c => 6 + 3 * Math.sin(c * 0.05 + 3) + 2 * Math.sin(c * 0.17 + 1)
const HILL_STEP = 2
const HILLS = `<path d="${ridge(hillHeight, HILL_STEP)}" fill="#5f77a8"/>`

// Top edge (y, user units) of the hill step that covers tile column c. Steps start at
// DEPTH_FROM and every HILL_STEP columns after, and take their height from that start.
function hillTopY(c) {
  const stepStart = DEPTH_FROM + Math.floor((c - DEPTH_FROM) / HILL_STEP) * HILL_STEP
  return (GROUND - Math.round(hillHeight(stepStart))) * T
}

// Small far-off trees on the hilltops, as stepped silhouettes: tile detail can't be seen
// at that distance, and all of them in ONE path cost almost nothing per frame (eight
// scaled copies of the tile tree cost ~0.8 ms, measured in the app's own player).
const HILL_TREE_COLUMNS = [-55, -30, 48, 66, 92, 172, 198, 222] // tile columns
// One silhouette, top to bottom: [half-width, height] of each tier, then the trunk.
// User units; about 0.4 of the foreground tree's size.
const HILL_TREE_TIERS = [[3, 7], [7, 9], [11, 10], [15, 10], [19, 11]]
const HILL_TREE_TRUNK = [3, 7]
const HILL_TREE_HEIGHT = [...HILL_TREE_TIERS, HILL_TREE_TRUNK].reduce((sum, [, h]) => sum + h, 0)
let hillTreePath = ''
for (const c of HILL_TREE_COLUMNS) {
  const cx = c * T + 5 // centre on the tile column
  let y = hillTopY(c) - HILL_TREE_HEIGHT
  for (const [halfWidth, height] of [...HILL_TREE_TIERS, HILL_TREE_TRUNK]) {
    hillTreePath += `M${cx - halfWidth} ${y}h${2 * halfWidth}v${height}h${-2 * halfWidth}z`
    y += height
  }
}
const HILL_TREES = `<path d="${hillTreePath}" fill="#1f3d55" opacity="0.85"/>`

// A far-off village: a few warm windows on the hill around columns 71-81.
const VILLAGE = [[71, 0], [73, 1], [74, 0], [76, 1], [78, 0], [79, 2], [81, 1]] // [column, rows below the hilltop]
  .map(([c, below]) => {
    const y = hillTopY(c) + below * T + 3
    return `<rect x="${c * T + 3}" y="${y}" width="4" height="4" fill="#ffd27a" opacity="0.85"/>`
  })
  .join('')

// A cartoon Green Bank Telescope beyond the hills, in pixels (local addition). The dish
// looks up and to the left. As on the real GBT, a straight, tapering feed arm rises from
// the dish's low edge to the receiver room near the focus, with the subreflector plate
// on top, and it all sits on the alidade frame. Pale and hazy like the mountains, and
// static. Drawn before the hills, which hide its base.
//
// The pixel map was laid out geometrically (half-ellipse bowl, straight tapered arm,
// boxes, trapezoid frame) and rasterized, then pasted here so it can be edited by hand.
// D = steel, F = surfaces catching the moonlight (dish rim, subreflector), . = empty.
const GBT_PIXELS = [
  '..........FFFF....................', // subreflector
  '.......FFFFF......................',
  '.....FFFF.........................',
  '.......DDDDDD.....................', // receiver room
  '.......DDDDDD.....................',
  '.......DDDDDD.....................',
  '.......DDDDDD.....................',
  '........DDD.......................', // feed arm, tapering upwards
  '........DDD.......................',
  '........DDD.......................',
  '........DDD.......................',
  '........DDD.................F.....', // top of the dish
  '........DDD................FFD....',
  '........DDD..............FFFDD....',
  '........DDD.............FFDDD.....',
  '........DDD...........FFFDDDD.....',
  '.......DDDD..........FFDDDDD......',
  '.......DDDD........FFFDDDDD.......',
  '.......DDDD.......FFFDDDDDD.......',
  '.......DDDD......FFDDDDDDD........',
  '.......DDDD....FFFDDDDDDD.........',
  '.......DDDD...FFDDDDDDD...........',
  '.......DDDD.FFFDDDDDDD............',
  '.......DDDDFFDDDDDDDD.............',
  '.......DDFFFDDDDDDDDDD............', // the arm meets the dish's low edge
  '.......DFFFDDDDDDDDDDD............',
  '.......DDDDDDD..DDDDDD.DDDDD......', // bottom of the dish's back; counterweight (right)
  '................DDDDDDDDDDDD......', // elevation bearing, with the arm out to the counterweight
  '.................DD....DDDDD......', // bearing post; the counterweight hangs opposite the dish
  '..........DDDDDDDDDDDDDDDDDDD.....', // alidade: top girder of a braced steel box
  '..........DDDDDD.......DDDDDD.....', // X bracing between near-vertical sides
  '..........DD...DDDDDDDD....DD.....',
  '..........DD...DDDDDDDD....DD.....',
  '..........DDDDDD.......DDDDDD.....',
  '.........DDDDDDDDDDDDDDDDDDDDD....', // bottom girder
  '........DDDDD.............DDDDD...', // wheel trucks on the azimuth track
]
const GBT_COLOURS = { D: '#a3b6dc', F: '#d4e0f5' } // pale moonlit steel; brighter where lit
const GBT_PX = 5 // picture units per pixel: half a tile, fine enough for something far off
const GBT_X = 550 // picture x of the middle of the base: left of centre, clear of the snowman, behind the hills
const GBT_BASE_Y = 862 // picture y of the base: about level with the hilltops, so the frame shows

// One path per colour: each row's runs of that colour become 1-pixel-tall rectangles,
// written with relative moves (as in patternPaths) to keep the scene small.
let gbtPaths = ''
for (const [key, colour] of Object.entries(GBT_COLOURS)) {
  let d = ''
  let previous = null // start of the last run written: relative moves count from there
  GBT_PIXELS.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (row[x] !== key) {
        x++
        continue
      }
      let end = x
      while (end < row.length && row[end] === key) end++
      const moveTo = previous === null ? `M${x} ${y}` : `m${x - previous.x} ${y - previous.y}`
      d += `${moveTo}h${end - x}v1h${x - end}z`
      previous = { x, y }
      x = end
    }
  })
  gbtPaths += `<path d="${d}" fill="${colour}"/>`
}
const GBT_WIDTH = GBT_PIXELS[0].length
const GBT_HEIGHT = GBT_PIXELS.length
const GBT = `<g transform="translate(${GBT_X - (GBT_WIDTH / 2) * GBT_PX} ${GBT_BASE_Y - GBT_HEIGHT * GBT_PX}) scale(${GBT_PX})" opacity="0.6">${gbtPaths}</g>`

const DEPTH = MOUNTAINS + HAZE + GBT + HILLS + HILL_TREES + VILLAGE

// ---------- Falling snow: the flakes (see FLAKES, rand and SNOW_* above) ----------
let snow = ''
for (let i = 0; i < FLAKES; i++) {
  const col = Math.round((SNOW_LEFT + ((i + rand()) / FLAKES) * SNOW_WIDTH) / T)
  const dur = Math.round(18 + rand() * 18)
  const begin = -(rand() * dur).toFixed(1)
  const drift = Math.round((rand() - 0.5) * 140)
  const path = `0 ${FALL_FROM_Y};${drift} ${FALL_TO_Y}`
  // Still frame (local change): the flake rests where its fall puts it at the
  // animation's start, -begin/dur of the way down (begin <= 0). Without this every
  // flake sat at y = 0, a single row along the top of the picture.
  const restFraction = -begin / dur
  const restX = Math.round(drift * restFraction)
  const restY = Math.round(FALL_FROM_Y + (FALL_TO_Y - FALL_FROM_Y) * restFraction)
  // About one flake in seven is a five-tile cross. A cross falling in front of the
  // telescope read as a sparkle on it, so a flake whose path (drift included) can pass
  // over the telescope stays a single tile. It uses glyph f0 rather than drawing another
  // random number, so every other flake keeps exactly its original look and timing.
  const isCross = rand() < 0.14
  const flakeCentreX = (col + 1) * T // a cross spans columns col .. col + 2
  const overTelescope = Math.abs(flakeCentreX - GBT_X) <= (GBT_WIDTH * GBT_PX) / 2 + Math.abs(drift) + 2 * T
  let flake
  if (isCross && !overTelescope) {
    flake = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
      .map(([x, y]) => `<use href="#f${(x + y) % 4}" x="${(col + x) * T}" y="${y * T}"/>`)
      .join('')
  } else if (isCross) {
    flake = `<use href="#f0" x="${col * T}" y="0"/>`
  } else {
    flake = `<use href="#f${Math.floor(rand() * 4)}" x="${col * T}" y="0"/>`
  }
  snow += `<g transform="translate(${restX} ${restY})">${move(path, dur, begin)}${flake}</g>`
}


export const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060d22"/><stop offset="0.55" stop-color="#0d1d47"/><stop offset="1" stop-color="#1c3a78"/></linearGradient>
<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="#a9c2ff"/></pattern>
<radialGradient id="mglow"><stop offset="0" stop-color="#fff2c4" stop-opacity="0.45"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></radialGradient>
<radialGradient id="wglow"><stop offset="0" stop-color="#ffb84a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3a78" stop-opacity="0"/><stop offset="1" stop-color="#1c3a78" stop-opacity="0.7"/></linearGradient>
<radialGradient id="bhglow"><stop offset="0.3" stop-color="#ff9a3c" stop-opacity="0.35"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
<radialGradient id="psrglow"><stop offset="0" stop-color="#cfe3ff" stop-opacity="0.9"/><stop offset="1" stop-color="#cfe3ff" stop-opacity="0"/></radialGradient>
<linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="${PSR_X}" y1="${PSR_Y}" x2="${PSR_X}" y2="${PSR_Y - BEAM_LENGTH}"><stop offset="0" stop-color="#d9e8ff" stop-opacity="0.25"/><stop offset="1" stop-color="#d9e8ff" stop-opacity="0"/></linearGradient>
<style>
text{font:700 6px monospace;text-anchor:middle}
</style>
${SYMBOLS}${BULB_SYMBOLS}${PATTERNS}
<pattern id="snowPat" width="20" height="20" patternUnits="userSpaceOnUse"><use href="#l0"/><use href="#w1" x="10"/><use href="#w2" y="10"/><use href="#l3" x="10" y="10"/></pattern>
<g id="moon">${tiles(MOON, 0, 0, 0, CRISP.moon)}</g>
<g id="tree">${tiles(TREE, 0, 0, 0, CRISP.tree)}</g>
<g id="house">${tiles(HOUSE, 0, 0, 0, CRISP.house)}</g>
<g id="team">${teamBody}</g>
</defs>
<svg width="100%" height="100%" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<rect width="1600" height="1000" fill="url(#sky)"/>
${STARS}
</svg>
<svg width="100%" height="100%" viewBox="${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMax meet" overflow="visible">
<rect x="-2000" y="-2000" width="5600" height="3000" fill="url(#grid)" opacity="0.12"/>
${BINARY}
${PULSAR}
<circle cx="${mx}" cy="${my}" r="170" fill="url(#mglow)"/>
${SHADOW(shadowPath(MOON, MX + 1, MY + 2))}
<use href="#moon" x="${MX * T}" y="${MY * T}"/>
${DEPTH}
${groundFill}
${groundTop}
${SHADOW(TREES.map(([x, y]) => shadowPath(TREE.slice(0, -1), x + 2, y)).join('') + shadowPath(HOUSE.slice(0, -1), HX + 2, HY) + PROPS.map(([rows, x]) => shadowPath(rows, x + 1, GROUND - rows.length)).join(''))}
<circle cx="${LAMP_X * T + 25}" cy="${(GROUND - LAMP.length) * T + 10}" r="60" fill="url(#wglow)" opacity="0.3">${fade('0.25;0.4;0.25', 5)}</circle>
${PROPS.map(([rows, x, salt]) => tiles(rows, x, GROUND - rows.length, salt)).join('')}
${SHADOW(shadowPath(DOE_GRAZING, DOE_X + 1, GROUND - DOE_GRAZING.length))}
<g>${blink('1;1;1;0', DOE_CYCLE)}${tiles(DOE_GRAZING, DOE_X, GROUND - DOE_GRAZING.length, 4)}</g>
<g opacity="0">${blink('0;0;0;1', DOE_CYCLE)}${tiles(DOE_ALERT, DOE_X, GROUND - DOE_ALERT.length, 4)}</g>
${TREES.map(([x, y]) => `<use href="#tree" x="${x * T}" y="${y * T}"/>`).join('')}
<use href="#house" x="${HX * T}" y="${HY * T}"/>
${smoke}
${TREES.map(([x]) => tiles(['w'.repeat(17)], x - 2, GROUND, 3)).join('')}
${tiles(['w'.repeat(25)], HX - 2, GROUND, 5)}
<circle cx="${(HX + 5) * T + 4.5}" cy="${winY}" r="38" fill="url(#wglow)" opacity="0.35">${fade('0.35;0.6;0.35', 3.5)}</circle>
<circle cx="${(HX + 15) * T + 4.5}" cy="${winY}" r="38" fill="url(#wglow)" opacity="0.35">${fade('0.35;0.6;0.35', 3.5, -1.7)}</circle>
${BULBS}
<g transform="translate(${sleighRest})">${move(flyGlide, 26)}<g>${move('0 0;0 -6;0 0', 1.8)}
${teamShadow}
<use href="#team"/>
<g>${blink('1;0', 0.8)}${legsA}</g><g opacity="0">${blink('0;1', 0.8)}${legsB}</g>
${nose}
</g></g>
${snow}
</svg>
</svg>`

// ---------- Keeping the animation's place across redraws (local change) ----------
//
// The desktop app rebuilds the scene's frame whenever it redraws the backdrop,
// and a new frame starts every animation from t = 0, so the sleigh jumped back
// off the left edge. sceneAt(nowSeconds) returns SCENE with every animation's
// `begin` shifted so that, at the new frame's t = 0, each one is already where
// it would be had it been running since the Unix epoch. A redraw then picks up
// where the last one left off. Every window and session also runs in step.
//
// For an animation of duration D and original begin B, its phase at clock time
// tau (seconds) is  (tau - B) mod D.  A frame drawn at clock time `now` has local
// time t = tau - now, and with a new begin B' its phase is  (t - B') mod D.
// These agree for every t when
//   B' = -((now - B) mod D)          which lies in (-D, 0].
// Here B <= 0 and now > 0, so now - B > 0 and JS's % already gives [0, D).
//
// This relies on blink, fade and move above writing the timing exactly as
//   dur="<D>s" begin="<B>s"
// in that order. ANIMATION_TIMING matches that and nothing else.
const ANIMATION_TIMING = /dur="([0-9.]+)s" begin="(-?[0-9.]+)s"/g

// Begins are written to 10 ms (finer than one frame). Unrounded, each was ~18 characters
// ("-7.123456789012345s"), and across ~120 animations that pushed the scene over the app's
// 131,072-character limit for an Svg source: the app then drew no backdrop at all.
const BEGIN_DECIMALS = 2

export function sceneAt(nowSeconds) {
  return SCENE.replace(ANIMATION_TIMING, (match, durText, beginText) => {
    const D = Number(durText) // seconds per cycle
    const B = Number(beginText) // original begin, seconds (<= 0)
    const phase = (nowSeconds - B) % D // seconds into the current cycle, [0, D)
    return `dur="${durText}s" begin="${(-phase).toFixed(BEGIN_DECIMALS)}s"`
  })
}
