CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  station_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  city TEXT NOT NULL,
  charger_type TEXT NOT NULL,
  power_kw INTEGER NOT NULL,
  day TEXT NOT NULL,
  hour INTEGER NOT NULL,
  est_kwh NUMERIC NOT NULL,
  amount_inr INTEGER NOT NULL,
  discount_applied BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX bookings_stripe_session_id_idx ON public.bookings (stripe_session_id);

GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;