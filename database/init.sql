CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  umur INTEGER NOT NULL,
  tanggal DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  umur INTEGER NOT NULL,
  tanggal DATE NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  umur INTEGER NOT NULL,
  tanggal DATE NOT NULL
);

INSERT INTO teachers (nama, umur, tanggal)
VALUES ('Dosen Demo', 40, '1986-01-01');

INSERT INTO students (nama, umur, tanggal, teacher_id)
VALUES ('Student Demo', 20, '2006-01-01', 1);

INSERT INTO staff (nama, umur, tanggal)
VALUES ('Staff Demo', 30, '1996-01-01');
