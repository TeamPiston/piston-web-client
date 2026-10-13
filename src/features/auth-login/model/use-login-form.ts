"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/entities/session";
import { MOCK_LOGIN_CREDENTIALS, MOCK_USER_PROFILE } from "@/shared/mock/mock-data";

interface LoginCredentials {
  id: string;
  password: string;
}

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const credentials: LoginCredentials = {
      id: id.trim().toLowerCase(),
      password,
    };

    // Mock Auth only: replace this credential check with the backend login API response.
    const isValidId =
      credentials.id === MOCK_LOGIN_CREDENTIALS.id ||
      credentials.id === "admin@example.com";

    if (!isValidId || credentials.password !== MOCK_LOGIN_CREDENTIALS.password) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    login(MOCK_USER_PROFILE);
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
