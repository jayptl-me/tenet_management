---
name: visitor-creation-broken
description: Visitor POST route has field name mismatch between Zod schema (name/phone) and Mongoose model (visitorName/visitorPhone) -- strictObject rejects requests, visitor creation always fails
metadata:
  type: project
---

Visitor creation is broken at apps/api/src/routes/visitors.ts:50-70. The Zod schema uses field names `name` and `phone` but the Mongoose model uses `visitorName` and `visitorPhone`. Because `z.strictObject()` rejects unknown keys, and the frontend sends `visitorName`, every creation request returns a 400 validation error.

Also: the route handler passes `roomId: tenant.roomId` (line 62) but the Visitor model schema has no `roomId` field -- silently stripped by Mongoose.

**Why:** This is a silent P0 data-loss bug that prevents the entire visitor management module from working.

**How to apply:** Before working on any visitor-related features, fix this first. Either rename schema fields to match model, or map fields in the handler.
