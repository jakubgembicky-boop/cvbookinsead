# Supabase Configuration (required for registration to work)

The registration flow uses a **6-digit code** (OTP), not a magic link. By default
Supabase emails a "Confirm your email" **link** — clicking it logs the user in
without a password and bounces them into a loop. You MUST switch the email
templates to send the code instead.

## 1. Email Templates → send the code, not a link

Dashboard → **Authentication** → **Emails** (a.k.a. Email Templates).

Edit **BOTH** of these templates and replace their entire body with the HTML below:

### Template: "Confirm signup"
(fires for a brand-new user on first registration)

```html
<h2>Confirm your INSEAD 26D Network registration</h2>
<p>Enter this 6-digit code to verify your email address:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0;">{{ .Token }}</p>
<p style="color:#888;font-size:13px;">This code expires in 1 hour. If you didn't request it, you can ignore this email.</p>
```

### Template: "Magic Link"
(fires if an already-registered user requests a code)

```html
<h2>Your INSEAD 26D Network sign-in code</h2>
<p>Enter this 6-digit code to continue:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0;">{{ .Token }}</p>
<p style="color:#888;font-size:13px;">This code expires in 1 hour. If you didn't request it, you can ignore this email.</p>
```

> The key change is `{{ .Token }}` (the 6-digit code) instead of
> `{{ .ConfirmationURL }}` (the magic link). Leave the **subject lines** as they are
> or set them to e.g. "Your INSEAD 26D verification code".

## 2. Reset-password template (forgot password)

The forgot-password flow still uses a link (that's correct — it redirects to the
`/reset-password` page). Leave the **"Reset Password"** template using
`{{ .ConfirmationURL }}`. No change needed.

## 3. Auth settings

Dashboard → **Authentication** → **Sign In / Providers** → **Email**:
- ✅ **Enable Email provider**
- ✅ **Confirm email** = ON
- **Secure email change** = ON (recommended)

Dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: `http://localhost:3000` (dev) — change to your Vercel URL in production
- **Redirect URLs**: add `http://localhost:3000/**` and your production URL `/**`

## 4. (Optional) Rate limits

Dashboard → **Authentication** → **Rate Limits**:
- The free SMTP sender is limited to a few emails/hour. For a real launch to ~40
  classmates, configure a custom SMTP provider (Resend, SendGrid, AWS SES) under
  **Project Settings → Auth → SMTP Settings**, otherwise verification emails will
  be throttled.

---

After these changes: registration sends a 6-digit code → user types it → sets a
password → done. No magic-link loop.
