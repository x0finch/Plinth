/**
 * Names written on the ground of the 3D model, given by the page that shows it (the style gallery names each specimen in front
 * of it). They are part of the view, not of the project: nothing here is saved.
 */
import { createContext } from 'react';

export interface GroundLabelSpec {
  name: string;
  level: string;
  /** Centre of the far (north) edge of the lettering (mm); the name reads from the south, the plan's bottom */
  at: [number, number];
  /** Width the name may take (mm): a long name is written smaller */
  width: number;
  /** What picking the name selects */
  pick: string;
}

export const GroundLabels = createContext<GroundLabelSpec[]>([]);
