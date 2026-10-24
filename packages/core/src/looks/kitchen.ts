/** Kitchen and dining: dining table and chair, counter, wood-fired stove, island, bar counter and stool, fridge */
import type { Recipe } from '../script.js';

/** A dining table (IKEA style): a thin birch top with a softened edge on slightly tapered round legs and a slim frame */
const dining: Recipe = {
  script: `[
    $box([$w, 28, $d], [0, $h - 28 + 28 / 2, 0], 'birch', 8),
    $box([$w - 200, 60, $d - 200], [0, $h - 88 + 60 / 2, 0], 'birch', 3),
    [0..3].(
      $i := $;
      $sx := $i % 2 * 2 - 1;
      $sz := $floor($i / 2) * 2 - 1;
      [
        $cylinder(26 * 0.8, $h - 28, [$sx * ($w / 2 - 90), ($h - 28) / 2, $sz * ($d / 2 - 90)], 'birch', {"r2": 26, "seg": 12})
      ]
    )
  ]`,
};

/** A white spindle-back chair (IKEA style): turned legs, a solid seat, rear posts that rise into a bent top rail, five spindles */
const chair: Recipe = {
  script: `(
    $seat := $min([450, $h * 0.53]);
    $bz := -$d / 2 + 30;
    $tilt := 50;
    [
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $cylinder(16 * 0.8, $seat - 30, [$sx * ($w / 2 - 30), ($seat - 30) / 2, $sz * ($d / 2 - 30)], 'white', {"r2": 16, "seg": 12})
        ]
      ),
      $box([$w - 20, 22, $d - 40], [0, $seat - 52 + 22 / 2, 0], 'white', 4),
      $box([$w, 30, $d], [0, $seat - 30 + 30 / 2, 10], 'white', 12),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * ($w / 2 - 30), $seat - 30, $bz], [$s * ($w / 2 - 34), $h - 20, $bz - $tilt], 15, 'white', 10)
        ]
      ),
      $box([$w - 30, 90, 24], [0, $h - 55, $bz - $tilt + 2], 'white', 10, [-8, 0, 0]),
      [0..4].(
        $i := $;
        $x := ($i - 2) * ($w - 120) / 4;
        [
          $rod([$x, $seat, $bz + 6], [$x, $h - 95, $bz - $tilt + 8], 8, 'white', 8)
        ]
      )
    ]
  )`,
};

/** Base cabinets under an oak-look worktop, with a steel sink and a black cooktop */
const counter: Recipe = {
  script: `(
    $sx := -$w * 0.22;
    $cx := $w * 0.24;
    [
      $box([$w - 20, 100, $d - 80], [0, 0 + 100 / 2, 0 - 30], 'white', 3),
      $box([$w, $h - 40 - 100, $d - 30], [0, 100 + ($h - 40 - 100) / 2, 0 - 15], 'white', 4),
      [0..$floor($max([1, $round($w / 600)])) - 1].(
        $i := $;
        $dw := $w / $max([1, $round($w / 600)]);
        $x := -$w / 2 + $dw * ($i + 0.5);
        $dh := 160;
        [
          $box([$dw - 4, $h - 40 - 108 - $dh, 18], [$x, 102 + ($h - 40 - 108 - $dh) / 2, 0 + 1 * ($d / 2 - 20)], 'white', 2),
          $box([$dw - 4, $dh - 4, 18], [$x, $h - 40 - 4 - $dh + ($dh - 4) / 2, 0 + 1 * ($d / 2 - 20)], 'white', 2),
          $box([$min([240, $dw * 0.45]), 10, 16], [$x, $h - 40 - 40, 0 + 1 * ($d / 2 - 4)], 'metal', 4)
        ]
      ),
      $box([$w, 40, $d], [0, $h - 40 + 40 / 2, 0], 'birch', 4),
      $box([$min([550, $w * 0.3]), 4, $d * 0.62], [$sx, $h + 4 / 2, 20], 'metal', 20),
      $rod([$sx, $h, -$d / 2 + 80], [$sx, $h + 300, -$d / 2 + 80], 13, 'metal'),
      $rod([$sx, $h + 300, -$d / 2 + 80], [$sx, $h + 280, -$d / 2 + 240], 11, 'metal'),
      $box([$min([600, $w * 0.3]), 6, $d * 0.75], [$cx, $h + 6 / 2, 20], 'dark', 10),
      $ring(80, 6, [$cx + -140, $h + 8, -80], 'metal'),
      $ring(60, 6, [$cx + 140, $h + 8, -80], 'metal'),
      $ring(60, 6, [$cx + -140, $h + 8, 140], 'metal'),
      $ring(80, 6, [$cx + 140, $h + 8, 140], 'metal')
    ]
  )`,
};

/** A wood-fired stove (IKEA style): white cabinets under a birch top with two black cast-iron wok rings and black fire doors */
const woodstove: Recipe = {
  script: `(
    $r := $min([300, $d * 0.38, $w * 0.15]);
    $fh := $min([240, $h * 0.32]);
    [
      $box([$w - 20, 100, $d - 80], [0, 0 + 100 / 2, 0 - 30], 'white', 3),
      $box([$w, $h - 40 - 100, $d - 30], [0, 100 + ($h - 40 - 100) / 2, 0 - 15], 'white', 4),
      [0..$floor($max([1, $round($w / 600)])) - 1].(
        $i := $;
        $dw := $w / $max([1, $round($w / 600)]);
        $x := -$w / 2 + $dw * ($i + 0.5);
        $dh := 160;
        [
          $box([$dw - 4, $h - 40 - 108 - $dh, 18], [$x, 102 + ($h - 40 - 108 - $dh) / 2, 0 + 1 * ($d / 2 - 20)], 'white', 2),
          $box([$dw - 4, $dh - 4, 18], [$x, $h - 40 - 4 - $dh + ($dh - 4) / 2, 0 + 1 * ($d / 2 - 20)], 'white', 2),
          $box([$min([240, $dw * 0.45]), 10, 16], [$x, $h - 40 - 40, 0 + 1 * ($d / 2 - 4)], 'metal', 4)
        ]
      ),
      $box([$w, 40, $d], [0, $h - 40 + 40 / 2, 0], 'birch', 4),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $ring($r, 18, [$s * $w * 0.22, $h + 5, 0], 'dark'),
          $cylinder($r, 4, [$s * $w * 0.22, $h, 0], 'iron', {"seg": 32}),
          $box([300, $fh, 8], [$s * $w * 0.22, 140 + $fh / 2, $d / 2 + 2], 'dark', 6)
        ]
      ),
      $lathe([[0, $r * 0.03], [$r * 0.65, $r * 0.03], [$r * 0.55, $r * 0.08], [$r * 0.35, $r * 0.14], [0, $r * 0.17]], [$w * 0.22, $h, 0], 'birch'),
      $cylinder(30, 50, [$w * 0.22, $h + $r * 0.22 + 25, 0], 'birch')
    ]
  )`,
};

/** A kitchen island: cabinets facing north, an oak-look top overhanging to the south for stools, a bowl on top */
const island: Recipe = {
  script: `(
    $over := $min([300, $d * 0.3]);
    [
      $box([$w - 20, 100, $d - $over - 80], [0, 0 + 100 / 2, -$over / 2 - -30], 'white', 3),
      $box([$w, $h - 40 - 100, $d - $over - 30], [0, 100 + ($h - 40 - 100) / 2, -$over / 2 - -15], 'white', 4),
      [0..$floor($max([1, $round($w / 600)])) - 1].(
        $i := $;
        $dw := $w / $max([1, $round($w / 600)]);
        $x := -$w / 2 + $dw * ($i + 0.5);
        $dh := 160;
        [
          $box([$dw - 4, $h - 40 - 108 - $dh, 18], [$x, 102 + ($h - 40 - 108 - $dh) / 2, -$over / 2 + -1 * (($d - $over) / 2 - 20)], 'white', 2),
          $box([$dw - 4, $dh - 4, 18], [$x, $h - 40 - 4 - $dh + ($dh - 4) / 2, -$over / 2 + -1 * (($d - $over) / 2 - 20)], 'white', 2),
          $box([$min([240, $dw * 0.45]), 10, 16], [$x, $h - 40 - 40, -$over / 2 + -1 * (($d - $over) / 2 - 4)], 'metal', 4)
        ]
      ),
      $box([$w, 40, $d], [0, $h - 40 + 40 / 2, 0], 'birch', 4),
      $lathe([[0, 0], [60, 0], [130, 80], [125, 85], [0, 30]], [$w * 0.2, $h, 0], 'ceramic')
    ]
  )`,
};

/** A bar counter (IKEA style): a white panelled front, an oak-look top overhanging the front, a steel foot rail */
const bar: Recipe = {
  script: `(
    $n := $max([1, $round($w / 600)]);
    [
      $box([$w, $h - 40, $d - 120], [0, 0 + ($h - 40) / 2, -60], 'white', 4),
      [0..$floor($n) - 1].(
        $i := $;
        [
          $box([$w / $n - 4, $h - 50, 14], [-$w / 2 + $w / $n * ($i + 0.5), 4 + ($h - 50) / 2, $d / 2 - 113], 'white', 2)
        ]
      ),
      $box([$w, 40, $d], [0, $h - 40 + 40 / 2, 0], 'birch', 4),
      $rod([-$w / 2 + 100, 220, $d / 2 - 60], [$w / 2 - 100, 220, $d / 2 - 60], 14, 'metal'),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * ($w / 2 - 150), 220, $d / 2 - 60], [$s * ($w / 2 - 150), 220, $d / 2 - 106], 9, 'metal')
        ]
      )
    ]
  )`,
};

/** A wooden bar stool (IKEA style): a round birch seat on four splayed legs joined by a foot ring */
const barstool: Recipe = {
  script: `(
    $r := $min([$w, $d]) / 2;
    $top := $r * 0.42;
    $foot := $r * 0.82;
    $fy := $h * 0.32;
    [
      $cylinder($r * 0.82, 30, [0, $h - 15, 0], 'birch', {"seg": 36}),
      [0..3].(
        $i := $;
        $a := $i * 90 + 45;
        [
          $rod([$cos($a) * $top, $h - 30, $sin($a) * $top], [$cos($a) * $foot, 0, $sin($a) * $foot], 15, 'birch', 10)
        ]
      ),
      $ring($top + ($foot - $top) * (1 - $fy / ($h - 30)), 10, [0, $fy, 0], 'birch')
    ]
  )`,
};

/** A fridge (IKEA style): flat white doors, freezer below, slim steel bar handles on the right */
const fridge: Recipe = {
  script: `(
    $split := $h * 0.36;
    $fz := $d / 2 - 25;
    $hx := $w / 2 - 50;
    [
      $box([$w, $h - 20, $d - 60], [0, 20 + ($h - 20) / 2, -30], 'white', 12),
      $box([$w - 4, $split - 24, 50], [0, 22 + ($split - 24) / 2, $fz], 'white', 8),
      $box([$w - 4, $h - $split - 24, 50], [0, $split + 2 + ($h - $split - 24) / 2, $fz], 'white', 8),
      $box([16, 260, 20], [$hx, $split - 170, $fz + 35], 'metal', 6),
      $box([16, 520, 20], [$hx, $split + 360, $fz + 35], 'metal', 6),
      $box([$w - 100, 20, $d - 100], [0, 0 + 20 / 2, -30], 'dark', 5)
    ]
  )`,
};

export const KITCHEN: Record<string, Recipe> = { dining, chair, counter, woodstove, island, bar, barstool, fridge };
