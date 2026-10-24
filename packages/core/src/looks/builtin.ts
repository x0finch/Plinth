/**
 * Built-in look libraries: looks shipped with the app that anyone can add to a design, like a library shared with everyone
 * read-only. The Chinese set keeps the traditional pieces (tea table, ancestral shrine, wood-fired stove, stone table and
 * drum stool) while the default set follows an IKEA-like Scandinavian style. Bump a look's version when its recipe changes,
 * so designs that use it are offered the update.
 */
import type { Recipe } from '../script.js';

/** A Chinese tea table: a heavy dark top with an apron, a stone tray, a teapot and cups */
const teatable: Recipe = {
  script: `(
    $tx := $w * 0.1;
    [
      $box([$w, 60, $d], [0, $h - 60 + 60 / 2, 0], 'woodDark', 10),
      $box([$w - 80, 80, $d - 80], [0, $h - 140 + 80 / 2, 0], 'woodDark', 5),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([30 * 2, $h - 60, 30 * 2], [$sx * ($w / 2 - 50), ($h - 60) / 2, $sz * ($d / 2 - 50)], 'woodDark', 30 * 0.3)
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w - 100, 30, 30], [0, 100 + 30 / 2, $s * ($d / 2 - 50)], 'woodDark', 5)
        ]
      ),
      $box([$min([600, $w * 0.45]), 30, $min([340, $d * 0.5])], [$tx, $h + 30 / 2, 0], 'stoneDark', 10),
      $lathe([[0, 0], [40, 0], [65, 40], [50, 85], [15, 95], [15, 110], [0, 110]], [$tx - 120, $h + 30, 0], 'ceramic'),
      [0..2].(
        $i := $;
        [
          $lathe([[0, 0], [18, 0], [26, 35], [0, 35]], [$tx + 40 + $i * 70, $h + 30, 60], 'ceramic')
        ]
      )
    ]
  )`,
};

/** An ancestral shrine: a lacquered altar table with raised ends, a small shrine cabinet, an incense burner and candles */
const shrine: Recipe = {
  script: `(
    $ht := $min([850, $h * 0.68]);
    $cw := $min([700, $w * 0.35]);
    $cd := $min([320, $d * 0.65]);
    $cz := -$d / 2 + $cd / 2 + 30;
    $top := $h - $ht;
    $fz := $d / 2 - 90;
    [
      $box([$w, 50, $d], [0, $ht - 50 + 50 / 2, 0], 'lacquer', 10),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([140, 35, $d], [$s * ($w / 2 - 70), $ht + 35 / 2, 0], 'lacquer', 10)
        ]
      ),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([35 * 2, $ht - 50, 35 * 2], [$sx * (($w - 100) / 2 - 50), ($ht - 50) / 2, $sz * ($d / 2 - 50)], 'lacquer', 35 * 0.3)
        ]
      ),
      $box([$w - 300, 100, 25], [0, $ht - 150 + 100 / 2, $d / 2 - 60], 'lacquer', 5),
      $box([$cw + 80, 40, $cd + 40], [0, $ht + 40 / 2, $cz], 'lacquer', 8),
      $box([$cw, $top - 90, $cd], [0, $ht + 40 + ($top - 90) / 2, $cz], 'lacquer', 6),
      $box([$cw + 160, 50, $cd + 120], [0, $h - 50 + 50 / 2, $cz], 'lacquer', 10),
      $box([$cw * 0.7, ($top - 90) * 0.75, 10], [0, $ht + 60 + ($top - 90) * 0.75 / 2, $cz + $cd / 2], 'gold', 3),
      $lathe([[0, 0], [50, 0], [80, 30], [80, 70], [70, 80], [0, 80]], [0, $ht, $fz], 'gold'),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $cylinder(45, 60, [$s * $w * 0.3, $ht + 30, $fz], 'gold', {"r2": 30}),
          $cylinder(25, 200, [$s * $w * 0.3, $ht + 160, $fz], 'red')
        ]
      )
    ]
  )`,
};

/** A wood-fired stove: a tiled masonry body, two iron woks (one under a wooden lid), fire openings in front */
const woodstove: Recipe = {
  script: `(
    $r := $min([300, $d * 0.38, $w * 0.15]);
    $fh := $min([240, $h * 0.32]);
    [
      $box([$w, $h - 50, $d], [0, 0 + ($h - 50) / 2, 0], 'plaster', 40),
      $box([$w + 20, 50, $d + 20], [0, $h - 50 + 50 / 2, 0], 'countertop', 20),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $ring($r, 20, [$s * $w * 0.22, $h + 5, 0], 'iron'),
          $cylinder($r, 4, [$s * $w * 0.22, $h, 0], 'iron', {"seg": 32}),
          $box([260, $fh, 20], [$s * $w * 0.22, 120 + $fh / 2, $d / 2 + 2], 'dark', 60)
        ]
      ),
      $lathe([[0, $r * 0.03], [$r * 0.65, $r * 0.03], [$r * 0.55, $r * 0.08], [$r * 0.35, $r * 0.14], [0, $r * 0.17]], [$w * 0.22, $h, 0], 'wood'),
      $cylinder(30, 50, [$w * 0.22, $h + $r * 0.22 + 25, 0], 'wood')
    ]
  )`,
};

/** A round stone table on a carved drum */
const stonetable: Recipe = {
  script: `(
    $r := $min([$w, $d]) / 2;
    [
      $cylinder($r, 80, [0, $h - 40, 0], 'stone', {"r2": $r * 0.98, "seg": 40}),
      $lathe([[0, 0], [$r * 0.42, 0], [$r * 0.42, 60], [$r * 0.3, 140], [$r * 0.26, $h * 0.45], [$r * 0.34, $h - 140], [$r * 0.4, $h - 80], [0, $h - 80]], [0, 0, 0], 'stone')
    ]
  )`,
};

/** A drum-shaped stone stool */
const stool: Recipe = {
  script: `(
    $r := $min([$w, $d]) / 2;
    [
      $lathe([[0, 0], [$r * 0.78, 0], [$r * 0.95, $h * 0.3], [$r, $h * 0.5], [$r * 0.95, $h * 0.7], [$r * 0.8, $h], [0, $h]], [0, 0, 0], 'stone'),
      $ring($r * 0.99, 8, [0, $h * 0.5, 0], 'stoneDark')
    ]
  )`,
};

export interface BuiltinLook {
  id: string;
  name: { zh: string; en: string };
  for: string[];
  recipe: Recipe;
  version: number;
}
export interface BuiltinLibrary {
  id: string;
  name: { zh: string; en: string };
  looks: BuiltinLook[];
}

export const BUILTIN_LIBRARIES: BuiltinLibrary[] = [
  {
    id: 'builtin-chinese',
    name: { zh: '中式物件', en: 'Chinese pieces' },
    looks: [
      { id: 'teatable', name: { zh: '功夫茶台', en: 'Gongfu tea table' }, for: ['furniture:teatable'], recipe: teatable, version: 1 },
      { id: 'shrine', name: { zh: '神位供桌', en: 'Ancestral altar' }, for: ['furniture:shrine'], recipe: shrine, version: 1 },
      { id: 'woodstove', name: { zh: '土灶', en: 'Brick wood-fired stove' }, for: ['furniture:woodstove'], recipe: woodstove, version: 1 },
      { id: 'stonetable', name: { zh: '石桌', en: 'Stone table' }, for: ['furniture:stonetable'], recipe: stonetable, version: 1 },
      { id: 'stool', name: { zh: '石鼓凳', en: 'Stone drum stool' }, for: ['furniture:stool'], recipe: stool, version: 1 },
    ],
  },
];

export const builtinLibrary = (id: string) => BUILTIN_LIBRARIES.find(l => l.id === id);

/** The default set (looks/index.ts) shown as a library: what every object without a look of its own is drawn with */
export const DEFAULT_LIBRARY_ID = 'builtin-default';
