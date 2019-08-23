
-- run this file with psql -f schema.sql -d city_explorer

DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude NUMERIC(10,7),
  longitude NUMERIC (10,7),
  created_at TIMESTAMP
);

DROP TABLE IF EXISTS weather;

CREATE TABLE weather (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  forecast VARCHAR,
  time VARCHAR(255),
  created_at TIMESTAMP
);

DROP TABLE IF EXISTS events;

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  link VARCHAR(255),
  name VARCHAR(255),
  event_date VARCHAR(255),
  summary VARCHAR,
  created_at TIMESTAMP
);
-- Entirely to test if things worked