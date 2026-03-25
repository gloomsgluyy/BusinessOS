-- SQL script to update all user roles to lowercase
UPDATE User SET role = 'ceo' WHERE role = 'CEO';
UPDATE User SET role = 'director' WHERE role = 'ASSISTANT_CEO';
UPDATE User SET role = 'manager' WHERE role = 'MANAGER';
UPDATE User SET role = 'staff' WHERE role = 'STAFF';
UPDATE User SET role = 'marketing' WHERE role = 'MARKETING';
UPDATE User SET role = 'finance' WHERE role = 'FINANCE';
UPDATE User SET role = 'commercial' WHERE role = 'COMMERCIAL';
UPDATE User SET role = 'operations' WHERE role = 'OPERATIONS';
UPDATE User SET role = 'procurement' WHERE role = 'PROCUREMENT';

-- Verify the changes
SELECT id, name, email, role FROM User;
