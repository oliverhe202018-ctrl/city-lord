-- Migration: Add photo_url column to runs table
-- Run this on Supabase SQL Editor or via psql

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS photo_url TEXT;
