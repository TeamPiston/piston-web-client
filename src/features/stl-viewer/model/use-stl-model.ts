"use client";

import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export function useStlModel(url: string) {
  return useLoader(STLLoader, url);
}
