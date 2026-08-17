ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_network_check;
ALTER TABLE cards ALTER COLUMN network SET DEFAULT 'Mastercard';
ALTER TABLE cards ADD CONSTRAINT cards_network_check CHECK (network IN ('Mastercard','Visa'));
