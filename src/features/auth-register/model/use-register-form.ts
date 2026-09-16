"use client";

import { useState, type FormEvent } from "react";
import { isValidEmail, isValidId, isValidPassword } from "./validation";

export function useRegisterForm() {
  const [email, setEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [idTouched, setIdTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [timerStr] = useState("0:00");

  const emailValid = isValidEmail(email);
  const idValid = isValidId(id);
  const passwordValid = isValidPassword(password);
  const isFormValid =
    emailValid && idValid && passwordValid && authCode.length === 6 && !authError;

  const handleEmailAuth = () => {
    setEmailTouched(true);
    if (!emailValid) return;
    console.log("인증번호 발송 대상:", email);
  };

  const handleAuthConfirm = () => {
    setAuthError(true);
  };

  const handleAuthCodeChange = (value: string) => {
    setAuthCode(value.slice(0, 6));
    if (authError) setAuthError(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isFormValid) return;
    console.log("회원가입 완료:", { email, authCode, id, password });
  };

  return {
    email,
    setEmail,
    emailTouched,
    setEmailTouched,
    emailValid,
    authCode,
    authError,
    timerStr,
    handleAuthCodeChange,
    id,
    setId,
    idTouched,
    setIdTouched,
    idValid,
    password,
    setPassword,
    passwordTouched,
    setPasswordTouched,
    passwordValid,
    showPassword,
    togglePasswordVisibility,
    isFormValid,
    handleEmailAuth,
    handleAuthConfirm,
    handleSubmit,
  };
}
