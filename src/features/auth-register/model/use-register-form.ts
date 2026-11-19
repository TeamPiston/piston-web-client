"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api";
import { useMountedRef } from "@/shared/lib";
import { isMockModeEnabled } from "@/shared/mock/mock-data";
import { sendVerificationCode, signup } from "../api/register";
import { isValidEmail, isValidId, isValidPassword } from "./validation";

export function useRegisterForm() {
  const [email, updateEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [id, updateId] = useState("");
  const [password, updatePassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [idTouched, setIdTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [timerStr] = useState("0:00");
  const [pendingAction, setPendingAction] = useState<"send" | "signup" | null>(null);
  const [requestError, setRequestError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [isSignupComplete, setIsSignupComplete] = useState(false);
  const activeRequestRef = useRef<{ action: "send" | "signup"; valid: boolean } | null>(null);
  const signupCompleteRef = useRef(false);
  const mountedRef = useMountedRef();
  const isMockMode = isMockModeEnabled();
  const isRegistrationAvailable = isMockMode ||
    process.env.NEXT_PUBLIC_ENABLE_REGISTRATION_API === "true";

  useEffect(() => {
    setPendingAction(activeRequestRef.current?.action ?? null);
    // A sent POST can still complete on the server. Invalidate UI delivery but
    // keep ownership until it settles, including during effect reconnection.
    return () => {
      if (activeRequestRef.current) activeRequestRef.current.valid = false;
    };
  }, []);

  const resetFeedback = () => {
    if (activeRequestRef.current !== null) return false;
    setRequestError("");
    setRequestMessage("");
    setIsSignupComplete(false);
    signupCompleteRef.current = false;
    return true;
  };

  const setEmail = (value: string) => {
    if (!resetFeedback()) return;
    updateEmail(value);
    if (!isMockMode) setAuthCode("");
  };
  const setId = (value: string) => {
    if (resetFeedback()) updateId(value);
  };
  const setPassword = (value: string) => {
    if (resetFeedback()) updatePassword(value);
  };

  const emailValid = isValidEmail(email);
  const idValid = isValidId(id);
  const passwordValid = isValidPassword(password);
  const isFormValid =
    emailValid && idValid && passwordValid && authCode.length === 6 && !authError;

  const handleEmailAuth = async () => {
    if (!mountedRef.current || activeRequestRef.current !== null || signupCompleteRef.current) return;
    setEmailTouched(true);
    if (!emailValid) return;
    if (isMockMode) return;
    if (!isRegistrationAvailable) return;

    const request = { action: "send" as const, valid: true };
    activeRequestRef.current = request;
    setPendingAction("send");
    setRequestError("");
    setRequestMessage("");
    try {
      await sendVerificationCode({ email });
      if (mountedRef.current && request.valid && activeRequestRef.current === request) {
        setRequestMessage("인증코드 발송 요청이 접수되었습니다. 이메일을 확인해 주세요.");
      }
    } catch (error) {
      if (mountedRef.current && request.valid && activeRequestRef.current === request) {
        setRequestError(error instanceof ApiError && error.kind === "network"
          ? "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."
          : "인증코드를 요청하지 못했습니다. 이메일을 확인하고 다시 시도해 주세요.");
      }
    } finally {
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null;
        if (mountedRef.current) {
          setPendingAction(null);
          if (!request.valid) setRequestError("화면 상태가 변경되어 이전 요청 결과를 표시할 수 없습니다. 이메일을 확인해 주세요.");
        }
      }
    }
  };

  const handleAuthConfirm = () => {
    if (isMockMode) setAuthError(true);
  };

  const handleAuthCodeChange = (value: string) => {
    if (!resetFeedback()) return;
    setAuthCode(value.slice(0, 6));
    if (authError) setAuthError(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mountedRef.current || activeRequestRef.current !== null || signupCompleteRef.current) return;
    if (!isFormValid) return;
    if (isMockMode) return;
    if (!isRegistrationAvailable) return;

    const request = { action: "signup" as const, valid: true };
    activeRequestRef.current = request;
    setPendingAction("signup");
    setRequestError("");
    setRequestMessage("");
    try {
      await signup({ email, id, password, code: authCode });
      if (mountedRef.current && request.valid && activeRequestRef.current === request) {
        signupCompleteRef.current = true;
        setIsSignupComplete(true);
        setRequestMessage("회원가입이 완료되었습니다. 로그인 화면으로 이동해 주세요.");
      }
    } catch (error) {
      if (mountedRef.current && request.valid && activeRequestRef.current === request) {
        let message = "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        if (error instanceof ApiError) {
          if (error.kind === "network") message = "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
          else if (error.status === 400) message = "입력 정보와 이메일 인증코드를 확인해 주세요.";
          else if (error.status === 409) message = "이미 사용 중인 정보가 있습니다. 이메일과 아이디를 확인해 주세요.";
        }
        setRequestError(message);
      }
    } finally {
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null;
        if (mountedRef.current) {
          setPendingAction(null);
          if (!request.valid) setRequestError("화면 상태가 변경되어 이전 요청 결과를 표시할 수 없습니다. 가입 여부를 확인해 주세요.");
        }
      }
    }
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
    isMockMode,
    isRegistrationAvailable,
    pendingAction,
    requestError,
    requestMessage,
    isSignupComplete,
  };
}
