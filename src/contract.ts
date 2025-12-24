import { Contract } from "./types";

export const defineContract = <const C extends Contract>(c: C): C => c;
