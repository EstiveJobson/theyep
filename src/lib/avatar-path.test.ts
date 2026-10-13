import assert from "node:assert/strict";
import test from "node:test";
import { ownedStoragePath, postPhotoPath } from "./avatar-path.ts";

const me = "aa000000-0000-4000-8000-00000000000a";
const other = "bb000000-0000-4000-8000-00000000000b";

test("only the profile owner's folder is an avatar path we sign", () => {
  assert.equal(ownedStoragePath(me, `${me}/face.webp`), `${me}/face.webp`);
  assert.equal(
    ownedStoragePath(
      me,
      `https://proj.supabase.co/storage/v1/object/sign/avatars/${me}/face.webp?token=abc`,
    ),
    `${me}/face.webp`,
  );
  assert.equal(ownedStoragePath(me, `${other}/face.webp`), null);
  assert.equal(
    ownedStoragePath(
      me,
      `https://proj.supabase.co/storage/v1/object/public/avatars/${other}/face.webp`,
    ),
    null,
  );
  assert.equal(ownedStoragePath(me, "https://evil.example/a.png"), null);
  assert.equal(ownedStoragePath(me, null), null);
  assert.equal(ownedStoragePath(me, `${me}/.`), null);
  assert.equal(ownedStoragePath(me, `${me}/..`), null);
  assert.equal(ownedStoragePath(me, `${me}/.hidden`), null);
  assert.equal(ownedStoragePath(me, `${me}/face.webp`), `${me}/face.webp`);
});

test("post photo paths ignore the signed-url token", () => {
  assert.equal(
    postPhotoPath(
      `https://proj.supabase.co/storage/v1/object/sign/post-photos/${me}/shot.webp?token=1`,
    ),
    `${me}/shot.webp`,
  );
  assert.equal(
    postPhotoPath(
      `https://proj.supabase.co/storage/v1/object/sign/post-photos/${me}/shot.webp?token=2`,
    ),
    `${me}/shot.webp`,
  );
});
