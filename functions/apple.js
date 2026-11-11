/* =========================================================================
   FIT KIT — Sign in with Apple REST API (thu hồi token khi xoá tài khoản)
   Tài liệu Apple:
   - Tạo client secret: https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
   - /auth/token  : https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
   - /auth/revoke : https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
   Không phụ thuộc thư viện ngoài (chỉ dùng crypto + fetch có sẵn trong Node ≥ 18).
   ========================================================================= */
"use strict";
const crypto = require("crypto");

const APPLE_ORIGIN = "https://appleid.apple.com";

const b64url = buf => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/* Chấp nhận nội dung file .p8 nguyên bản, bản bị dán thành 1 dòng có "\n", hoặc chỉ phần base64 */
function normalizePrivateKey(raw){
  let k = String(raw || "").trim().replace(/\\n/g, "\n");
  if(!k) throw new Error("APPLE_PRIVATE_KEY trống");
  if(!k.includes("BEGIN")){
    const body = k.replace(/\s+/g, "");
    k = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`;
  }
  return k;
}

/* Client secret = JWT ký ES256 bằng khoá .p8 (Apple cho phép sống tối đa 6 tháng; ở đây chỉ 5 phút) */
function makeClientSecret({ teamId, keyId, clientId, privateKey, now, ttlSec }){
  if(!teamId || !keyId || !clientId) throw new Error("Thiếu APPLE_TEAM_ID / APPLE_KEY_ID / client_id");
  const iat = Math.floor((now != null ? now : Date.now()) / 1000);
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat, exp: iat + (ttlSec || 300), aud: APPLE_ORIGIN, sub: clientId };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign("sha256", Buffer.from(input), { key: normalizePrivateKey(privateKey), dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(sig)}`;
}

class AppleError extends Error {
  constructor(step, status, body){
    super(`Apple ${step} thất bại (HTTP ${status}${body && body.error ? ": " + body.error : ""})`);
    this.step = step; this.status = status; this.appleError = body && body.error || null;
  }
}

async function postForm(path, params, fetchImpl){
  const f = fetchImpl || globalThis.fetch;
  const res = await f(APPLE_ORIGIN + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let json = null; try{ json = text ? JSON.parse(text) : null; }catch(e){ json = null; }
  return { ok: res.ok, status: res.status, json };
}

/* Đổi authorization code (lấy từ Sign in with Apple trên iOS) → refresh_token */
async function exchangeCode({ clientId, clientSecret, code, redirectUri }, fetchImpl){
  const params = { client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" };
  if(redirectUri) params.redirect_uri = redirectUri;
  const r = await postForm("/auth/token", params, fetchImpl);
  if(!r.ok) throw new AppleError("token", r.status, r.json);
  return r.json || {};
}

async function revokeToken({ clientId, clientSecret, token, hint }, fetchImpl){
  const r = await postForm("/auth/revoke", { client_id: clientId, client_secret: clientSecret, token, token_type_hint: hint }, fetchImpl);
  if(!r.ok) throw new AppleError("revoke", r.status, r.json);
  return true;
}

function decodeJwtPayload(jwt){
  try{ return JSON.parse(Buffer.from(String(jwt).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); }
  catch(e){ return null; }
}

/**
 * Thu hồi quyền của FIT KIT với Apple ID của người dùng.
 * @param {object} o
 *   teamId, keyId, privateKey  – từ Apple Developer (Key có quyền Sign in with Apple)
 *   clientIds                  – danh sách client_id thử lần lượt (VD [bundleId, servicesId])
 *   authorizationCode | refreshToken | accessToken – ít nhất 1 giá trị
 *   expectedSub                – (tuỳ chọn) Apple user id phải khớp id_token khi đổi code
 * @returns {{ via:string, clientId:string }}
 */
async function revokeAppleCredential(o, fetchImpl){
  const ids = (o.clientIds || []).filter(Boolean);
  if(!ids.length) throw new Error("Chưa cấu hình client_id của Apple");
  if(!o.authorizationCode && !o.refreshToken && !o.accessToken) throw new Error("Thiếu authorizationCode / refreshToken / accessToken");
  let lastErr = null;
  for(const clientId of ids){
    const clientSecret = makeClientSecret({ teamId: o.teamId, keyId: o.keyId, clientId, privateKey: o.privateKey });
    try{
      if(o.refreshToken){
        await revokeToken({ clientId, clientSecret, token: o.refreshToken, hint: "refresh_token" }, fetchImpl);
        return { via: "refresh_token", clientId };
      }
      if(o.authorizationCode){
        const t = await exchangeCode({ clientId, clientSecret, code: o.authorizationCode, redirectUri: o.redirectUri }, fetchImpl);
        if(o.expectedSub && t.id_token){
          const p = decodeJwtPayload(t.id_token);
          if(p && p.sub && p.sub !== o.expectedSub) throw new Error("Mã Apple không thuộc về tài khoản đang đăng nhập");
        }
        if(t.refresh_token){ await revokeToken({ clientId, clientSecret, token: t.refresh_token, hint: "refresh_token" }, fetchImpl); return { via: "authorization_code→refresh_token", clientId }; }
        if(t.access_token){ await revokeToken({ clientId, clientSecret, token: t.access_token, hint: "access_token" }, fetchImpl); return { via: "authorization_code→access_token", clientId }; }
        throw new Error("Apple không trả về token để thu hồi");
      }
      await revokeToken({ clientId, clientSecret, token: o.accessToken, hint: "access_token" }, fetchImpl);
      return { via: "access_token", clientId };
    }catch(e){
      lastErr = e;
      // Sai client_id (token cấp cho Services ID nhưng thử bằng Bundle ID hoặc ngược lại) → thử client_id kế tiếp
      if(e instanceof AppleError && (e.appleError === "invalid_client" || e.appleError === "invalid_grant")) continue;
      throw e;
    }
  }
  throw lastErr || new Error("Không thu hồi được token Apple");
}

module.exports = { makeClientSecret, normalizePrivateKey, exchangeCode, revokeToken, revokeAppleCredential, decodeJwtPayload, AppleError, APPLE_ORIGIN };
