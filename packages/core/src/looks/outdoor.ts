/** Yard and roof: courtyard tree, car, rocking chair, garden table and stool, planters, solar heater, water tank, drying rack, canopy, awning */
import type { Recipe } from '../script.js';

/** A birch: a slim white trunk with dark marks, two leaning stems, a light, airy crown of small clumps in two greens */
const tree: Recipe = {
  seed: 5,
  script: `(
    $r := $min([$w, $d]) / 2;
    $trunkH := $h * 0.42;
    $tr := $max([90, $r * 0.06]);
    $cy := $h * 0.68;
    $ry := $min([$h * 0.22, $h - $cy - $r * 0.25]);
    [
      $cylinder($tr * 1.1, $trunkH, [0, $trunkH / 2, 0], 'white', {"r2": $tr * 0.8, "seg": 12}),
      [0..5].(
        $i := $;
        [
          $noplan($cylinder($tr * 1.06, 25, [0, $trunkH * (0.15 + $i * 0.13), 0], 'dark', {"seg": 12, "scale": [1, 1, 0.98]}))
        ]
      ),
      $rod([0, $trunkH * 0.95, 0], [-$h * 0.34 * $sin(18) * $cos(30), $trunkH * 0.95 + $h * 0.34 * $cos(18), $h * 0.34 * $sin(18) * $sin(30)], $tr * 0.55, 'white', 8),
      $rod([0, $trunkH * 0.95, 0], [-$h * 0.32 * $sin(22) * $cos(200), $trunkH * 0.95 + $h * 0.32 * $cos(22), $h * 0.32 * $sin(22) * $sin(200)], $tr * 0.55, 'white', 8),
      [0..21].(
        $i := $;
        $t := ($i + 0.5) / 22;
        $yy := 1 - 2 * $t;
        $ring_ := $sqrt(1 - $yy * $yy);
        $a := $i * 137.508;
        $rr := $r * (0.27 + 0.08 * $rnd($i));
        [
          $i % 3 ? [
              $sphere($rr, [$cos($a) * $ring_ * $r * 0.72, $cy + $yy * $ry, $sin($a) * $ring_ * $r * 0.72], 'leaf2', [1, 0.85, 1])
            ] : [
              $sphere($rr, [$cos($a) * $ring_ * $r * 0.72, $cy + $yy * $ry, $sin($a) * $ring_ * $r * 0.72], 'leaf', [1, 0.85, 1])
            ]
        ]
      )
    ]
  )`,
};

/** A car heading east: a body with wheel arches and a sloping bonnet, a tinted glass cabin under a body-colored roof, wheels, lights */
const car: Recipe = {
  params: { body: 'carBody' },
  script: `(
    $L := $w / 2;
    $R := $min([360, $h * 0.2]);
    $clear := $R * 0.55;
    $belt := $h * 0.52;
    $b := 60;
    $wx := $L * 0.62;
    $arch := $R * 1.18;
    $bl := $L - $b;
    $top := $belt - $b;
    $bot := $clear + $b;
    $roof := $h - 50;
    $wsBase := $L * 0.32;
    $wsTop := -$L * 0.08;
    $rwTop := -$L * 0.58;
    $rwBase := -$L * 0.8;
    [
      $extrude('side', [[-$bl + 120, $bot], [-$wx - $arch, $bot], [-$wx - $arch, $R], {"arc": [-$wx, $R, $arch, 180, 0, true]}, [-$wx + $arch, $bot], [$wx - $arch, $bot], [$wx - $arch, $R], {"arc": [$wx, $R, $arch, 180, 0, true]}, [$wx + $arch, $bot], [$bl - 120, $bot], {"curve": [$bl, $bot, $bl, $bot + 120]}, [$bl, $top - 200], {"curve": [$bl - 100, $top - 20, $bl - 600, $top]}, [-$bl + 200, $top], {"curve": [-$bl, $top, -$bl, $top - 150]}, [-$bl, $bot + 120], {"curve": [-$bl, $bot, -$bl + 120, $bot]}], $d - 2 * $b, $body, $b),
      $extrude('side', [[$rwBase, $belt - 40], [$wsBase, $belt - 40], [$wsTop + 120, $roof - 120], {"curve": [$wsTop, $roof - 70, $wsTop - 150, $roof - 70]}, [$rwTop + 150, $roof - 70], {"curve": [$rwTop, $roof - 70, $rwTop - 80, $roof - 140]}], $d - 340, 'carGlass', 40),
      $box([$wsTop - $rwTop + 120, 50, $d - 200], [($wsTop + $rwTop) / 2, $roof - 30, 0], $body, 25),
      $noplan($box([100, $roof - $belt, $d - 220], [($wsTop + $rwTop) / 2 + 50, ($belt + $roof) / 2 - 20, 0], $body, 20)),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $cylinder($R, 220, [$sx * $wx, $R, $sz * ($d / 2 - 150)], 'tyre', {"axis": 'z', "seg": 28}),
          $cylinder($R * 0.6, 20, [$sx * $wx, $R, $sz * ($d / 2 - 150) + $sz * 110], 'metal', {"axis": 'z', "seg": 24})
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([80, 90, 380], [$L - 30, $top - 240, $s * ($d / 2 - 320)], 'headlight', 30),
          $box([80, 100, 340], [-$L + 20, $top - 100, $s * ($d / 2 - 300)], 'taillight', 30)
        ]
      )
    ]
  )`,
};

/** A rocking chair facing south (IKEA style garden furniture in stained acacia): curved runners, a slatted seat and back, arms */
const rocker: Recipe = {
  params: { wood: 'woodDark' },
  script: `(
    $R := $d * 1.4;
    $seat := $min([420, $h * 0.46]);
    $sx := $w / 2 - 40;
    $sd := $d * 0.46;
    $lean := 20;
    $bl := $h - $seat;
    $bz := $d * 0.2 - $sd;
    [
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $tube([[$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 0 / 12) * (-$d / 2 + $d * 0 / 12)), -$d / 2 + $d * 0 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 1 / 12) * (-$d / 2 + $d * 1 / 12)), -$d / 2 + $d * 1 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 2 / 12) * (-$d / 2 + $d * 2 / 12)), -$d / 2 + $d * 2 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 3 / 12) * (-$d / 2 + $d * 3 / 12)), -$d / 2 + $d * 3 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 4 / 12) * (-$d / 2 + $d * 4 / 12)), -$d / 2 + $d * 4 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 5 / 12) * (-$d / 2 + $d * 5 / 12)), -$d / 2 + $d * 5 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 6 / 12) * (-$d / 2 + $d * 6 / 12)), -$d / 2 + $d * 6 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 7 / 12) * (-$d / 2 + $d * 7 / 12)), -$d / 2 + $d * 7 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 8 / 12) * (-$d / 2 + $d * 8 / 12)), -$d / 2 + $d * 8 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 9 / 12) * (-$d / 2 + $d * 9 / 12)), -$d / 2 + $d * 9 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 10 / 12) * (-$d / 2 + $d * 10 / 12)), -$d / 2 + $d * 10 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 11 / 12) * (-$d / 2 + $d * 11 / 12)), -$d / 2 + $d * 11 / 12], [$s * $sx, 25 + $R - $sqrt($R * $R - (-$d / 2 + $d * 12 / 12) * (-$d / 2 + $d * 12 / 12)), -$d / 2 + $d * 12 / 12]], 22, $wood),
          $rod([$s * $sx, 60, $d * 0.22], [$s * $sx, $seat, $d * 0.2], 18, $wood),
          $rod([$s * $sx, 60, -$d * 0.22], [$s * $sx, $seat - 30, -$d * 0.18], 18, $wood),
          $rod([$s * $sx, $seat, $d * 0.2], [$s * $sx, $seat + 220, $d * 0.2], 15, $wood),
          $box([60, 30, $d * 0.5], [$s * $sx, $seat + 230, 0], $wood, 10)
        ]
      ),
      [0..5].(
        $i := $;
        [
          $box([$w - 60, 20, $sd / 6 - 10], [0, $seat - $i / 5 * 40, $d * 0.2 - $sd / 6 * ($i + 0.5)], $wood, 5)
        ]
      ),
      [0..4].(
        $i := $;
        [
          $box([60, $bl, 20], [-$w / 2 + 80 + ($w - 160) / 4 * $i, $seat - 40 + $bl / 2 * $cos($lean), $bz - $bl / 2 * $sin($lean)], $wood, 8, [-$lean, 0, 0])
        ]
      ),
      $box([$w - 40, 60, 30], [0, $seat - 70 + $bl * $cos($lean), $bz - $bl * $sin($lean) + 10], $wood, 10, [-$lean, 0, 0])
    ]
  )`,
};

/** A round garden table (IKEA style, stained acacia): a slatted top in a frame, an apron and four legs */
const stonetable: Recipe = {
  params: { wood: 'woodDark' },
  script: `(
    $r := $min([$w, $d]) / 2;
    $n := $max([5, $round($r * 2 / 90)]);
    $sw := $r * 2 / $n;
    [
      $ring($r - 25, 25, [0, $h - 25, 0], $wood),
      [0..$floor($n) - 1].(
        $i := $;
        $x := -$r + $sw * ($i + 0.5);
        $len := 2 * $sqrt($max([0, ($r - 45) * ($r - 45) - ($abs($x) + $sw / 2) * ($abs($x) + $sw / 2)]));
        [
          $len > 40 ? [
              $box([$sw - 12, 24, $len], [$x, $h - 12, 0], $wood, 4)
            ] : []
        ]
      ),
      $cylinder($r * 0.82, 70, [0, $h - 60, 0], $wood, {"seg": 36}),
      [0..3].(
        $i := $;
        $a := $i * 90 + 45;
        [
          $box([50, $h - 30, 50], [$cos($a) * $r * 0.6, ($h - 30) / 2, $sin($a) * $r * 0.6], $wood, 6)
        ]
      )
    ]
  )`,
};

/** A garden stool (IKEA style, stained acacia): a slatted square seat on four legs with cross rails */
const stool: Recipe = {
  params: { wood: 'woodDark' },
  script: `(
    $n := 4;
    $sw := $d / $n;
    [
      [0..$floor($n) - 1].(
        $i := $;
        [
          $box([$w, 24, $sw - 12], [0, $h - 24 + 24 / 2, -$d / 2 + $sw * ($i + 0.5)], $wood, 4)
        ]
      ),
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $box([22 * 2, $h - 24, 22 * 2], [$sx * ($w / 2 - 30), ($h - 24) / 2, $sz * ($d / 2 - 30)], $wood, 22 * 0.3)
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w - 60, 40, 22], [0, $h * 0.25 + 40 / 2, $s * ($d / 2 - 30)], $wood, 3)
        ]
      )
    ]
  )`,
};

/** A solar water heater: a tank across the top and a row of glass tubes sloping down to the south, on a metal frame */
const solar: Recipe = {
  script: `(
    $tr := $min([220, $h * 0.17]);
    $ty := $h - $tr;
    $tz := -$d / 2 + $tr;
    $n := $max([4, $floor(($w - 160) / 75)]);
    $fz := $d / 2 - 50;
    [
      $cylinder($tr, $w, [0, $ty, $tz], 'metal', {"axis": 'x', "seg": 28}),
      [0..$floor($n) - 1].(
        $i := $;
        [
          $rod([-$w / 2 + 80 + ($w - 160) / ($n - 1) * $i, $ty - $tr * 0.6, $tz + $tr * 0.6], [-$w / 2 + 80 + ($w - 160) / ($n - 1) * $i, 200, $fz], 26, 'tube', 10)
        ]
      ),
      $rod([-$w / 2 + 40, 200, $fz], [$w / 2 - 40, 200, $fz], 25, 'metal'),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * ($w / 2 - 40), 170, $fz], [$s * ($w / 2 - 40), $ty - 50, $tz + 50], 15, 'metal'),
          $rod([$s * ($w / 2 - 40), 0, $fz], [$s * ($w / 2 - 40), 200, $fz], 15, 'metal'),
          $rod([$s * ($w / 2 - 40), 0, $tz], [$s * ($w / 2 - 40), $ty - $tr, $tz], 15, 'metal'),
          $rod([$s * ($w / 2 - 40), 20, $fz], [$s * ($w / 2 - 40), 20, $tz], 12, 'metal')
        ]
      )
    ]
  )`,
};

/** A rooftop water tank: a ribbed white drum with a domed top on a dark steel stand */
const watertank: Recipe = {
  params: { body: 'white' },
  script: `(
    $r := $min([$w, $d]) / 2 - 20;
    $stand := $min([400, $h * 0.28]);
    $top := $h - 60;
    [
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        [
          $cylinder(25 * 0.8, $stand, [$sx * ($r * 1.5 / 2 - 20), $stand / 2, $sz * ($r * 1.5 / 2 - 20)], 'iron', {"r2": 25, "seg": 12})
        ]
      ),
      $ring($r * 0.72, 20, [0, $stand, 0], 'iron'),
      $lathe([[0, $stand], [$r, $stand], [$r, $top - $r * 0.25], [$r * 0.85, $top - $r * 0.08], [$r * 0.3, $top], [0, $top]], [0, 0, 0], $body),
      $cylinder(120, 60, [0, $top + 25, 0], $body),
      $ring($r + 5, 12, [0, $stand + ($top - $stand) * 0.33, 0], $body),
      $ring($r + 5, 12, [0, $stand + ($top - $stand) * 0.62, 0], $body)
    ]
  )`,
};

/** A drying rack (IKEA style): white steel end frames, three rails, some laundry */
const dryrack: Recipe = {
  params: { frame: 'white' },
  script: `(
    $x := $w / 2 - 30;
    $z := $d / 2 - 40;
    [
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * $x, 0, -$z], [$s * $x, $h, -$z * 0.3], 16, $frame),
          $rod([$s * $x, 0, $z], [$s * $x, $h, $z * 0.3], 16, $frame),
          $rod([$s * $x, $h, -$z * 0.5], [$s * $x, $h, $z * 0.5], 14, $frame),
          $rod([$s * $x, 20, -$z], [$s * $x, 20, $z], 14, $frame)
        ]
      ),
      $rod([-$x, $h - 10, -$z * 0.5], [$x, $h - 10, -$z * 0.5], 11, $frame),
      $rod([-$x, $h - 10, 0], [$x, $h - 10, 0], 11, $frame),
      $rod([-$x, $h - 10, $z * 0.5], [$x, $h - 10, $z * 0.5], 11, $frame),
      $box([$w * 0.22, $min([750, $h * 0.6]), 12], [-$w * 0.3, $h - 20 - $min([750, $h * 0.6]) / 2, -$z * 0.5], 'bedding', 4),
      $box([$w * 0.16, $min([500, $h * 0.6]), 12], [-$w * 0.02, $h - 20 - $min([500, $h * 0.6]) / 2, 0], 'linen', 4),
      $box([$w * 0.2, $min([620, $h * 0.6]), 12], [$w * 0.22, $h - 20 - $min([620, $h * 0.6]) / 2, $z * 0.5], 'canvas2', 4),
      $box([$w * 0.1, $min([400, $h * 0.6]), 12], [$w * 0.36, $h - 20 - $min([400, $h * 0.6]) / 2, -$z * 0.5], 'fabric', 4)
    ]
  )`,
};

/** A canopy (IKEA style gazebo): four slim dark steel posts, beams and an off-white fabric roof falling gently to the south */
const canopy: Recipe = {
  params: { fabric: 'canvas', frame: 'iron' },
  script: `(
    $fall := $min([250, $h * 0.1]);
    $post := 60;
    $slope := $atan2($fall, $d);
    $len := $hypot($d, $fall);
    [
      [0..3].(
        $i := $;
        $sx := $i % 2 * 2 - 1;
        $sz := $floor($i / 2) * 2 - 1;
        $ph := $h - ($sz > 0 ? $fall : 0) - 60;
        [
          $box([$post, $ph, $post], [$sx * ($w / 2 - $post / 2), 0 + $ph / 2, $sz * ($d / 2 - $post / 2)], $frame, 10)
        ]
      ),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([60, 100, $len], [$s * ($w / 2 - $post / 2), $h - $fall / 2 - 90, 0], $frame, 10, [$slope, 0, 0]),
          $box([$w, 100, 60], [0, $h - 90 - ($s > 0 ? $fall : 0), $s * ($d / 2 - $post / 2)], $frame, 10)
        ]
      ),
      $box([$w + 100, 30, $len + 100], [0, $h - $fall / 2 - 20, 0], $fabric, 10, [$slope, 0, 0])
    ]
  )`,
};

/** A retractable awning out from the wall (north): a white cassette, plain light grey canvas falling to the south, a front bar and arms */
const awning2: Recipe = {
  params: { fabric: 'fabric' },
  script: `(
    $y0 := $h - 80;
    $z0 := -$d / 2 + 140;
    $y1 := 60;
    $z1 := $d / 2 - 30;
    $len := $hypot($z1 - $z0, $y0 - $y1);
    $slope := $atan2($y0 - $y1, $z1 - $z0);
    [
      $box([$w, 140, 160], [0, $h - 140 + 140 / 2, -$d / 2 + 80], 'white', 30),
      $box([$w - 20, 8, $len], [0, ($y0 + $y1) / 2, ($z0 + $z1) / 2], $fabric, 2, [$slope, 0, 0]),
      $box([$w - 20, 100, 8], [0, $y1 - 100 + 100 / 2, $z1], $fabric, 2),
      $box([$w, 40, 50], [0, $y1, $z1 - 10], 'white', 10),
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $rod([$s * ($w / 2 - 80), $y0 - 40, $z0], [$s * ($w / 2 - 150), ($y0 + $y1) / 2 - 50, ($z0 + $z1) / 2], 15, 'metal'),
          $rod([$s * ($w / 2 - 150), ($y0 + $y1) / 2 - 50, ($z0 + $z1) / 2], [$s * ($w / 2 - 80), $y1 - 10, $z1 - 30], 15, 'metal')
        ]
      )
    ]
  )`,
};

/** A raised bed (IKEA style): a planter box of stained acacia boards, soil, shrubs and flowers */
const planter: Recipe = {
  params: { wood: 'woodDark' },
  seed: 7,
  script: `(
    $t := 40;
    $n := $max([1, $round(($w - 2 * $t) * ($d - 2 * $t) / 120000)]);
    [
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w, $h, $t], [0, 0 + $h / 2, $s * ($d / 2 - $t / 2)], $wood, 4),
          $box([$t, $h, $d], [$s * ($w / 2 - $t / 2), 0 + $h / 2, 0], $wood, 4)
        ]
      ),
      [0..$floor($max([1, $floor($h / 120)])) - 1].(
        $i := $;
        [
          [0..1].(
            $i := $;
            $s := $i * 2 - 1;
            [
              $noplan($box([$w + 2, 6, $t + 2], [0, ($i + 1) * $h / ($floor($h / 120) + 1) + 6 / 2, $s * ($d / 2 - $t / 2)], 'dark', 2))
            ]
          )
        ]
      ),
      $box([$w - 2 * $t, $h - 60, $d - 2 * $t], [0, 0 + ($h - 60) / 2, 0], 'soil', 5),
      [0..$floor($n) - 1].(
        $i := $;
        $r := $min([120 + $rnd($i + 0.6) * 100, ($min([$w, $d]) - 2 * $t) / 2]);
        $x := ($rnd($i) - 0.5) * $max([0, $w - 2 * $t - 2.8 * $r]);
        $z := ($rnd($i + 0.3) - 0.5) * $max([0, $d - 2 * $t - 2.8 * $r]);
        [
          $rnd($i + 0.1) < 0.5 ? [
              $sphere($r, [$x, $h - 60 + $r * 0.6, $z], 'leaf', [1, 0.85, 1])
            ] : [
              $sphere($r, [$x, $h - 60 + $r * 0.6, $z], 'leaf2', [1, 0.85, 1])
            ],
          $rnd($i + 0.8) < 0.5 ? [
              $sphere(35, [$x + $r * 0.4, $h - 60 + $r * 1.2, $z + $r * 0.3], 'flower')
            ] : []
        ]
      )
    ]
  )`,
};

/** A raised bed (IKEA style): a planter box of stained acacia boards, soil, shrubs and flowers */
const bed: Recipe = {
  params: { wood: 'woodDark' },
  seed: 11,
  script: `(
    $t := 40;
    $n := $max([1, $round(($w - 2 * $t) * ($d - 2 * $t) / 120000)]);
    [
      [0..1].(
        $i := $;
        $s := $i * 2 - 1;
        [
          $box([$w, $h, $t], [0, 0 + $h / 2, $s * ($d / 2 - $t / 2)], $wood, 4),
          $box([$t, $h, $d], [$s * ($w / 2 - $t / 2), 0 + $h / 2, 0], $wood, 4)
        ]
      ),
      [0..$floor($max([1, $floor($h / 120)])) - 1].(
        $i := $;
        [
          [0..1].(
            $i := $;
            $s := $i * 2 - 1;
            [
              $noplan($box([$w + 2, 6, $t + 2], [0, ($i + 1) * $h / ($floor($h / 120) + 1) + 6 / 2, $s * ($d / 2 - $t / 2)], 'dark', 2))
            ]
          )
        ]
      ),
      $box([$w - 2 * $t, $h - 60, $d - 2 * $t], [0, 0 + ($h - 60) / 2, 0], 'soil', 5),
      [0..$floor($n) - 1].(
        $i := $;
        $r := $min([120 + $rnd($i + 0.6) * 100, ($min([$w, $d]) - 2 * $t) / 2]);
        $x := ($rnd($i) - 0.5) * $max([0, $w - 2 * $t - 2.8 * $r]);
        $z := ($rnd($i + 0.3) - 0.5) * $max([0, $d - 2 * $t - 2.8 * $r]);
        [
          $rnd($i + 0.1) < 0.5 ? [
              $sphere($r, [$x, $h - 60 + $r * 0.6, $z], 'leaf', [1, 0.85, 1])
            ] : [
              $sphere($r, [$x, $h - 60 + $r * 0.6, $z], 'leaf2', [1, 0.85, 1])
            ],
          $rnd($i + 0.8) < 0.5 ? [
              $sphere(35, [$x + $r * 0.4, $h - 60 + $r * 1.2, $z + $r * 0.3], 'flower')
            ] : []
        ]
      )
    ]
  )`,
};

export const OUTDOOR: Record<string, Recipe> = { tree, car, rocker, stonetable, stool, solar, watertank, dryrack, canopy, awning2, planter, bed };
