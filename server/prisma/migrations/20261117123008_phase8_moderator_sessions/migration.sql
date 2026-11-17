-- T1: a moderator now signs in with a code. A session begun before that would otherwise last up to seven more days without one,
-- so every moderator is signed out once, here. Nothing else changes.
UPDATE "User" SET "tokenVersion" = "tokenVersion" + 1 WHERE "role" = 'moderator';
