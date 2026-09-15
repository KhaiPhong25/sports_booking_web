# User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trang `/profile` cho phép người dùng cập nhật thông tin, quản lý ảnh đại diện trong MinIO local và đổi mật khẩu an toàn.

**Architecture:** Mở rộng identity model bằng metadata avatar nullable, giữ binary trong MinIO và sinh URL tương đối từ public user projection. NestJS cung cấp API hồ sơ/ảnh/mật khẩu; frontend vanilla JS dùng một profile client chuyên biệt, đồng bộ lại session user và render theo Urban Performance design system.

**Tech Stack:** PostgreSQL 17, Prisma 6, NestJS 11, Argon2, MinIO/S3-compatible SDK, Vite 7, vanilla JavaScript, CSS, Jest/Supertest, Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-09-14-user-profile-design.md`

## Global Constraints

- Chỉ dùng hạ tầng miễn phí/self-hosted hiện có: PostgreSQL, MinIO, NestJS, Prisma và Argon2; không gọi CDN, AWS S3 trả phí hoặc API thương mại.
- Giữ frontend là HTML/CSS/vanilla JavaScript ES modules; không thêm React/Vue/Angular.
- Email và role chỉ đọc; chỉ `displayName` và `phone` được chỉnh trong hồ sơ.
- Avatar chỉ nhận JPEG/PNG/WebP tối đa 2 MiB và phải kiểm tra cả MIME lẫn file signature.
- Mật khẩu mới dài 12–128 ký tự; đổi mật khẩu phải revoke mọi refresh session, tăng `securityVersion` và buộc đăng nhập lại.
- Không đưa `docs/project-deep-dive.md` đang untracked vào bất kỳ commit nào.

---

## File map

- `apps/api/prisma/schema.prisma` và migration mới: metadata avatar trên `User`.
- `apps/api/src/auth/public-user.ts`: một nơi duy nhất chuyển `IdentityUser` thành response an toàn.
- `apps/api/src/auth/identity.repository.ts`, `prisma-identity.repository.ts`, `testing/in-memory-identity.repository.ts`: persistence contract cho avatar và password/session invalidation.
- `apps/api/src/storage/user-avatar-policy.ts`: key, giới hạn và kiểm tra chữ ký file.
- `apps/api/src/users/user-avatars.controller.ts`: upload/delete/read avatar.
- `apps/api/src/users/users.controller.ts`, `users.service.ts`: profile và password application flow.
- `apps/web/src/services/profile-api.js`: giao tiếp `/me`, đồng bộ session client.
- `apps/web/src/pages/profile.js`: markup và event handling riêng cho trang profile.
- `apps/web/src/main.js`, `shell.js`, `services/route-access.js`, `styles/main.css`: route, điều hướng, avatar header và responsive styling.
- `apps/api/test/profile.integration-spec.ts`, `apps/web/src/pages/profile.test.js`: HTTP/client behavior chính.
- `docs/architecture/api-contract.md`, `docs/learning-notes/user-profile.md`: hợp đồng và tài liệu học tập.

---

### Task 1: Persistent avatar metadata and safe public user projection

**Files:**

- Create: `apps/api/prisma/migrations/20260915000000_user_profile_avatar/migration.sql`
- Create: `apps/api/src/auth/public-user.ts`
- Create: `apps/api/src/auth/public-user.spec.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/auth/auth.types.ts`
- Modify: `apps/api/src/auth/identity.repository.ts`
- Modify: `apps/api/src/auth/prisma-identity.repository.ts`
- Modify: `apps/api/src/auth/testing/in-memory-identity.repository.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Test: `apps/api/src/users/users.service.spec.ts`
- Test: `apps/api/test/database-schema.integration-spec.ts`

**Interfaces:**

- Consumes: Prisma `User`, existing `IdentityUser`, auth register/login/refresh flows.
- Produces: `toPublicUser(user): PublicUser`, `IdentityRepository.setAvatar(id, objectKey)`, and avatar fields used by Tasks 2–5.

- [x] **Step 1: Write failing projection and profile tests**

Add literal expectations proving the response includes a versioned URL but never storage/authentication fields:

```ts
it("projects avatar metadata into a cache-busted public URL", () => {
  const result = toPublicUser({
    id: "11111111-1111-1111-1111-111111111111",
    email: "learner@example.com",
    phone: "+84901234567",
    displayName: "Nguyễn An",
    passwordHash: "argon-hash",
    isLocked: false,
    securityVersion: 1,
    roles: ["CUSTOMER"],
    avatarObjectKey: "user-avatars/11111111-1111-1111-1111-111111111111/avatar",
    avatarUpdatedAt: new Date("2026-09-15T01:02:03.000Z"),
  });

  expect(result.avatarUrl).toBe(
    "/api/v1/users/11111111-1111-1111-1111-111111111111/avatar?v=1789434123000",
  );
  expect(result).not.toHaveProperty("avatarObjectKey");
  expect(result).not.toHaveProperty("passwordHash");
});
```

Also test `avatarUrl: null` when either metadata field is absent and update the existing UsersService profile test to assert the same safe projection. Extend `database-schema.integration-spec.ts` with literal expectations that `users.avatar_object_key` and `users.avatar_updated_at` exist and are nullable.

- [x] **Step 2: Run tests and confirm RED**

Run:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/auth/public-user.spec.ts src/users/users.service.spec.ts
```

Expected: FAIL because `public-user.ts` and avatar fields do not exist.

When the PostgreSQL test database is available, also run:

```bash
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api -- --runTestsByPath test/database-schema.integration-spec.ts
```

Expected: FAIL because the two avatar columns have not been migrated yet.

- [x] **Step 3: Add schema, migration and repository fields**

Add to `User`:

```prisma
avatarObjectKey String?   @map("avatar_object_key")
avatarUpdatedAt DateTime? @map("avatar_updated_at") @db.Timestamptz(3)
```

Migration:

```sql
ALTER TABLE "users"
  ADD COLUMN "avatar_object_key" TEXT,
  ADD COLUMN "avatar_updated_at" TIMESTAMPTZ(3);
```

Extend `IdentityUser` with `avatarObjectKey: string | null` and `avatarUpdatedAt: Date | null`. Initialize both to `null` in the in-memory repository and map both Prisma fields in `mapUser`.

Add this repository contract and implementations:

```ts
setAvatar(id: string, objectKey: string | null): Promise<IdentityUser>;
```

Prisma implementation sets `avatarUpdatedAt` to `new Date()` when `objectKey` is non-null and to `null` when removing it. The in-memory implementation uses the same behavior.

- [x] **Step 4: Centralize the public projection**

Create:

```ts
export interface PublicUser {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  roles: RoleName[];
  avatarUrl: string | null;
}

export function toPublicUser(user: IdentityUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    roles: user.roles,
    avatarUrl:
      user.avatarObjectKey && user.avatarUpdatedAt
        ? `/api/v1/users/${user.id}/avatar?v=${user.avatarUpdatedAt.getTime()}`
        : null,
  };
}
```

Replace duplicated projections in `AuthService` and `UsersService` with `toPublicUser`.

- [x] **Step 5: Generate Prisma client and verify GREEN**

Run:

```bash
npm run db:generate -w @sports-booking/api
npm run db:migrate -w @sports-booking/api
npm test -w @sports-booking/api -- --runTestsByPath src/auth/public-user.spec.ts src/users/users.service.spec.ts src/auth/auth.service.spec.ts
npm run typecheck -w @sports-booking/api
```

When the PostgreSQL test database is available, deploy the migration against `TEST_DATABASE_URL` and rerun its focused schema test. Expected: all selected tests, schema assertions and API typecheck PASS.

- [x] **Step 6: Commit Task 1**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260915000000_user_profile_avatar/migration.sql apps/api/src/auth/public-user.ts apps/api/src/auth/public-user.spec.ts apps/api/src/auth/auth.types.ts apps/api/src/auth/identity.repository.ts apps/api/src/auth/prisma-identity.repository.ts apps/api/src/auth/testing/in-memory-identity.repository.ts apps/api/src/auth/auth.service.ts apps/api/src/users/users.service.ts apps/api/src/users/users.service.spec.ts apps/api/test/database-schema.integration-spec.ts
git commit -m "feat(profile): persist avatar metadata"
```

---

### Task 2: Validated local avatar storage and HTTP endpoints

**Files:**

- Create: `apps/api/src/storage/user-avatar-policy.ts`
- Create: `apps/api/src/storage/user-avatar-policy.spec.ts`
- Create: `apps/api/src/users/user-avatars.controller.ts`
- Create: `apps/api/src/users/user-avatars.controller.spec.ts`
- Modify: `apps/api/src/storage/object-storage.ts`
- Modify: `apps/api/src/storage/minio-object-storage.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.module.ts`
- Modify: `apps/api/test/object-storage.integration-spec.ts`

**Interfaces:**

- Consumes: `IdentityRepository.setAvatar`, `toPublicUser`, `OBJECT_STORAGE`, authenticated `Principal`.
- Produces: `POST/DELETE /me/avatar`, `GET /users/:id/avatar`, `validateUserAvatar`, and `ObjectStorage.deleteObject`.

- [x] **Step 1: Write failing avatar policy tests**

Cover a real 1x1 PNG signature, a forged PNG, unsupported GIF and 2 MiB boundary:

```ts
it("accepts a PNG only when its signature matches", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(() => validateUserAvatar("image/png", png.length, png)).not.toThrow();
  expect(() =>
    validateUserAvatar("image/png", 8, Buffer.from("not-png!")),
  ).toThrow("Avatar file signature does not match its image type");
});
```

Add equivalent signature cases for JPEG (`FF D8 FF`) and WebP (`RIFF....WEBP`), and assert `createUserAvatarKey("user-1")` equals `user-avatars/user-1/avatar`.

- [x] **Step 2: Run policy test and confirm RED**

Run:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/storage/user-avatar-policy.spec.ts
```

Expected: FAIL because the policy module does not exist.

- [x] **Step 3: Implement storage policy and object deletion**

Export:

```ts
export const MAX_USER_AVATAR_BYTES = 2 * 1024 * 1024;
export function createUserAvatarKey(userId: string): string;
export function validateUserAvatar(
  mimeType: string,
  size: number,
  data: Buffer,
): void;
```

Use literal magic-byte comparisons for JPEG, PNG and WebP. Extend storage:

```ts
export interface ObjectStorage {
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<{ data: Buffer; contentType: string }>;
  deleteObject(key: string): Promise<void>;
}
```

Implement MinIO deletion with `DeleteObjectCommand`. Extend the existing integration test to upload, delete and then expect `getObject` to reject.

- [x] **Step 4: Write failing avatar controller tests**

Build `UserAvatarsController` with a real `UsersService`, in-memory identity repository and a small in-memory object storage. Prove that:

```ts
expect(uploadedProfile.avatarUrl).toMatch(
  /^\/api\/v1\/users\/[^/]+\/avatar\?v=\d+$/,
);
expect([...storage.objects.keys()]).toEqual([`user-avatars/${user.id}/avatar`]);
```

Also assert invalid signature returns `400`, public read returns exact bytes plus `Content-Type`, delete returns `204`, and upload without bearer token returns `401`.

- [x] **Step 5: Run controller tests and confirm RED**

Run:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/users/user-avatars.controller.spec.ts
```

Expected: FAIL because controller routes are missing.

- [x] **Step 6: Implement avatar application and HTTP flow**

Add `UsersService.avatarObject(userId)` to return `{ objectKey } | null`, and `UsersService.setAvatar(userId, objectKey)` to return `toPublicUser`. The public GET controller converts `null` to `NotFoundException`; DELETE treats `null` as an idempotent no-op.

Implement controller routes with exact multipart field `avatar` and Multer memory buffer:

```ts
@ApiConsumes("multipart/form-data")
@UseGuards(AccessTokenGuard)
@UseInterceptors(FileInterceptor("avatar", {
  limits: { fileSize: MAX_USER_AVATAR_BYTES },
}))
@Post("me/avatar")
async upload(@CurrentUser() user: Principal, @UploadedFile() file: UploadedAvatar) {
  if (!file) throw new BadRequestException("Avatar image is required");
  validateUserAvatar(file.mimetype, file.size, file.buffer);
  const key = createUserAvatarKey(user.userId);
  await this.storage.putObject(key, file.buffer, file.mimetype);
  return this.users.setAvatar(user.userId, key);
}
```

For GET, set `Content-Type`, `Cache-Control: public, max-age=86400, immutable` and `X-Content-Type-Options: nosniff`. For DELETE, look up the current key, no-op safely when absent, delete the object when present, clear metadata and return `204`. Import `StorageModule` and register `UserAvatarsController` in `UsersModule`.

- [x] **Step 7: Verify avatar tests GREEN**

Run:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/storage/user-avatar-policy.spec.ts src/users/user-avatars.controller.spec.ts
npm run typecheck -w @sports-booking/api
```

Expected: tests and typecheck PASS.

- [x] **Step 8: Commit Task 2**

```bash
git add apps/api/src/storage/user-avatar-policy.ts apps/api/src/storage/user-avatar-policy.spec.ts apps/api/src/storage/object-storage.ts apps/api/src/storage/minio-object-storage.ts apps/api/src/users/user-avatars.controller.ts apps/api/src/users/user-avatars.controller.spec.ts apps/api/src/users/users.service.ts apps/api/src/users/users.module.ts apps/api/test/object-storage.integration-spec.ts
git commit -m "feat(profile): add local avatar management"
```

---

### Task 3: Secure password change and session revocation

**Files:**

- Create: `apps/api/src/auth/auth-cookie.ts`
- Create: `apps/api/src/users/dto/change-password.dto.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/identity.repository.ts`
- Modify: `apps/api/src/auth/prisma-identity.repository.ts`
- Modify: `apps/api/src/auth/testing/in-memory-identity.repository.ts`
- Modify: `apps/api/src/users/users.controller.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**

- Consumes: `PasswordService`, `securityVersion`, refresh sessions and `AccessTokenGuard`.
- Produces: `AuthService.changePassword`, atomic `IdentityRepository.changePassword`, and `PATCH /me/password`.

- [x] **Step 1: Write failing service tests**

Add tests demonstrating the two security branches:

```ts
await expect(
  service.changePassword(user.id, "WrongPass123!", "NewStrongPass123!"),
).rejects.toBeInstanceOf(UnauthorizedException);
expect(repository.users.get(user.id)?.securityVersion).toBe(1);
```

For success, create two sessions, call change password, assert the stored hash verifies only the new value, `securityVersion` is `2`, `activeSessions()` is empty, and `authenticateAccessToken(oldAccessToken)` rejects.

- [x] **Step 2: Run AuthService test and confirm RED**

Run:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/auth/auth.service.spec.ts
```

Expected: FAIL because `changePassword` does not exist.

- [x] **Step 3: Add atomic repository operation and service policy**

Add:

```ts
changePassword(id: string, passwordHash: string): Promise<void>;
```

Prisma performs a transaction containing `user.update({ passwordHash, securityVersion: { increment: 1 } })` and `refreshSession.updateMany({ revokedAt: new Date() })`. The in-memory version updates the same state atomically for tests.

Implement:

```ts
async changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await this.repository.findUserById(userId);
  if (!user || user.isLocked || !(await this.passwords.verify(user.passwordHash, currentPassword))) {
    throw new UnauthorizedException("Current password is incorrect");
  }
  if (await this.passwords.verify(user.passwordHash, newPassword)) {
    throw new BadRequestException("New password must be different from current password");
  }
  await this.repository.changePassword(user.id, await this.passwords.hash(newPassword));
}
```

- [x] **Step 4: Write failing HTTP password test**

In `auth.e2e-spec.ts`, register through an agent, send authenticated `PATCH /api/v1/me/password`, assert `204`, a cleared `sports_refresh` cookie at `/api/v1/auth`, old access token returns `401`, refresh returns `401`, old password login returns `401`, and new password login returns `200`.

- [x] **Step 5: Run HTTP test and confirm RED**

Run:

```bash
npm run test:e2e -w @sports-booking/api -- --runTestsByPath test/auth.e2e-spec.ts
```

Expected: FAIL with `404` for `/api/v1/me/password`.

- [x] **Step 6: Implement DTO, cookie constants and endpoint**

DTO:

```ts
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
```

Move the cookie name/path to `auth-cookie.ts` so both controllers use:

```ts
export const REFRESH_COOKIE_NAME = "sports_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";
```

Add `@Patch("password")`, `@HttpCode(204)` and `@UseGuards(AuthRateLimitGuard)` beneath `@Controller("me")`. Call `AuthService.changePassword`, clear the refresh cookie using the shared path and return nothing. Export `AuthRateLimitGuard` from `AuthModule`.

- [x] **Step 7: Verify password flow GREEN**

Run:

```bash
npm test -w @sports-booking/api -- --runTestsByPath src/auth/auth.service.spec.ts
npm run test:e2e -w @sports-booking/api -- --runTestsByPath test/auth.e2e-spec.ts
npm run typecheck -w @sports-booking/api
```

Expected: unit, E2E and typecheck PASS.

- [x] **Step 8: Commit Task 3**

```bash
git add apps/api/src/auth/auth-cookie.ts apps/api/src/users/dto/change-password.dto.ts apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.module.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/auth/identity.repository.ts apps/api/src/auth/prisma-identity.repository.ts apps/api/src/auth/testing/in-memory-identity.repository.ts apps/api/src/users/users.controller.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(profile): secure password changes"
```

---

### Task 4: Profile client, protected route and account navigation

**Files:**

- Create: `apps/web/src/services/profile-api.js`
- Create: `apps/web/src/services/profile-api.test.js`
- Modify: `apps/web/src/services/auth-api.js`
- Modify: `apps/web/src/services/auth-api.test.js`
- Modify: `apps/web/src/services/route-access.js`
- Modify: `apps/web/src/services/route-access.test.js`
- Modify: `apps/web/src/shell.js`
- Modify: `apps/web/src/shell.test.js`

**Interfaces:**

- Consumes: `apiRequest`, `authApi.user()` and server profile endpoints.
- Produces: `profileApi`, `authApi.replaceUser`, `authApi.clearSession`, protected `/profile`, clickable account summary.

- [x] **Step 1: Write failing client/session tests**

Mock `fetch` and assert:

```js
await profileApi.update({ displayName: "Nguyễn An", phone: "0901234567" });
expect(fetch).toHaveBeenCalledWith(
  "/api/v1/me",
  expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ displayName: "Nguyễn An", phone: "0901234567" }),
  }),
);
expect(authApi.user().displayName).toBe("Nguyễn An");
```

Assert upload sends `FormData` without manually adding `Content-Type`, delete clears `avatarUrl`, and successful change password leaves `authApi.token()` and `authApi.user()` as `null`.

- [x] **Step 2: Run client tests and confirm RED**

Run:

```bash
npm test -w @sports-booking/web -- --run src/services/profile-api.test.js src/services/auth-api.test.js
```

Expected: FAIL because `profile-api.js`, `replaceUser` and `clearSession` are absent.

- [x] **Step 3: Implement client and session synchronization**

Expose these synchronous auth helpers:

```js
replaceUser: (user) => {
  currentUser = user;
  return currentUser;
},
clearSession: () => {
  accessToken = null;
  currentUser = null;
},
```

Use `clearSession()` inside logout. Implement `profileApi`:

```js
export const profileApi = {
  get: async () => authApi.replaceUser(await apiRequest("/me")),
  update: async (payload) =>
    authApi.replaceUser(
      await apiRequest("/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    ),
  uploadAvatar: async (file) => {
    const body = new FormData();
    body.set("avatar", file);
    return authApi.replaceUser(
      await apiRequest("/me/avatar", { method: "POST", body }),
    );
  },
  removeAvatar: async () => {
    await apiRequest("/me/avatar", { method: "DELETE" });
    return authApi.replaceUser({ ...authApi.user(), avatarUrl: null });
  },
  changePassword: async (payload) => {
    await apiRequest("/me/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    authApi.clearSession();
  },
};
```

- [x] **Step 4: Write failing navigation tests**

Assert `requiresSession("/profile")` is true and shell output for an authenticated user contains a single `<a class="account-summary" href="/profile" aria-current="page">`. With `avatarUrl`, assert an `<img alt="Ảnh đại diện của Nguyễn An">`; without it assert initials fallback.

- [x] **Step 5: Run navigation tests and confirm RED**

Run:

```bash
npm test -w @sports-booking/web -- --run src/services/route-access.test.js src/shell.test.js
```

Expected: FAIL because profile is not protected and account summary is not a link/image.

- [x] **Step 6: Implement route and shell behavior**

Add `/profile` to exact protected paths. Render the authenticated account summary as a route-aware link. Escape both URL and alt text before interpolation. Route wiring in `main.js` follows in Task 5 after `profile.js` has been created test-first.

- [x] **Step 7: Verify client/navigation GREEN**

Run:

```bash
npm test -w @sports-booking/web -- --run src/services/profile-api.test.js src/services/auth-api.test.js src/services/route-access.test.js src/shell.test.js
npm run typecheck -w @sports-booking/web
```

Expected: selected tests and web typecheck PASS.

- [x] **Step 8: Commit Task 4**

```bash
git add apps/web/src/services/profile-api.js apps/web/src/services/profile-api.test.js apps/web/src/services/auth-api.js apps/web/src/services/auth-api.test.js apps/web/src/services/route-access.js apps/web/src/services/route-access.test.js apps/web/src/shell.js apps/web/src/shell.test.js docs/superpowers/plans/2026-09-15-user-profile.md
git commit -m "feat(profile): connect profile route and session"
```

---

### Task 5: Responsive Urban Performance profile page

**Files:**

- Create: `apps/web/src/pages/profile.js`
- Create: `apps/web/src/pages/profile.test.js`
- Modify: `apps/web/src/main.js`
- Modify: `apps/web/src/styles/main.css`
- Test: `apps/web/src/shell.test.js`

**Interfaces:**

- Consumes: `profileApi`, authenticated public user, shared `escapeHtml`, design tokens from `main.css`.
- Produces: `renderProfilePage(user)`, `mountProfilePage(container)`, avatar preview, profile/password form behavior.

- [x] **Step 1: Write failing render and validation tests**

Test actual DOM behavior:

```js
document.body.innerHTML = renderProfilePage({
  id: "user-1",
  displayName: "Nguyễn An",
  email: "an@example.com",
  phone: "+84901234567",
  roles: ["CUSTOMER", "OWNER"],
  avatarUrl: null,
});

expect(document.querySelector("#profile-display-name").value).toBe("Nguyễn An");
expect(document.querySelector("#profile-email").readOnly).toBe(true);
expect(document.querySelectorAll(".profile-role-badge")).toHaveLength(2);
expect(document.querySelector("[data-avatar-fallback]").textContent).toBe("N");
```

Add pure validation tests proving mismatched confirmation, a password under 12 characters, a non-image file and a file over 2 MiB are rejected before network calls.

- [x] **Step 2: Run page tests and confirm RED**

Run:

```bash
npm test -w @sports-booking/web -- --run src/pages/profile.test.js
```

Expected: FAIL because profile rendering/validation functions do not exist.

- [x] **Step 3: Implement accessible profile markup**

Build one `section.profile-page` containing:

- `header.workspace-header` with eyebrow, title and concise security copy.
- `aside.profile-summary-card` with real image or initials, name, email, role badges, file label/button, delete button and format hint.
- `form[data-profile-form]` with labeled editable name/phone and read-only email.
- `form[data-password-form]` with current/new/confirm fields, `autocomplete="current-password"`/`new-password`, show/hide buttons and a post-success sign-out notice.
- Independent `role="status" aria-live="polite"` regions for avatar, profile and password actions.

Use `escapeHtml` for every server-derived value and use Vietnamese role labels: `CUSTOMER → Khách hàng`, `OWNER → Chủ sân`, `ADMIN → Quản trị viên`.

- [x] **Step 4: Write failing interaction tests**

Mock `profileApi` at its public boundary. Assert profile submit sends exactly `{ displayName, phone }`, valid file change creates a preview URL, upload/remove update the rendered avatar, mismatch confirmation does not call `changePassword`, and success redirects to:

```js
"/login?reason=password-changed";
```

Also assert each submit disables only its own action while pending and restores it after failure.

- [x] **Step 5: Run interaction tests and confirm RED**

Run:

```bash
npm test -w @sports-booking/web -- --run src/pages/profile.test.js
```

Expected: render tests may pass, interaction tests FAIL because `mountProfilePage` handlers are absent.

- [x] **Step 6: Implement page interactions**

On mount, fetch the latest profile, render it, then attach one delegated `submit`, `change` and `click` handler to the page. Re-bind only by replacing the profile section through a single `renderAndBind(user)` function. Revoke old object preview URLs before creating new ones. Never send `confirmPassword` to the API.

Expose deterministic validators:

```js
export function validateAvatarFile(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Ảnh đại diện không được vượt quá 2 MB.");
  }
}

export function validatePasswordForm(newPassword, confirmPassword) {
  if (newPassword.length < 12 || newPassword.length > 128) {
    throw new Error("Mật khẩu mới phải có từ 12 đến 128 ký tự.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Xác nhận mật khẩu chưa khớp.");
  }
}
```

- [x] **Step 7: Add responsive design-system styles**

Add scoped `.profile-*` rules using existing variables only. Desktop uses `grid-template-columns: minmax(16rem, 0.72fr) minmax(0, 1.5fr)`, `gap: clamp(1rem, 3vw, 2rem)`, `var(--radius-lg)` and `var(--shadow-sm)`. At the existing tablet/mobile breakpoint collapse to one column, make actions full width below 36rem, preserve 44px minimum controls, visible focus, sufficient contrast and `prefers-reduced-motion` behavior already established by the stylesheet.

- [x] **Step 8: Verify page GREEN**

Run:

```bash
npm test -w @sports-booking/web -- --run src/pages/profile.test.js src/shell.test.js
npm run lint -w @sports-booking/web
npm run typecheck -w @sports-booking/web
npm run build -w @sports-booking/web
```

Expected: tests, lint, typecheck and production web build PASS without warnings introduced by profile code.

- [x] **Step 9: Commit Task 5**

```bash
git add apps/web/src/pages/profile.js apps/web/src/pages/profile.test.js apps/web/src/styles/main.css apps/web/src/shell.test.js
git commit -m "feat(profile): build responsive account experience"
```

---

### Task 6: Database-backed acceptance tests, documentation and full verification

**Files:**

- Create: `apps/api/test/profile.integration-spec.ts`
- Create: `docs/learning-notes/user-profile.md`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `docs/architecture/api-contract.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: all APIs and UI contracts from Tasks 1–5, Docker Compose PostgreSQL/MinIO.
- Produces: regression evidence, updated API contract and Vietnamese learning handoff.

- [x] **Step 1: Write failing database-backed acceptance tests**

Create a PostgreSQL-backed suite following `phases-2-4.database.e2e-spec.ts` setup. Register a unique user and prove:

```ts
const changed = await request(app.getHttpServer())
  .patch("/api/v1/me/password")
  .set("Authorization", `Bearer ${accessToken}`)
  .send({ currentPassword: "LocalDemo123!", newPassword: "ChangedDemo123!" });
expect(changed.status).toBe(204);
```

Then assert the old access token is `401`, old login is `401`, new login is `200`, profile response never contains `passwordHash`, `securityVersion` or `avatarObjectKey`, and avatar metadata persists after update.

- [x] **Step 2: Run profile acceptance test and confirm RED**

Run:

```bash
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api -- --runTestsByPath test/profile.integration-spec.ts
```

Expected: FAIL on at least one unimplemented database-backed acceptance behavior added in Step 1. If every behavior is already covered by the focused unit/HTTP work from Tasks 1–3, record that fact and retain this suite as cross-layer regression coverage rather than manufacturing a false failure.

- [x] **Step 3: Deploy and validate migration locally**

Run:

```bash
docker compose up -d postgres minio
npm run db:migrate -w @sports-booking/api
npm run db:validate -w @sports-booking/api
```

Expected: migration deploy and Prisma validation succeed without destructive changes.

- [x] **Step 4: Run database-backed acceptance suite GREEN**

Run:

```bash
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public TEST_OBJECT_STORAGE=true npm run test:integration -w @sports-booking/api -- --runTestsByPath test/database-schema.integration-spec.ts test/object-storage.integration-spec.ts test/profile.integration-spec.ts
```

Expected: profile/database/storage acceptance tests PASS. Delete all test-created MinIO objects through `ObjectStorage.deleteObject` in `afterAll`.

- [x] **Step 5: Update contract, README and learning note**

Document exact endpoints, payloads, status codes, image constraints and forced sign-in behavior. The learning note must explain in Vietnamese:

1. Metadata-vs-binary storage choice.
2. Request flow for profile/avatar/password.
3. Why `securityVersion` invalidates old tokens.
4. How file signatures prevent forged content types.
5. How to run focused tests and inspect MinIO at `http://localhost:9001`.
6. Common risks: trusting object keys, exposing hashes, stale sessions and oversized uploads.
7. Self-check questions with answers omitted.

README adds a short “Thông tin cá nhân” demo subsection and explicitly states local MinIO requires no paid cloud account.

- [x] **Step 6: Run the complete quality gates**

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e -w @sports-booking/api
```

When PostgreSQL test infrastructure is available, also run:

```bash
TEST_DATABASE_URL=postgresql://sports:sports_local_password@localhost:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api
```

Expected: all commands PASS. If Docker/MinIO cannot run because of the host environment, record the exact failing command and still run every non-Docker gate; do not claim the skipped smoke test passed.

- [x] **Step 7: Smoke test the local free stack**

Run:

```bash
docker compose up -d postgres redis minio mailhog migrate api worker
npm run dev:web
```

Manually verify at `http://localhost:5173/profile`: profile update changes the header, avatar replace/remove survives refresh, wrong current password is rejected, successful change redirects to login, old password fails and new password succeeds. Stop the foreground Vite process after verification; keep Docker volumes intact.

- [x] **Step 8: Commit Task 6**

```bash
git add apps/api/src/auth/auth.module.ts apps/api/test/profile.integration-spec.ts docs/architecture/api-contract.md docs/learning-notes/user-profile.md README.md docs/superpowers/plans/2026-09-15-user-profile.md
git commit -m "test(profile): verify account management flow"
```

- [x] **Step 9: Review final diff without touching user files**

Run:

```bash
git status --short
git log -7 --oneline
git diff HEAD~6..HEAD --stat
```

Expected: the six profile commits are present; `docs/project-deep-dive.md` remains untracked and absent from every profile commit.
