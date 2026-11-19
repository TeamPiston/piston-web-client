import { apiClient } from "@/shared/api";

export interface SignupRequest {
  email: string;
  id: string;
  password: string;
  code: string;
}

export interface SendVerificationCodeRequest {
  email: string;
}

// The registration form maps its authCode field to this API's code field.
export async function signup(request: SignupRequest): Promise<void> {
  const { email, id, password, code } = request;
  await apiClient.post<unknown>("/signup", { email, id, password, code }, { skipAuth: true });
}

// The specification does not define a response body or one success status.
export async function sendVerificationCode(request: SendVerificationCodeRequest): Promise<void> {
  await apiClient.post<unknown>("/send", { email: request.email }, { skipAuth: true });
}
