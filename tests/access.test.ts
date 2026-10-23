import { test } from "node:test";
import assert from "node:assert/strict";
import { canReadDocument } from "../lib/access";

const author = { id: "u1", role: "USER" };
const other = { id: "u2", role: "USER" };
const admin = { id: "u3", role: "ADMIN" };
const superAdmin = { id: "u4", role: "SUPER_ADMIN" };

const draft = (createdById: string) => ({ createdById, status: "DRAFT" });
const submitted = (createdById: string, status = "PENDING") => ({
  createdById,
  status,
});

test("a draft belongs to its author", () => {
  assert.equal(canReadDocument(author, draft(author.id)), true);
  // The finding this test exists for: another member could read the file.
  assert.equal(canReadDocument(other, draft(author.id)), false);
});

test("managers may read a draft they did not write", () => {
  // They are the people who have to look before it is submitted.
  assert.equal(canReadDocument(admin, draft(author.id)), true);
  assert.equal(canReadDocument(superAdmin, draft(author.id)), true);
});

test("everything past DRAFT is readable by every member", () => {
  for (const status of ["PENDING", "APPROVED", "PAID", "REJECTED", "VOID"])
    for (const viewer of [author, other, admin, superAdmin])
      assert.equal(canReadDocument(viewer, submitted(author.id, status)), true);
});

test("an unknown role is treated as an ordinary member, not a manager", () => {
  // Fail closed: a role value added later must opt in to the wider permission.
  assert.equal(
    canReadDocument({ id: "u5", role: "AUDITOR" }, draft(author.id)),
    false,
  );
});
