ALTER TABLE users ADD total_online_time INTEGER DEFAULT 0;
ALTER TABLE users ADD current_session_time INTEGER DEFAULT 0;
ALTER TABLE users ADD last_sign_in_time INTEGER;