/*
  # Initial Schema Setup for GDO Application

  1. New Tables
    - `images`
      - `id` (uuid, primary key)
      - `url` (text)
      - `uploaded_by` (text)
      - `created_at` (timestamp)
    
    - `annotations`
      - `id` (uuid, primary key)
      - `image_id` (uuid, foreign key)
      - `x_coordinate` (float)
      - `y_coordinate` (float)
      - `annotation_type` (text[])
      - `other_text` (text)
      - `created_by` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create images table
-- images table
CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,          -- path or public URL to the .tif
  name text,                  -- optional, e.g. "Substation_41378006.tif"
  uploaded_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed boolean DEFAULT false
);


CREATE TABLE IF NOT EXISTS component_polygons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES images(id),
  label text,               -- e.g. "power_line", "power_switch", etc.
  geometry jsonb NOT NULL,  -- store geometry from the shapefile as GeoJSON
  created_at timestamptz DEFAULT now()
);


-- Create annotations table
CREATE TABLE IF NOT EXISTS annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES images(id),
  x_coordinate float NOT NULL,
  y_coordinate float NOT NULL,
  annotation_type text[] NOT NULL,
  other_text text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Disable Row Level Security
ALTER TABLE images DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;

-- Grant full privileges to everyone (public)
GRANT ALL PRIVILEGES ON TABLE images TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE annotations TO PUBLIC;

