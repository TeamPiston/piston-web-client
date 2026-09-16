"use client";

import { useState, type FormEvent } from "react";

export function useFindPwdForm() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (email.trim()) {
      console.log({ email });
      setIsSubmitted(true);
    }
  };

  return {
    email,
    setEmail,
    isSubmitted,
    handleSubmit,
  };
}
