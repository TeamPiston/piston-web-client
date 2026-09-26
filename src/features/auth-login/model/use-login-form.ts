"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/entities/session";

export function useLoginForm() {
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login();
  };

  return {
    id,
    setId,
    password,
    setPassword,
    showPassword,
    togglePasswordVisibility,
    handleSubmit,
  };
}
