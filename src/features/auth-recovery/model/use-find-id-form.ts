"use client";

import { useState, type FormEvent } from "react";

export function useFindIdForm() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (email.trim()) {
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
