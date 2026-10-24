/** SPIKE: the side table and the sofa as JSONata scripts with parameters (compare looks/living.ts) */
import type { ScriptRecipe } from '../script.js';

export const sidetableScript: ScriptRecipe = {
  params: { top: 'white', legs: 'white', vase: true },
  docs: { top: 'material of the top', legs: 'material of the legs', vase: 'a small vase on the top' },
  script: `(
    $t := 50;
    $l := 50;
    [
      $block([$w, $t, $d], 0, $h - $t, 0, $top, 4),
      $fourLegs($w, $d, $l / 2, $h - $t, $l / 2, $legs, true),
      $vase ? $lathe([[0, 0], [45, 0], [60, 60], [35, 150], [28, 180], [0, 180]], [$w * 0.15, $h, -$d * 0.1], 'ceramicShade') : []
    ]
  )`,
};

export const sofaScript: ScriptRecipe = {
  params: { fabric: 'fabric', cushion: 'cushion', feet: 'dark', armWidth: null, cushions: null },
  docs: {
    fabric: 'material of the frame, arms and back',
    cushion: 'material of the seat and back cushions',
    feet: 'material of the feet',
    armWidth: 'width of each arm in mm (null: about a tenth of the width, 140–240)',
    cushions: 'number of seat cushions (null: one per about 65 cm)',
  },
  script: `(
    $leg := 50;
    $arm := $armWidth ? $armWidth : $clamp($w * 0.11, 140, 240);
    $back := $min([200, $d * 0.22]);
    $baseTop := $leg + $min([220, $h * 0.27]);
    $seatTop := $max([$baseTop + 40, $min([$h * 0.55, 450])]);
    $armTop := $min([$h * 0.76, 630]);
    $inner := $w - 2 * $arm;
    $n := $cushions ? $cushions : $max([1, $floor($inner / 650 + 0.5)]);
    $cw := $inner / $n;
    $seatD := $d - $back - 30;
    [
      $fourLegs($w, $d, 60, $leg, 20, $feet, true),
      $block([$w - 20, $baseTop - $leg, $d - 20], 0, $leg, 0, $fabric, 40),
      [-1, 1].$block([$arm, $armTop - $leg, $d], $ * ($w - $arm) / 2, $leg, 0, $fabric, 90),
      $block([$inner + 40, $h - $baseTop - 40, $back], 0, $baseTop, -($d - $back) / 2, $fabric, 60),
      [0..$n - 1].(
        $x := -$inner / 2 + $cw * ($ + 0.5);
        [
          $block([$cw - 10, $seatTop - $baseTop, $seatD], $x, $baseTop, ($d - $seatD) / 2 - 15, $cushion, 70),
          $box([$cw - 10, ($h - $seatTop) * 0.98, 200], [$x, $seatTop + ($h - $seatTop) * 0.49, -$d / 2 + $back + 80], $cushion, 90, [-9, 0, 0])
        ]
      )
    ]
  )`,
};
