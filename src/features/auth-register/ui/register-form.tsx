"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRegisterForm } from "../model/use-register-form";

export function RegisterForm() {
  const {
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
  } = useRegisterForm();

  return (
    <form onSubmit={handleSubmit} className="box-border w-full max-w-[500px] space-y-5 text-sm">
      {!isRegistrationAvailable && (
        <p role="status" className="text-sm text-gray-600">회원가입 서비스 준비 중입니다. 현재 가입 및 인증코드 발송을 이용할 수 없습니다.</p>
      )}
      <fieldset disabled={pendingAction !== null || isSignupComplete} className="space-y-5" aria-busy={pendingAction !== null}>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label className="font-medium text-[#171717]">이메일</label>
            {emailTouched && !emailValid && email.length > 0 && (
              <span className="text-[11px] text-red-500 font-medium">올바른 이메일 형식이 아닙니다.</span>
            )}
          </div>
          <div className="flex min-w-0 gap-2">
            <input
              type="email"
              placeholder="예: s25045@gsm.hs.kr"
              value={email}
              onBlur={() => setEmailTouched(true)}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTouched(true);
              }}
              className={`flex-1 h-12 px-4 border rounded-md transition-colors focus:outline-none ${
                emailTouched && !emailValid && email.length > 0
                  ? "border-red-400 bg-red-50/10 focus:border-red-500"
                  : "border-gray-300 bg-gray-50/50 focus:border-blue-500"
              }`}
            />
            <button
              type="button"
              onClick={handleEmailAuth}
              disabled={!emailValid || !isRegistrationAvailable}
              className={`w-20 h-12 text-white rounded-md font-medium transition-colors ${
                emailValid
                  ? "bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {pendingAction === "send" ? "요청 중..." : "인증"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label className="font-medium text-[#171717]">인증번호</label>
            {authError && (
              <span className="text-[11px] text-red-500 font-medium">올바른 인증번호가 아닙니다.</span>
            )}
          </div>
          <div className="flex min-w-0 gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={6}
                placeholder="인증번호 6자리를 입력해 주세요."
                value={authCode}
                onChange={(e) => handleAuthCodeChange(e.target.value)}
                className={`w-full h-12 pl-4 pr-16 border rounded-md transition-colors focus:outline-none ${
                  authError
                    ? "border-red-400 bg-red-50/10 focus:border-red-500"
                    : "border-gray-300 bg-gray-50/50 focus:border-blue-500"
                }`}
              />
              {isMockMode && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium">
                {timerStr}
              </span>}
            </div>
            {isMockMode && <button
              type="button"
              onClick={handleAuthConfirm}
              disabled={authCode.length !== 6}
              className={`w-20 h-12 text-white rounded-md font-bold transition-all ${
                authCode.length === 6
                  ? "bg-[#00E1AD] hover:opacity-90 cursor-pointer"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              완료
            </button>}
          </div>
          {!isMockMode && <p className="text-xs text-gray-500">인증코드는 회원가입 제출 시 서버에서 확인합니다.</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label className="font-medium text-[#171717]">아이디 - 4자 이상</label>
            {idTouched && !idValid && id.length > 0 && (
              <span className="text-[11px] text-red-500 font-medium">올바른 아이디 형식이 아닙니다.</span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              maxLength={12}
              placeholder="아이디를 입력해 주세요."
              value={id}
              onBlur={() => setIdTouched(true)}
              onChange={(e) => {
                setId(e.target.value);
                setIdTouched(true);
              }}
              className={`w-full h-12 pl-4 pr-16 border rounded-md transition-colors focus:outline-none ${
                idTouched && !idValid && id.length > 0
                  ? "border-red-400 bg-red-50/10 focus:border-red-500"
                  : "border-gray-300 bg-gray-50/50 focus:border-blue-500"
              }`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
              {id.length} / 12
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label className="font-medium text-[#171717]">비밀번호 - 4자 이상</label>
            {passwordTouched && !passwordValid && password.length > 0 && (
              <span className="text-[11px] text-red-500 font-medium">올바른 비밀번호 형식이 아닙니다.</span>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              maxLength={20}
              placeholder="비밀번호를 입력해 주세요."
              value={password}
              onBlur={() => setPasswordTouched(true)}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordTouched(true);
              }}
              className={`w-full h-12 pl-4 pr-24 border rounded-md transition-colors focus:outline-none ${
                passwordTouched && !passwordValid && password.length > 0
                  ? "border-red-400 bg-red-50/10 focus:border-red-500"
                  : "border-gray-300 bg-gray-50/50 focus:border-blue-500"
              }`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <span className="text-xs text-gray-400 font-medium select-none">
                {password.length} / 20
              </span>
            </div>
          </div>
          <p className="text-[11px] text-blue-600 font-medium mt-0.5 ml-auto select-none">
            ★ 비밀번호 변경은 불가하며, 특수 문자 1개를 포함해야 합니다.
          </p>
        </div>

        <button
          type="submit"
          disabled={!isFormValid || !isRegistrationAvailable}
          className={`w-full h-12 mt-4 rounded-md font-bold text-white transition-all ${
            isFormValid
              ? "bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-md"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {pendingAction === "signup" ? "가입 요청 중..." : "회원가입"}
        </button>
      </fieldset>
      {requestError && <p role="alert" className="text-sm text-red-500">{requestError}</p>}
      {requestMessage && <p role="status" className="text-sm text-gray-600">{requestMessage}</p>}
      {isSignupComplete && <a href="/login" className="inline-block text-sm text-blue-600 underline">로그인 화면으로 이동</a>}
    </form>
  );
}
