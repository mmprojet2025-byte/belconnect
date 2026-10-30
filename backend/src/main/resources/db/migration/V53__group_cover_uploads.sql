CREATE TABLE group_cover_image (
    group_id BIGINT PRIMARY KEY REFERENCES groupe(id) ON DELETE CASCADE,
    public_id UUID NOT NULL UNIQUE,
    content_type VARCHAR(20) NOT NULL,
    image_data BYTEA NOT NULL
);
