CREATE TABLE owners (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0)
);

CREATE TABLE resume_documents (
    owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
    id TEXT NOT NULL CHECK (length(id) > 0),
    source_name TEXT NOT NULL CHECK (length(source_name) > 0),
    raw_text TEXT NOT NULL,
    parent_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, parent_id) REFERENCES resume_documents(owner_id, id) ON DELETE RESTRICT,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX resume_documents_parent ON resume_documents(owner_id, parent_id);
