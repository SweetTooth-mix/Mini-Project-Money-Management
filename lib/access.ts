// Who may read a document, and therefore its attachment.
//
// This is the single place that answers the question. The document page and the
// attachment download route both call it, so a link is offered exactly when the
// download will honour it. Before this existed the page linked to the file for
// every signed-in user and the route served it to every signed-in user, which
// meant anyone with an account could read any other member's receipt.
//
// The policy:
//
//   - A draft is unfinished work. It belongs to its author, plus the managers
//     who may need to look before it is submitted. This matches the rule that
//     already guarded the write path ("Hanya penyedia boleh menukar lampiran
//     draf.").
//   - Once a document leaves DRAFT it is part of the organisation's book, and
//     every member may read it. There is one organisation per database, so
//     "the organisation" is everyone.
//
// Widening or narrowing this is a product decision, but it is now a decision in
// one function rather than an accident spread across two files.

export type Viewer = { id: string; role: string };
export type DocumentRef = { createdById: string; status: string };

// An allowlist, not `role !== "USER"`. If a role is added later (an auditor, a
// read-only account), it starts with the narrowest access instead of silently
// gaining the manager powers.
const MANAGER_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);
export const isManager = (viewer: Viewer) => MANAGER_ROLES.has(viewer.role);

export function canReadDocument(viewer: Viewer, doc: DocumentRef) {
  if (doc.status !== "DRAFT") return true;
  return doc.createdById === viewer.id || isManager(viewer);
}
