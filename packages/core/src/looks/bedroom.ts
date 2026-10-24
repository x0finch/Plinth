/** Bedroom and study: beds, nightstand, wardrobe, desk, bookcase */
import type { Recipe } from '../script.js';

/**
 * A platform bed (IKEA style): birch panel sides and foot that hold the mattress, a tall flat headboard (north), a white
 * duvet, a grey throw at the foot, one or two pillows
 */
const bed: Recipe = {
  params: { frame: 'birch', bedding: 'linen', blanket: 'bedding' },
  script: `(
    $t := 30;
    $mattress := $min([200, $h * 0.45]);
    $side := $h - $mattress + 70;
    $head := 40;
    $headTop := $max([$h + 520, 950]);
    $md := $d - $head - 2 * $t;
    $duvet := $md * 0.68;
    $throw := $min([450, $duvet * 0.35]);
    $n := $w >= 1200 ? 2 : 1;
    $pw := ($w - 160) / $n - 40;
    [
      $box([$w - 80, 30, $d - $head - 80], [0, 0 + 30 / 2, $head / 2], 'dark', 2),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$t, $side - 30, $d - $head], [$s * ($w - $t) / 2, 30 + ($side - 30) / 2, $head / 2], $frame, 4)
        ]
      ),
      $box([$w, $side - 30, $t], [0, 30 + ($side - 30) / 2, $d / 2 - $t / 2], $frame, 4),
      $box([$w - 2 * $t, 30, $md], [0, $h - $mattress - 30 + 30 / 2, $head / 2], $frame, 2),
      $box([$w, $headTop, $head], [0, 0 + $headTop / 2, -$d / 2 + $head / 2], $frame, 6),
      $box([$w - 2 * $t - 10, $mattress, $md - 10], [0, $h - $mattress + $mattress / 2, $head / 2], $bedding, 50),
      $box([$w - 2 * $t + 20, 60, $duvet], [0, $h - 10 + 60 / 2, $d / 2 - $t - $duvet / 2 - 10], $bedding, 30),
      $box([$w - 2 * $t + 30, 45, $throw], [0, $h + 42.5 + 45 / 2, $d / 2 - $t - $throw / 2 - 20], $blanket, 20),
      [0..$floor($n) - 1].(
        $i := $;
        [
          $box([$pw, 130, 420], [-($w - 160) / 2 + ($w - 160) / $n * ($i + 0.5), $h + 70, -$d / 2 + $head + $t + 230], $bedding, 65, [-14.3, 0, 0])
        ]
      )
    ]
  )`,
};

/** A nightstand (IKEA style): a flat birch case with two handleless drawers, each with a finger slot along its top edge */
const nightstand: Recipe = {
  params: { body: 'birch' },
  script: `(
    $base_ := 30;
    $dh := ($h - $base_ - 30) / 2;
    [
      $box([$w - 20, $base_, $d - 30], [0, 0 + $base_ / 2, -15], $body, 2),
      $box([$w, $h - $base_, $d - 18], [0, $base_ + ($h - $base_) / 2, -9], $body, 4),
      [0..1].(
        $i := $;
        $y := $base_ + 4 + $i * ($dh + 6);
        [
          $box([$w - 8, $dh, 18], [0, $y + $dh / 2, $d / 2 - 9], $body, 2),
          $noplan($box([$w * 0.4, 8, 4], [0, $y + $dh - 22 + 8 / 2, $d / 2 + 0.5], 'woodDark', 2))
        ]
      )
    ]
  )`,
};

/** A wardrobe (IKEA style): a white case on a recessed plinth, flat white doors about 50 cm wide, slim steel bar handles */
const wardrobe: Recipe = {
  params: { body: 'white' },
  script: `(
    $n := $max([1, $round($w / 500)]);
    $dw := $w / $n;
    [
      $box([$w - 40, 80, $d - 50], [0, 0 + 80 / 2, -10], $body, 3),
      $box([$w, $h - 80, $d - 20], [0, 80 + ($h - 80) / 2, -10], $body, 4),
      [0..$floor($n) - 1].(
        $i := $;
        $x := -$w / 2 + $dw * ($i + 0.5);
        $hx := $x + ($i % 2 ? -1 : 1) * ($dw / 2 - 45);
        [
          $box([$dw - 4, $h - 84, 18], [$x, 82 + ($h - 84) / 2, $d / 2 - 10], $body, 2),
          $rod([$hx, $h * 0.4, $d / 2 + 14], [$hx, $h * 0.58, $d / 2 + 14], 6, 'metal', 8)
        ]
      )
    ]
  )`,
};

/** A desk (IKEA style): a white top on a white drawer unit (left) and two round legs, a laptop, a mug and an arm lamp */
const desk: Recipe = {
  params: { body: 'white', decor: true },
  script: `(
    $dw := $min([360, $w * 0.32]);
    $dx := -$w / 2 + $dw / 2 + 20;
    $nd := 5;
    $dh := ($h - 50) / $nd;
    $lx := $w * 0.06;
    $lz := 20;
    $ax := $w / 2 - 140;
    $az := -$d / 2 + 110;
    [
      $box([$w, 36, $d], [0, $h - 36 + 36 / 2, 0], $body, 4),
      $box([$dw, $h - 36, $d - 40], [$dx, 0 + ($h - 36) / 2, -10], $body, 3),
      [0..$floor($nd) - 1].(
        $i := $;
        [
          $box([$dw - 6, $dh - 6, 14], [$dx, 14 + $i * $dh + ($dh - 6) / 2, $d / 2 - 23], $body, 2)
        ]
      ),
      [0..$floor($nd) - 1].(
        $i := $;
        [
          $noplan($box([$dw * 0.4, 10, 4], [$dx, 14 + $i * $dh + $dh - 26 + 10 / 2, $d / 2 - 14], 'dark', 2))
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $cylinder(25, $h - 36, [$w / 2 - 60, ($h - 36) / 2, $s * ($d / 2 - 60)], $body)
        ]
      ),
      ($decor ? [$box([330, 14, 230], [$lx, $h + 14 / 2, $lz], 'metal', 5)] : []),
      ($decor ? [$box([330, 220, 8], [$lx, $h + 115, $lz - 130], 'metal', 4, [-16, 0, 0])] : []),
      ($decor ? [$box([300, 190, 2], [$lx, $h + 117, $lz - 124], 'dark', 1, [-16, 0, 0])] : []),
      ($decor ? [$cylinder(40, 90, [-$w * 0.25, $h + 45, -100], 'ceramic')] : []),
      ($decor ? [$noplan($cylinder(70, 18, [$ax, $h + 9, $az], 'dark', {"seg": 28}))] : []),
      ($decor ? [$noplan($rod([$ax, $h + 18, $az], [$ax - 60, $h + 380, $az + 20], 8, 'dark'))] : []),
      ($decor ? [$noplan($rod([$ax - 60, $h + 380, $az + 20], [$ax - 230, $h + 330, $az + 90], 7, 'dark'))] : []),
      ($decor ? [$noplan($lathe([[0, 0], [75, 0], [70, 20], [35, 120], [0, 130]], [$ax - 250, $h + 210, $az + 100], 'dark'))] : [])
    ]
  )`,
};

/**
 * A bookcase (IKEA style): white units about 80 cm wide side by side, each with a toe kick and shelves full of books of
 * different heights and colors, a vase on every third shelf
 */
const bookcase: Recipe = {
  params: { body: 'white', decor: true },
  seed: 7,
  script: `(
    $t := 18;
    $kick := 60;
    $nu := $max([1, $round($w / 800)]);
    $uw := $w / $nu;
    $n := $max([2, $round(($h - $kick) / 360)]);
    $gap := ($h - $kick - $t) / $n;
    [
      [0..$floor($nu) - 1].(
        $u := $;
        $ux := -$w / 2 + $uw * ($u + 0.5);
        [
          $box([$t, $h, $d], [$ux - $uw / 2 + $t / 2, 0 + $h / 2, 0], $body, 2),
          $box([$t, $h, $d], [$ux + $uw / 2 - $t / 2, 0 + $h / 2, 0], $body, 2),
          $box([$uw - 4, $h, 6], [$ux, 0 + $h / 2, -$d / 2 + 3], $body, 1),
          $box([$uw - 2 * $t, $kick, 18], [$ux, 0 + $kick / 2, $d / 2 - 30], $body, 1),
          [0..$floor($n + 1) - 1].(
            $i := $;
            [
              $box([$uw - 2 * $t, $t, $d - 10], [$ux, $kick + $i * $gap + $t / 2, 5], $body, 2)
            ]
          ),
          [0..$floor($n) - 1].(
            $s := $;
            $y0 := $kick + $s * $gap + $t;
            $room := $gap - $t - 30;
            $vase := (($s + $u) % 3 = 1 ? 1 : 0);
            $start := $ux - $uw / 2 + $t + 10;
            $end := $ux + $uw / 2 - $t - ($vase ? 190 : 10);
            $nb := $floor(($end - $start) / 35);
            $bw := ($end - $start) / $nb;
            [
              [0..$floor($nb) - 1].(
                $k := $;
                $key := $u * 1000 + $s * 100 + $k;
                $bh := $room * (0.7 + $rnd($key) * 0.3);
                $bd := $d * (0.7 + $rnd($key + 0.5) * 0.15);
                $bwk := $bw * (0.6 + $rnd($key + 0.25) * 0.38);
                $c := $floor($rnd($key + 0.75) * 5);
                [
                  $rnd($key + 0.9) >= 0.08 ? [
                      $c = 0 ? [
                          $noplan($box([$bwk, $bh, $bd], [$start + $bw * ($k + 0.5), $y0 + $bh / 2, $d / 2 - $bd / 2 - 20], 'book1', 3))
                        ] : [],
                      $c = 1 ? [
                          $noplan($box([$bwk, $bh, $bd], [$start + $bw * ($k + 0.5), $y0 + $bh / 2, $d / 2 - $bd / 2 - 20], 'book2', 3))
                        ] : [],
                      $c = 2 ? [
                          $noplan($box([$bwk, $bh, $bd], [$start + $bw * ($k + 0.5), $y0 + $bh / 2, $d / 2 - $bd / 2 - 20], 'book3', 3))
                        ] : [],
                      $c = 3 ? [
                          $noplan($box([$bwk, $bh, $bd], [$start + $bw * ($k + 0.5), $y0 + $bh / 2, $d / 2 - $bd / 2 - 20], 'book4', 3))
                        ] : [],
                      $c = 4 ? [
                          $noplan($box([$bwk, $bh, $bd], [$start + $bw * ($k + 0.5), $y0 + $bh / 2, $d / 2 - $bd / 2 - 20], 'linen', 3))
                        ] : []
                    ] : []
                ]
              ),
              $vase ? [
                  ($decor ? [$cylinder(50, $min([220, $room * 0.8]), [$ux + $uw / 2 - $t - 95, $y0 + $min([220, $room * 0.8]) / 2, 0], 'ceramic', {"r2": 60})] : [])
                ] : []
            ]
          )
        ]
      )
    ]
  )`,
};

export const BEDROOM: Record<string, Recipe> = { bed18: bed, bed15: bed, bed12: bed, nightstand, wardrobe, desk, bookcase };
