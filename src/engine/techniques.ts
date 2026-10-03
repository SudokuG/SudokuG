// The list of human techniques, easiest first.
//
// Every technique is a function (grid) => Step | null. The hint is simply the first
// technique in TECHNIQUES that finds something, so the order below decides which move
// a player is shown. The level is used for rating.
//
// To add a technique: write it in its own file (see fish.ts for a compact example),
// then insert it here at the right difficulty.

import { claiming, fullHouse, hiddenSingle, hiddenSubset, nakedSingle, nakedSubset, pointing } from "./basic";
import { aic, shortXChain, twoDigitChain, xChain, xyChain } from "./chains";
import { simpleColoring } from "./coloring";
import { fish } from "./fish";
import type { Technique } from "./types";
import { xyWing, xyzWing } from "./wings";

export type { CellDigit, Link, Step, Technique } from "./types";

export const TECHNIQUES: Technique[] = [
  fullHouse, //               1
  hiddenSingle, //            1
  nakedSingle, //             1
  pointing, //                2
  claiming, //                2
  nakedSubset(2, 3), //       Naked Pair
  hiddenSubset(2, 3.5), //    Hidden Pair
  nakedSubset(3, 4), //       Naked Triple
  hiddenSubset(3, 4.5), //    Hidden Triple
  fish(2, 5), //              X-Wing
  shortXChain(5.5), //        Skyscraper, 2-String Kite, Turbot Fish
  xyWing(6),
  simpleColoring(6.5),
  xyzWing(6.5),
  fish(3, 7), //              Swordfish
  nakedSubset(4, 7.5), //     Naked Quad
  hiddenSubset(4, 8), //      Hidden Quad
  xChain(8), //               one digit
  twoDigitChain(8.25), //     two digits
  fish(4, 8.5), //            Jellyfish
  xyChain(9), //              usually three or more digits
  aic(10), //                 Alternating Inference Chain, usually three or more digits
];
