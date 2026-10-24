/** Living room: sofas, lounge chair, coffee and tea tables, TV stand, side table, potted plant, memorial sideboard (the Chinese pieces are in builtin.ts) */
import type { Recipe } from '../script.js';

/**
 * A Scandinavian sofa (IKEA style): wide, low, softly rounded arms, a deep seat on small black feet, loose seat and back
 * cushions of about 65 cm each, so a longer sofa gets more cushions
 */
const sofa: Recipe = {
  params: { fabric: 'fabric', cushion: 'cushion', legs: 'dark' },
  script: `(
    $leg := 50;
    $arm := $min([240, $max([140, $w * 0.11])]);
    $back := $min([200, $d * 0.22]);
    $baseTop := $leg + $min([220, $h * 0.27]);
    $seatTop := $max([$baseTop + 40, $min([$h * 0.55, 450])]);
    $armTop := $min([$h * 0.76, 630]);
    $inner := $w - 2 * $arm;
    $n := $max([1, $round($inner / 650)]);
    $cw := $inner / $n;
    $seatD := $d - $back - 30;
    [
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([20 * 2, $leg, 20 * 2], [$sx * ($w / 2 - 60), $leg / 2, $sz * ($d / 2 - 60)], $legs, 20 * 0.3)
        ]
      ),
      $box([$w - 20, $baseTop - $leg, $d - 20], [0, $leg + ($baseTop - $leg) / 2, 0], $fabric, 40),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$arm, $armTop - $leg, $d], [$s * ($w - $arm) / 2, $leg + ($armTop - $leg) / 2, 0], $fabric, 90)
        ]
      ),
      $box([$inner + 40, $h - $baseTop - 40, $back], [0, $baseTop + ($h - $baseTop - 40) / 2, -($d - $back) / 2], $fabric, 60),
      [0..$floor($n) - 1].(
        $i := $;
        $x := -$inner / 2 + $cw * ($i + 0.5);
        [
          $box([$cw - 10, $seatTop - $baseTop, $seatD], [$x, $baseTop + ($seatTop - $baseTop) / 2, ($d - $seatD) / 2 - 15], $cushion, 70),
          $box([$cw - 10, ($h - $seatTop) * 0.98, 200], [$x, $seatTop + ($h - $seatTop) * 0.49, -$d / 2 + $back + 80], $cushion, 90, [-9, 0, 0])
        ]
      )
    ]
  )`,
};

/**
 * A bentwood lounge chair (IKEA style): a laminated birch frame that runs along the floor, curves up at the front into the
 * arms and carries one long cushion from the knees to the head
 */
const armchair: Recipe = {
  params: { frame: 'birch', cushion: 'cushion' },
  script: `(
    $cw := $w - 150;
    $fx := $cw / 2 + 25;
    $zf := $d / 2 - 110;
    $yf := $h * 0.43;
    $zb := -$d / 2 + 230;
    $yb := $h * 0.32;
    $zt := -$d / 2 + 60;
    $yt := $h - 30;
    $a1 := $atan2($yf - $yb, $zf - $zb);
    $l1 := $hypot($yf - $yb, $zf - $zb);
    $a2 := $atan2($zb - $zt, $yt - $yb);
    $l2 := $hypot($zb - $zt, $yt - $yb);
    [
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $tube([[$s * $fx, 16, -$d / 2 + 100], [$s * $fx, 16, $d / 2 - 160], [$s * $fx, 60, $d / 2 - 40], [$s * $fx, $h * 0.3, $d / 2 - 30], [$s * $fx, $h * 0.56, $d / 2 - 80], [$s * $fx, $h * 0.6, $d / 2 - 260], [$s * $fx, $h * 0.5, -$d / 2 + 250], [$s * $fx, $yb - 20, $zb - 20]], 16, $frame),
          $tube([[$s * ($cw / 2 - 10), $yf - 50, $zf], [$s * ($cw / 2 - 10), $yb - 50, $zb], [$s * ($cw / 2 - 10), $yt - 40, $zt + 20]], 14, $frame)
        ]
      ),
      $rod([-$fx, 16, -$d / 2 + 100], [$fx, 16, -$d / 2 + 100], 14, $frame),
      $rod([-$fx, $yf - 60, $zf], [$fx, $yf - 60, $zf], 14, $frame),
      $box([$cw, 100, $l1 + 60], [0, ($yf + $yb) / 2, ($zf + $zb) / 2], $cushion, 45, [-$a1, 0, 0]),
      $box([$cw, $l2 + 40, 90], [0, ($yb + $yt) / 2, ($zb + $zt) / 2], $cushion, 40, [-$a2, 0, 0])
    ]
  )`,
};

/** A low table with a thick top flush on square legs and a shelf underneath (IKEA style): a birch top, white legs and shelf */
const coffee: Recipe = {
  params: { top: 'birch', legs: 'white', decor: true },
  script: `(
    $t := 50;
    $l := 50;
    [
      $box([$w, $t, $d], [0, $h - $t + $t / 2, 0], $top, 4),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([$l / 2 * 2, $h - $t, $l / 2 * 2], [$sx * ($w / 2 - $l / 2), ($h - $t) / 2, $sz * ($d / 2 - $l / 2)], $legs, $l / 2 * 0.3)
        ]
      ),
      $box([$w - 2 * $l, 18, $d - 2 * $l], [0, 90 + 18 / 2, 0], $legs, 2),
      ($decor ? [$box([260, 30, 190], [-$w * 0.22, $h + 15, 20], 'book2', 4, [0, 11.5, 0])] : []),
      ($decor ? [$box([220, 25, 160], [-$w * 0.22, $h + 43, 20], 'book4', 4, [0, -5.7, 0])] : []),
      ($decor ? [$lathe([[0, 0], [50, 0], [90, 50], [90, 55], [0, 55]], [$w * 0.2, $h, -20], 'ceramic')] : []),
      ($decor ? [$noplan($box([300, 22, 220], [-$w * 0.18, 108 + 22 / 2, 0], 'book1', 3))] : []),
      ($decor ? [$noplan($box([280, 18, 200], [-$w * 0.18, 130 + 18 / 2, 0], 'book3', 3))] : [])
    ]
  )`,
};

/** A tea table (IKEA style): a birch top on a white frame with a slatted lower shelf, a birch tray with a white tea set */
const teatable: Recipe = {
  params: { top: 'birch', frame: 'white', decor: true },
  script: `(
    $tx := $w * 0.12;
    $ty := $min([560, $w * 0.4]);
    $tz := $min([320, $d * 0.5]);
    [
      $box([$w, 30, $d], [0, $h - 30 + 30 / 2, 0], $top, 6),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([22 * 2, $h - 30, 22 * 2], [$sx * ($w / 2 - 40), ($h - 30) / 2, $sz * ($d / 2 - 40)], $frame, 22 * 0.3)
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w - 80, 60, 20], [0, $h - 90 + 60 / 2, $s * ($d / 2 - 40)], $frame, 3)
        ]
      ),
      [0..$floor($max([3, $floor(($d - 120) / 90)])) - 1].(
        $i := $;
        $n := $max([3, $floor(($d - 120) / 90)]);
        [
          $box([$w - 80, 18, ($d - 120) / $n - 20], [0, 140 + 18 / 2, -($d - 120) / 2 + ($d - 120) / $n * ($i + 0.5)], $top, 3)
        ]
      ),
      $box([$ty, 18, $tz], [$tx, $h + 18 / 2, 0], $top, 6),
      ($decor ? [$lathe([[0, 0], [45, 0], [70, 45], [55, 90], [18, 100], [18, 115], [0, 115]], [$tx - $ty * 0.25, $h + 18, 0], 'ceramic')] : []),
      [0..2].(
        $i := $;
        [
          ($decor ? [$lathe([[0, 0], [20, 0], [28, 40], [0, 40]], [$tx + $ty * 0.05 + $i * 70, $h + 18, $tz * 0.2], 'ceramic')] : [])
        ]
      )
    ]
  )`,
};

/** A low media bench (IKEA style): a white case on slim steel legs, handleless push-open doors, a vase and books on top */
const tvstand: Recipe = {
  params: { body: 'white', legs: 'metal', decor: true },
  script: `(
    $leg := 110;
    $n := $max([1, $round($w / 600)]);
    $dw := $w / $n;
    [
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $cylinder(12 * 0.8, $leg, [$sx * ($w / 2 - 40), $leg / 2, $sz * ($d / 2 - 40)], $legs, {"r2": 12, "seg": 12})
        ]
      ),
      $box([$w, $h - $leg, $d - 16], [0, $leg + ($h - $leg) / 2, -8], $body, 6),
      [0..$floor($n) - 1].(
        $i := $;
        $x := -$w / 2 + $dw * ($i + 0.5);
        [
          $box([$dw - 4, $h - $leg - 4, 16], [$x, $leg + 2 + ($h - $leg - 4) / 2, $d / 2 - 8], $body, 3)
        ]
      ),
      ($decor ? [$lathe([[0, 0], [60, 0], [80, 100], [40, 220], [35, 260], [0, 260]], [-$w * 0.32, $h, 0], 'ceramic')] : []),
      ($decor ? [$box([300, 40, 220], [$w * 0.3, $h + 40 / 2, 0], 'book1', 4)] : []),
      ($decor ? [$box([260, 35, 200], [$w * 0.3, $h + 40 + 35 / 2, 0], 'book3', 4)] : [])
    ]
  )`,
};

/** A small square side table (IKEA style): a thick top flush on four square legs, all white */
const sidetable: Recipe = {
  params: { body: 'white', decor: true },
  script: `(
    $t := 50;
    $l := 50;
    [
      $box([$w, $t, $d], [0, $h - $t + $t / 2, 0], $body, 4),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([$l / 2 * 2, $h - $t, $l / 2 * 2], [$sx * ($w / 2 - $l / 2), ($h - $t) / 2, $sz * ($d / 2 - $l / 2)], $body, $l / 2 * 0.3)
        ]
      ),
      ($decor ? [$lathe([[0, 0], [45, 0], [60, 60], [35, 150], [28, 180], [0, 180]], [$w * 0.15, $h, -$d * 0.1], 'ceramicShade')] : [])
    ]
  )`,
};

/** A white ceramic pot with a small leafy tree */
const plant: Recipe = {
  params: { pot: 'ceramic' },
  script: `(
    $r := $min([$w, $d]) / 2;
    $ph := $min([340, $h * 0.3]);
    [
      $lathe([[0, 0], [$r * 0.66, 0], [$r * 0.72, $ph * 0.08], [$r * 0.76, $ph], [$r * 0.7, $ph], [0, $ph - 20]], [0, 0, 0], $pot),
      $cylinder($r * 0.7, 10, [0, $ph - 25, 0], 'soil'),
      $rod([0, $ph - 30, 0], [$cos(0) * 120, $h * 0.72, $sin(0) * 120], 12, 'bark', 6),
      $rod([0, $ph - 30, 0], [$cos(120) * 200, $h * 0.72, $sin(120) * 200], 12, 'bark', 6),
      $rod([0, $ph - 30, 0], [$cos(240) * 160, $h * 0.72, $sin(240) * 160], 12, 'bark', 6),
      $sphere($r * 0.5 * 1.9, [0 * $r * 2.4, $min([$h - $r * 0.5, 0.78 * $h]), 0 * $r * 2.2], 'leaf', [1, 0.85, 1]),
      $sphere($r * 0.4 * 1.9, [0.16 * $r * 2.4, $min([$h - $r * 0.4, 0.66 * $h]), 0.08 * $r * 2.2], 'leaf2', [1, 0.85, 1]),
      $sphere($r * 0.38 * 1.9, [-0.14 * $r * 2.4, $min([$h - $r * 0.38, 0.7 * $h]), 0.1 * $r * 2.2], 'leaf', [1, 0.85, 1]),
      $sphere($r * 0.4 * 1.9, [0.05 * $r * 2.4, $min([$h - $r * 0.4, 0.62 * $h]), -0.16 * $r * 2.2], 'leaf2', [1, 0.85, 1]),
      $sphere($r * 0.36 * 1.9, [-0.08 * $r * 2.4, $min([$h - $r * 0.36, 0.88 * $h]), -0.06 * $r * 2.2], 'leaf', [1, 0.85, 1]),
      $sphere($r * 0.3 * 1.9, [0.1 * $r * 2.4, $min([$h - $r * 0.3, 0.9 * $h]), 0.1 * $r * 2.2], 'leaf2', [1, 0.85, 1])
    ]
  )`,
};

/** A memorial sideboard (IKEA style): a long white sideboard on birch legs, a small white cabinet with a glass door, white candles */
const shrine: Recipe = {
  params: { body: 'white', legs: 'birch', decor: true },
  script: `(
    $leg := 120;
    $ht := $min([800, $h * 0.62]);
    $n := $max([2, $round($w / 500)]);
    $dw := $w / $n;
    $cw := $min([600, $w * 0.32]);
    $cd := $min([300, $d * 0.6]);
    $cz := -$d / 2 + $cd / 2 + 20;
    $top := $h - $ht;
    [
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $cylinder(20 * 0.8, $leg, [$sx * ($w / 2 - 60), $leg / 2, $sz * ($d / 2 - 60)], $legs, {"r2": 20, "seg": 12})
        ]
      ),
      $box([$w, $ht - $leg, $d - 16], [0, $leg + ($ht - $leg) / 2, -8], $body, 6),
      [0..$floor($n) - 1].(
        $i := $;
        [
          $box([$dw - 4, $ht - $leg - 4, 16], [-$w / 2 + $dw * ($i + 0.5), $leg + 2 + ($ht - $leg - 4) / 2, $d / 2 - 8], $body, 3)
        ]
      ),
      $box([$cw, $top, $cd], [0, $ht + $top / 2, $cz], $body, 4),
      $box([$cw - 40, $top - 40, 6], [0, $ht + $top / 2, $cz + $cd / 2 + 3], 'glass', 2),
      $box([$cw - 60, 20, $cd - 40], [0, $ht + $top * 0.45 + 20 / 2, $cz], $legs, 2),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          ($decor ? [$cylinder(35, 30, [$s * $w * 0.3, $ht + 15, $d / 2 - 110], 'ceramic')] : []),
          ($decor ? [$cylinder(25, 180, [$s * $w * 0.3, $ht + 120, $d / 2 - 110], 'linen')] : [])
        ]
      ),
      ($decor ? [$lathe([[0, 0], [60, 0], [70, 40], [55, 90], [0, 90]], [0, $ht, $d / 2 - 90], 'ceramicShade')] : [])
    ]
  )`,
};

export const LIVING: Record<string, Recipe> = { sofa3: sofa, sofa2: sofa, armchair, coffee, teatable, tvstand, sidetable, plant, shrine };
