/** Bathroom and laundry: toilet, washbasin, showers, grab bar, call button, folding seat, washing machine, laundry sink */
import type { Recipe } from '../script.js';

/** A wall-hung toilet: a white in-wall cistern panel (north) with a flush plate, a bowl that floats off the floor, seat and lid */
const toilet: Recipe = {
  script: `(
    $tank := $min([140, $d * 0.2]);
    $seat := $min([420, $h * 0.56]);
    $r := $min([$w / 2, 190]);
    $k := $min([1.45, ($d - $tank + 20) / (2 * $r)]);
    $bz := $d / 2 - $r * $k;
    $lift := $min([160, $seat * 0.38]);
    [
      $box([$w, $h, $tank], [0, 0 + $h / 2, -$d / 2 + $tank / 2], 'white', 6),
      $box([160, 110, 8], [0, $h - 120, -$d / 2 + $tank + 4], 'metal', 6),
      $lathe([[0, $lift], [$r * 0.6, $lift], [$r * 0.85, $lift + ($seat - $lift) * 0.55], [$r * 0.95, $seat - 30], [0, $seat - 30]], [0, 0, $bz], 'ceramic', {"scale": [1, 1, $k]}),
      $box([$r * 1.2, $seat - $lift - 30, $tank], [0, $lift + ($seat - $lift - 30) / 2, -$d / 2 + $tank * 1.5], 'ceramic', 20),
      $cylinder($r, 30, [0, $seat - 15, $bz], 'ceramic', {"seg": 32, "scale": [1, 1, $k]}),
      $cylinder($r * 0.96, 20, [0, $seat + 10, $bz], 'ceramic', {"seg": 32, "scale": [1, 1, $k]})
    ]
  )`,
};

/** A wall-hung vanity (IKEA style): a white case with two handleless drawers, a ceramic top with its basin, a faucet */
const basin: Recipe = {
  script: `(
    $top := $h - 40;
    $ch := $min([500, $top - 200]);
    $dh := ($ch - 12) / 2;
    $br := $min([$w * 0.32, 200]);
    [
      $box([$w, $ch, $d - 20], [0, $top - $ch + $ch / 2, -10], 'white', 4),
      [0..1].(
        $i := $;
        $y := $top - $ch + 4 + $i * ($dh + 4);
        [
          $box([$w - 8, $dh, 16], [0, $y + $dh / 2, $d / 2 - 10], 'white', 2),
          $noplan($box([$min([260, $w * 0.5]), 8, 6], [0, $y + $dh - 20 + 8 / 2, $d / 2 + 1], 'metal', 3))
        ]
      ),
      $box([$w, 40, $d], [0, $top + 40 / 2, 0], 'ceramic', 12),
      $cylinder($br, 4, [0, $h + 2, 30.5], 'ceramicShade', {"seg": 36, "scale": [1, 1, 0.75]}),
      $cylinder(20, 180, [0, $h + 90, -$d / 2 + 60], 'metal'),
      $rod([0, $h + 170, -$d / 2 + 60], [0, $h + 150, -$d / 2 + 180], 12, 'metal')
    ]
  )`,
};

/** A square shower in a corner (walls to the north and west), glass to the south and east */
const showerSquare: Recipe = {
  script: `[
    $box([$w, 50, $d], [0, 0 + 50 / 2, 0], 'white', 10),
    $panel([-$w / 2, $d / 2], [$w / 2, $d / 2], 50, $h - 50, 8, 'glass'),
    $rod([-$w / 2, $h, $d / 2], [$w / 2, $h, $d / 2], 10, 'dark', 8),
    $panel([$w / 2, $d / 2], [$w / 2, -$d / 2], 50, $h - 50, 8, 'glass'),
    $rod([$w / 2, $h, $d / 2], [$w / 2, $h, -$d / 2], 10, 'dark', 8),
    $rod([-$w / 2, 50, $d / 2], [-$w / 2, $h, $d / 2], 10, 'dark', 8),
    $rod([$w / 2, 50, $d / 2], [$w / 2, $h, $d / 2], 10, 'dark', 8),
    $rod([$w / 2, 50, -$d / 2], [$w / 2, $h, -$d / 2], 10, 'dark', 8),
    $rod([-$w * 0.15, $min([900, $h * 0.45]), -$d / 2 + 30], [-$w * 0.15, $h - 100, -$d / 2 + 30], 12, 'dark'),
    $rod([-$w * 0.15, $h - 100, -$d / 2 + 30], [-$w * 0.15, $h - 120, -$d / 2 + 230], 10, 'dark'),
    $cylinder(90, 15, [-$w * 0.15, $h - 127.5, -$d / 2 + 250], 'dark', {"seg": 28}),
    $cylinder(30, 6, [0, 53, 50], 'dark')
  ]`,
};

/** A diamond shower: a corner shower with its outer corner cut by the door */
const showerDiamond: Recipe = {
  script: `(
    $c := $min([$w, $d]) * 0.45;
    [
      $extrude('plan', [[-$w / 2, -$d / 2], [$w / 2, -$d / 2], [$w / 2, $d / 2 - $c], [$w / 2 - $c, $d / 2], [-$w / 2, $d / 2]], 50, 'white'),
      $panel([-$w / 2, $d / 2], [$w / 2 - $c, $d / 2], 50, $h - 50, 8, 'glass'),
      $rod([-$w / 2, $h, $d / 2], [$w / 2 - $c, $h, $d / 2], 10, 'dark', 8),
      $panel([$w / 2 - $c, $d / 2], [$w / 2, $d / 2 - $c], 50, $h - 50, 8, 'glass'),
      $rod([$w / 2 - $c, $h, $d / 2], [$w / 2, $h, $d / 2 - $c], 10, 'dark', 8),
      $panel([$w / 2, $d / 2 - $c], [$w / 2, -$d / 2], 50, $h - 50, 8, 'glass'),
      $rod([$w / 2, $h, $d / 2 - $c], [$w / 2, $h, -$d / 2], 10, 'dark', 8),
      $rod([-$w / 2, 50, $d / 2], [-$w / 2, $h, $d / 2], 10, 'dark', 8),
      $rod([$w / 2 - $c, 50, $d / 2], [$w / 2 - $c, $h, $d / 2], 10, 'dark', 8),
      $rod([$w / 2, 50, $d / 2 - $c], [$w / 2, $h, $d / 2 - $c], 10, 'dark', 8),
      $rod([$w / 2, 50, -$d / 2], [$w / 2, $h, -$d / 2], 10, 'dark', 8),
      $rod([-$w * 0.15, $min([900, $h * 0.45]), -$d / 2 + 30], [-$w * 0.15, $h - 100, -$d / 2 + 30], 12, 'dark'),
      $rod([-$w * 0.15, $h - 100, -$d / 2 + 30], [-$w * 0.15, $h - 120, -$d / 2 + 230], 10, 'dark'),
      $cylinder(90, 15, [-$w * 0.15, $h - 127.5, -$d / 2 + 250], 'dark', {"seg": 28}),
      $cylinder(30, 6, [0, 53, 50], 'dark')
    ]
  )`,
};

/** A grab bar on the wall (north): a rail on two posts with round wall plates */
const grab: Recipe = {
  script: `(
    $y := $h / 2;
    $z := $d / 2 - 20;
    $x := $w / 2 - 40;
    [
      $rod([-$x, $y, $z], [$x, $y, $z], 16, 'metal', 14),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * $x, $y, $z], [$s * $x, $y, -$d / 2 + 10], 12, 'metal'),
          $cylinder(35, 10, [$s * $x, $y, -$d / 2 + 5], 'metal', {"axis": 'z', "seg": 28})
        ]
      )
    ]
  )`,
};

/** An emergency call button: a white plate with a red button */
const sos: Recipe = {
  script: `[
    $box([$w, $h, 15], [0, $h / 2, -$d / 2 + 7.5], 'appliance', 8),
    $cylinder($min([$w, $h]) * 0.28, 18, [0, $h / 2, -$d / 2 + 24], 'red', {"axis": 'z', "seg": 28})
  ]`,
};

/** A folding shower seat: slatted seat on a wall plate (north), held by two diagonal braces */
const foldseat: Recipe = {
  script: `(
    $sd := ($d - 30) / 4;
    [
      $box([$w - 40, 140, 20], [0, $h - 160 + 140 / 2, -$d / 2 + 10], 'white', 6),
      [0..3].(
        $i := $;
        [
          $box([$w, 25, $sd - 12], [0, $h - 25 + 25 / 2, -$d / 2 + 25 + $sd * ($i + 0.5)], 'birch', 6)
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * ($w / 2 - 30), $h - 30, $d / 2 - 50], [$s * ($w / 2 - 30), $h - 300, -$d / 2 + 20], 10, 'metal'),
          $rod([$s * ($w / 2 - 30), $h - 30, -$d / 2 + 20], [$s * ($w / 2 - 30), $h - 30, $d / 2 - 30], 10, 'metal')
        ]
      )
    ]
  )`,
};

/** A front-loading washing machine (white): control strip, round door with a dark rim */
const washer: Recipe = {
  script: `(
    $z := $d / 2;
    $dr := $min([$w, $h]);
    [
      $box([$w, $h, $d - 10], [0, 0 + $h / 2, -5], 'white', 25),
      $box([$w * 0.4, 50, 4], [-$w * 0.15, $h - 65, $z - 8], 'dark', 4),
      $cylinder(30, 20, [$w * 0.3, $h - 65, $z], 'metal', {"axis": 'z', "seg": 28}),
      $ring($dr * 0.27, 25, [0, $h * 0.45, $z], 'dark', 'z'),
      $cylinder($dr * 0.25, 10, [0, $h * 0.45, $z - 5], 'carGlass', {"axis": 'z', "seg": 28})
    ]
  )`,
};

/** A laundry sink (IKEA style): a deep white ceramic sink on a white two-door cabinet, a wall tap (north) */
const sink: Recipe = {
  script: `(
    $tub := $min([260, $h * 0.33]);
    $t := 30;
    $y := $h - $tub;
    $leg := 100;
    [
      $box([$w - 20, $leg, $d - 80], [0, 0 + $leg / 2, -30], 'white', 3),
      $box([$w, $y - $leg, $d - 20], [0, $leg + ($y - $leg) / 2, -10], 'white', 4),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w / 2 - 4, $y - $leg - 6, 16], [$s * $w / 4, $leg + 3 + ($y - $leg - 6) / 2, $d / 2 - 10], 'white', 2)
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $noplan($box([12, 120, 14], [$s * 40, $y - 180 + 120 / 2, $d / 2 + 4], 'metal', 4))
        ]
      ),
      $box([$w, $t, $d], [0, $y + $t / 2, 0], 'ceramic', 10),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w, $tub, $t], [0, $y + $tub / 2, $s * ($d / 2 - $t / 2)], 'ceramic', 12),
          $box([$t, $tub, $d], [$s * ($w / 2 - $t / 2), $y + $tub / 2, 0], 'ceramic', 12)
        ]
      ),
      $rod([0, $h + 250, -$d / 2 + 5], [0, $h + 250, -$d / 2 + 120], 12, 'metal'),
      $rod([0, $h + 250, -$d / 2 + 120], [0, $h + 180, -$d / 2 + 130], 10, 'metal')
    ]
  )`,
};

export const BATH: Record<string, Recipe> = { toilet, basin, shower: showerSquare, shower5: showerDiamond, grab, sos, foldseat, washer, sink };
