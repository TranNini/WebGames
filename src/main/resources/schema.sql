-- One row per game and name: the best score of that name.
-- name_key: the name in lower case, so "Anna" and "anna" are one player
-- achieved_at: when the score was reached (milliseconds); of two equal scores the earlier one ranks higher
CREATE TABLE IF NOT EXISTS scores (
    game        TEXT    NOT NULL,
    name_key    TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    score       INTEGER NOT NULL,
    achieved_at INTEGER NOT NULL,
    PRIMARY KEY (game, name_key)
);

-- Reflex Tap had one list until it got modes; those games had all 8 colors, so they count for hard
UPDATE OR IGNORE scores SET game = 'reflex-hard' WHERE game = 'reflex';
