-- Optional starter categories
INSERT INTO categories(name,slug) VALUES
('Digital','digital'),
('Fisik','fisik'),
('Jasa','jasa')
ON CONFLICT DO NOTHING;
