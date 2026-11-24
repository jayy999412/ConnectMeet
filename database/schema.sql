-- ===========================================================================
-- ConnectMeet — canonical MySQL schema for `connectmeet_db`
--
-- Run against an existing database, e.g.:
--     mysql -u root -p connectmeet_db < schema.sql
--
-- Or let the helper create everything for you (database + user + tables):
--     python backend/init_db.py --root-password <your-root-password>
--
-- Engine: MySQL 8.x  |  Charset: utf8mb4
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS recordings;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)     NOT NULL,
  email         VARCHAR(255)     NOT NULL,
  password_hash VARCHAR(255)     NOT NULL,
  profile_image VARCHAR(512)     NULL,
  is_guest      TINYINT(1)       NOT NULL DEFAULT 0,
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------ meetings
CREATE TABLE IF NOT EXISTS meetings (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  meeting_code  VARCHAR(20)      NOT NULL,
  title         VARCHAR(120)     NOT NULL,
  host_id       INT UNSIGNED     NOT NULL,
  password_hash VARCHAR(255)     NULL,
  status        VARCHAR(16)      NOT NULL DEFAULT 'waiting',
  scheduled_at  DATETIME         NULL,
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at    DATETIME         NULL,
  ended_at      DATETIME         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meetings_code (meeting_code),
  KEY ix_meetings_host (host_id),
  KEY ix_meetings_status (status),
  KEY ix_meetings_scheduled_at (scheduled_at),
  CONSTRAINT fk_meetings_host
    FOREIGN KEY (host_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- participants
-- One row per (meeting, user): rejoining updates the existing row, so a user
-- can never hold two active records for the same meeting.
CREATE TABLE IF NOT EXISTS participants (
  id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED   NOT NULL,
  user_id    INT UNSIGNED   NOT NULL,
  role       VARCHAR(16)    NOT NULL DEFAULT 'participant',
  joined_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at    DATETIME       NULL,
  status     VARCHAR(16)    NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant_meeting_user (meeting_id, user_id),
  KEY ix_participants_user (user_id),
  KEY ix_participants_meeting_status (meeting_id, status),
  CONSTRAINT fk_participants_meeting
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
  CONSTRAINT fk_participants_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------ messages
CREATE TABLE IF NOT EXISTS messages (
  id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED   NOT NULL,
  sender_id  INT UNSIGNED   NOT NULL,
  message    TEXT           NOT NULL,
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_messages_meeting_created (meeting_id, created_at),
  KEY ix_messages_sender (sender_id),
  CONSTRAINT fk_messages_meeting
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- recordings
-- Local-only recording log: `recording_url` stays NULL because the browser
-- MediaRecorder file never leaves the participant's device (cloud recording
-- and object storage would require paid services).
CREATE TABLE IF NOT EXISTS recordings (
  id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  meeting_id    INT UNSIGNED   NOT NULL,
  recording_url VARCHAR(1024)  NULL,
  started_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at      DATETIME       NULL,
  status        VARCHAR(24)    NOT NULL DEFAULT 'local_device',
  user_id       INT UNSIGNED   NULL,
  PRIMARY KEY (id),
  KEY ix_recordings_meeting (meeting_id),
  KEY ix_recordings_started_at (started_at),
  CONSTRAINT fk_recordings_meeting
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
  CONSTRAINT fk_recordings_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
