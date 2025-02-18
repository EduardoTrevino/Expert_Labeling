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
CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  uploaded_by text NOT NULL,
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

-- Enable RLS
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view images"
  ON images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own images"
  ON images
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = uploaded_by);

CREATE POLICY "Anyone can view annotations"
  ON annotations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own annotations"
  ON annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = created_by);

CREATE POLICY "Users can update their own annotations"
  ON annotations
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = created_by);