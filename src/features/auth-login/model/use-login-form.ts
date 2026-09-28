"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/entities/session";

export function useLoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const normalizedId = id.trim().toLowerCase();
    const isValidId = normalizedId === "admin" || normalizedId === "admin@example.com";

    if (!isValidId || password !== "1234") {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    login({
      id: "admin",
      email: "admin@example.com",
      name: "관리자",
    });
    router.push("/feed");
  };

  return {
    id,
    setId,
    password,
    setPassword,
    showPassword,
    togglePasswordVisibility,
    error,
    handleSubmit,
  };
}
