"use client";

import { useState } from "react";

export function useTermsAgreement() {
  const [isChecked, setIsChecked] = useState(false);

  return { isChecked, setIsChecked };
}
