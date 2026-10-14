"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HttpError } from "@/lib/http-error";
import {
  changePassword,
  deleteOwnAccount,
  login,
  logout,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
} from "@/lib/auth/service";
import { clearSessionCookie, requestMeta, SESSION_COOKIE, setSessionCookie } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionState = { error?: string; ok?: string; fields?: Record<string, string> } | null;

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value || "");
  if (!next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}

function fromError(error: unknown): ActionState {
  if (error instanceof HttpError) return { error: error.message, fields: error.fields };
  console.error("[action]", error);
  return { error: "Something went wrong" };
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const result = await signup(
      {
        email: formData.get("email"),
        password: formData.get("password"),
        name: formData.get("name") || "",
      },
      meta,
    );
    if (result.created && result.session) await setSessionCookie(result.session);
    if (!result.created) return { ok: result.message };
  } catch (error) {
    return fromError(error);
  }
  redirect("/account");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const next = safeNext(formData.get("next"));
  try {
    const meta = await requestMeta();
    const result = await login({ email: formData.get("email"), password: formData.get("password") }, meta);
    await setSessionCookie(result.session);
  } catch (error) {
    return fromError(error);
  }
  redirect(next);
}

export async function logoutAction() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUser();
  await logout(raw, user?.id);
  await clearSessionCookie();
  redirect("/");
}

export async function logoutEverywhereAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { deleteUserSessions } = await import("@/lib/auth/session");
  await deleteUserSessions(user.id);
  await clearSessionCookie();
  redirect("/login");
}

export async function forgotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const message = await requestPasswordReset(String(formData.get("email") || ""), meta.ip);
    return { ok: message };
  } catch (error) {
    return fromError(error);
  }
}

export async function resetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await resetPassword(String(formData.get("token") || ""), String(formData.get("password") || ""));
  } catch (error) {
    return fromError(error);
  }
  redirect("/login");
}

export async function verifyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await verifyEmail(String(formData.get("token") || ""));
  } catch (error) {
    return fromError(error);
  }
  redirect("/account");
}

export async function resendAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const meta = await requestMeta();
  await resendVerification(user.id, meta.ip);
  redirect("/account?sent=1");
}

export async function passwordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await changePassword(user.id, String(formData.get("current") || ""), String(formData.get("next") || ""));
    await clearSessionCookie();
  } catch (error) {
    return fromError(error);
  }
  redirect("/login");
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (String(formData.get("confirm") || "") !== "DELETE") {
    return { error: "Type DELETE to confirm." };
  }
  try {
    await deleteOwnAccount(user.id);
    await clearSessionCookie();
  } catch (error) {
    return fromError(error);
  }
  redirect("/");
}
